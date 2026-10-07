"""
Pytest Test Suite for Secure Geotechnical External API (v1).
Validates authentication, API-key hashing, permission scopes, rate limiting,
tenant isolation, module boundary confinement, report endpoints, and rotation/revocation.
"""
import io
import os
import sys
import json
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.all_models import (
    Project, GeotechnicalReport, GeotechAPIKey, GeotechAPIAuditLog
)
from backend.app.services.geotech_auth_service import (
    GeotechAuthService, hash_api_key
)


client = TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def setup_tenants_and_keys(db_session):
    """Provisions test API keys for multiple clients with different permissions."""
    # 1. Full admin client (ERP)
    erp_key_rec, erp_raw_key = GeotechAuthService.create_api_key(
        db=db_session,
        client_name="Test Construction ERP",
        tenant_id="tenant_erp_alpha",
        permissions=[
            "geotechnical:upload",
            "geotechnical:read",
            "geotechnical:analyze",
            "geotechnical:alerts",
            "geotechnical:recommendations",
            "geotechnical:admin"
        ],
        environment="production",
        rate_limit_per_minute=100
    )

    # 2. Read-only client (Subcontractor)
    readonly_rec, readonly_raw_key = GeotechAuthService.create_api_key(
        db=db_session,
        client_name="Test Subcontractor",
        tenant_id="tenant_sub_beta",
        permissions=["geotechnical:read"],
        environment="production",
        rate_limit_per_minute=100
    )

    # 3. Low-rate-limited client
    limited_rec, limited_raw_key = GeotechAuthService.create_api_key(
        db=db_session,
        client_name="Throttled Client",
        tenant_id="tenant_throttled",
        permissions=["geotechnical:read"],
        environment="production",
        rate_limit_per_minute=3  # Throttled at 3 per min
    )

    # 4. Expired key
    expired_rec, expired_raw_key = GeotechAuthService.create_api_key(
        db=db_session,
        client_name="Expired System",
        tenant_id="tenant_expired",
        permissions=["geotechnical:read"],
        expiry_days=1
    )
    # Force backdate expiration
    expired_rec.expires_at = datetime.utcnow() - timedelta(days=2)
    db_session.commit()

    return {
        "erp": (erp_key_rec, erp_raw_key),
        "readonly": (readonly_rec, readonly_raw_key),
        "limited": (limited_rec, limited_raw_key),
        "expired": (expired_rec, expired_raw_key)
    }


def test_api_key_hashing_and_security(db_session, setup_tenants_and_keys):
    """Asserts plaintext keys are NEVER stored in the database."""
    erp_rec, erp_raw_key = setup_tenants_and_keys["erp"]
    db_record = db_session.query(GeotechAPIKey).filter(GeotechAPIKey.id == erp_rec.id).first()

    assert db_record is not None
    assert db_record.key_hash == hash_api_key(erp_raw_key)
    assert erp_raw_key not in db_record.key_hash
    # Check that plaintext raw key is not in any field
    assert erp_raw_key != db_record.key_prefix
    assert "geo_live_" in erp_raw_key


def test_unauthenticated_request_rejected():
    """Requests without an API key must return 401 Unauthorized."""
    resp = client.get("/api/v1/geotechnical/reports/GT-1001")
    assert resp.status_code == 401
    assert "Missing API key" in resp.json()["detail"]


def test_invalid_key_format_rejected():
    """Keys not beginning with geo_live_ or geo_test_ must be rejected."""
    headers = {"Authorization": "Bearer invalid_prefix_12345"}
    resp = client.get("/api/v1/geotechnical/reports/GT-1001", headers=headers)
    assert resp.status_code == 401
    assert "Invalid API key format" in resp.json()["detail"]


def test_expired_key_rejected(setup_tenants_and_keys):
    """Expired keys must return 403 Forbidden."""
    _, expired_raw_key = setup_tenants_and_keys["expired"]
    headers = {"Authorization": f"Bearer {expired_raw_key}"}
    resp = client.get("/api/v1/geotechnical/reports/GT-1001", headers=headers)
    assert resp.status_code == 403
    assert "expired" in resp.json()["detail"].lower()


def test_permission_scope_enforcement(setup_tenants_and_keys):
    """Client with only 'geotechnical:read' must be denied from upload or admin."""
    _, readonly_raw_key = setup_tenants_and_keys["readonly"]
    headers = {"Authorization": f"Bearer {readonly_raw_key}"}

    # Attempt upload (requires geotechnical:upload)
    files = {"file": ("report.txt", io.BytesIO(b"Soil boring report data"), "text/plain")}
    resp = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files)
    assert resp.status_code == 403
    assert "Missing required permission" in resp.json()["detail"]

    # Attempt key creation (requires geotechnical:admin)
    key_payload = {
        "client_name": "Rogue Client",
        "tenant_id": "rogue",
        "permissions": ["geotechnical:read"]
    }
    resp_key = client.post("/api/v1/geotechnical/keys", headers=headers, json=key_payload)
    assert resp_key.status_code == 403


def test_module_boundary_isolation(setup_tenants_and_keys):
    """External geotechnical API keys must NOT be able to access internal platform modules."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    # Attempt accessing /api/projects
    resp_proj = client.get("/api/projects", headers=headers)
    assert resp_proj.status_code == 403
    assert "strictly confined" in resp_proj.json()["detail"].lower()

    # Attempt accessing /api/auth
    resp_auth = client.get("/api/auth/me", headers=headers)
    assert resp_auth.status_code == 403


def test_upload_and_get_geotechnical_report(setup_tenants_and_keys):
    """Uploads a report with valid permissions and retrieves formatted overview."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    report_content = (
        b"GEOTECHNICAL INVESTIGATION REPORT FOR ABC RESIDENTIAL TOWER\n"
        b"Boreholes: BH-01, BH-02, BH-03, BH-04, BH-05, BH-06 terminated at 30.0 m.\n"
        b"Groundwater encountered at 8.4 m.\n"
        b"Stratigraphy: 0.0-1.5m Fill, 1.5-8.0m Sand, 8.0-21.5m Dense Sand, >21.5m Hard Basalt (RQD 70%, UCS 85 MPa).\n"
        b"Safe Bearing Capacity at 4.5 m founding depth: 320 kPa.\n"
        b"Recommended Foundation: Raft Foundation.\n"
    )

    files = {"file": ("abc_tower_geotech.txt", io.BytesIO(report_content), "text/plain")}
    data = {
        "project_name": "ABC Residential Tower",
        "report_title": "Comprehensive Subsurface Investigation Report"
    }

    upload_resp = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files, data=data)
    assert upload_resp.status_code == 201
    rep = upload_resp.json()

    report_id = rep["report_id"]
    assert report_id.startswith("GT-")
    assert rep["project_name"].lower() == "abc residential tower"
    assert rep["status"] == "analyzed"
    assert rep["maximum_depth_m"] == 30.0
    assert rep["groundwater_level_m"] == 8.4
    assert rep["soil_summary"]["top_layer"] is not None
    assert rep["soil_summary"]["major_soil"] is not None
    assert rep["analysis_available"] is True
    assert len(rep["alerts"]) > 0

    # Test GET /reports/{report_id}
    get_resp = client.get(f"/api/v1/geotechnical/reports/{report_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["report_id"] == report_id


def test_boreholes_endpoint(setup_tenants_and_keys):
    """Tests GET /reports/{report_id}/boreholes."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    # Upload fresh report
    files = {"file": ("bh_test.txt", io.BytesIO(b"Borehole log test report"), "text/plain")}
    up = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files, data={"project_name": "Tower Alpha"})
    rep_id = up.json()["report_id"]

    resp = client.get(f"/api/v1/geotechnical/reports/{rep_id}/boreholes", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["report_id"] == rep_id
    assert data["total_boreholes"] >= 1
    assert len(data["boreholes"]) >= 1
    bh = data["boreholes"][0]
    assert "borehole_id" in bh
    assert "depth_m" in bh
    assert "strata" in bh


def test_soil_profile_endpoint(setup_tenants_and_keys):
    """Tests GET /reports/{report_id}/soil-profile."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    files = {"file": ("soil_test.txt", io.BytesIO(b"Soil profile test data"), "text/plain")}
    up = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files)
    rep_id = up.json()["report_id"]

    resp = client.get(f"/api/v1/geotechnical/reports/{rep_id}/soil-profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["layers"]) >= 1
    assert "governing_parameters" in data
    assert "is_codes" in data


def test_alerts_and_foundation_recommendations(setup_tenants_and_keys):
    """Tests /alerts and /foundation-recommendations endpoints."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    files = {"file": ("alerts_test.txt", io.BytesIO(b"Alerts and foundations test"), "text/plain")}
    up = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files)
    rep_id = up.json()["report_id"]

    # Alerts
    alerts_resp = client.get(f"/api/v1/geotechnical/reports/{rep_id}/alerts", headers=headers)
    assert alerts_resp.status_code == 200
    assert alerts_resp.json()["total_alerts"] >= 1

    # Foundation recommendations
    found_resp = client.get(f"/api/v1/geotechnical/reports/{rep_id}/foundation-recommendations", headers=headers)
    assert found_resp.status_code == 200
    fdata = found_resp.json()
    assert "Raft" in fdata["recommended_foundation_type"] or "Foundation" in fdata["recommended_foundation_type"]
    assert fdata["safe_bearing_capacity_kpa"] > 0
    assert len(fdata["relevant_is_codes"]) > 0


def test_analyze_and_analysis_result(setup_tenants_and_keys):
    """Tests POST /analyze and GET /analysis."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    files = {"file": ("analyze_test.txt", io.BytesIO(b"Analysis test document"), "text/plain")}
    up = client.post("/api/v1/geotechnical/reports/upload", headers=headers, files=files)
    rep_id = up.json()["report_id"]

    analyze_payload = {
        "structural_load_kn": 15000,
        "footprint_area_sqm": 1400,
        "target_depth_m": 8.0,
        "seismic_zone": "Zone IV"
    }
    post_res = client.post(f"/api/v1/geotechnical/reports/{rep_id}/analyze", headers=headers, json=analyze_payload)
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "analyzed"

    get_res = client.get(f"/api/v1/geotechnical/reports/{rep_id}/analysis", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert "excavation_plan" in data
    assert len(data["excavation_plan"]["machinery_fleet"]) > 0


def test_tenant_isolation(setup_tenants_and_keys):
    """Ensures reports uploaded by Tenant A cannot be accessed by Tenant B."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]           # tenant_erp_alpha
    _, readonly_raw_key = setup_tenants_and_keys["readonly"] # tenant_sub_beta

    headers_alpha = {"Authorization": f"Bearer {erp_raw_key}"}
    headers_beta = {"Authorization": f"Bearer {readonly_raw_key}"}

    # Tenant Alpha uploads a report
    files = {"file": ("alpha_secret_report.txt", io.BytesIO(b"Alpha Confidential Data"), "text/plain")}
    up_alpha = client.post("/api/v1/geotechnical/reports/upload", headers=headers_alpha, files=files, data={"project_name": "Alpha Tower"})
    assert up_alpha.status_code == 201
    alpha_rep_id = up_alpha.json()["report_id"]

    # Tenant Alpha can access it
    assert client.get(f"/api/v1/geotechnical/reports/{alpha_rep_id}", headers=headers_alpha).status_code == 200

    # Tenant Beta attempts to access it -> MUST return 404 Not Found (Zero information leakage)
    beta_access = client.get(f"/api/v1/geotechnical/reports/{alpha_rep_id}", headers=headers_beta)
    assert beta_access.status_code == 404


def test_rate_limiting(setup_tenants_and_keys):
    """Ensures clients exceeding their rate limit receive HTTP 429."""
    _, limited_raw_key = setup_tenants_and_keys["limited"]
    headers = {"Authorization": f"Bearer {limited_raw_key}"}

    # Limit is 3 requests per minute
    statuses = []
    for _ in range(6):
        resp = client.get("/api/v1/geotechnical/reports/GT-9999", headers=headers)
        statuses.append(resp.status_code)

    assert 429 in statuses


def test_api_key_rotation_and_revocation(setup_tenants_and_keys):
    """Tests key rotation and immediate revocation."""
    erp_rec, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    # 1. Create a temporary key to rotate
    new_key_payload = {
        "client_name": "Temporary Client",
        "tenant_id": erp_rec.tenant_id,
        "permissions": ["geotechnical:read"]
    }
    create_res = client.post("/api/v1/geotechnical/keys", headers=headers, json=new_key_payload)
    assert create_res.status_code == 201
    temp_data = create_res.json()
    temp_key_id = temp_data["key_id"]
    temp_raw_key = temp_data["api_key"]

    # Verify temp key works
    assert client.get("/api/v1/geotechnical/reports/GT-9999", headers={"Authorization": f"Bearer {temp_raw_key}"}).status_code in [200, 404]

    # 2. Rotate temp key
    rotate_res = client.post(f"/api/v1/geotechnical/keys/{temp_key_id}/rotate", headers=headers)
    assert rotate_res.status_code == 200
    rot_data = rotate_res.json()
    new_active_raw_key = rot_data["new_api_key"]

    # 3. Old key must now be revoked (403 Forbidden)
    old_res = client.get("/api/v1/geotechnical/reports/GT-9999", headers={"Authorization": f"Bearer {temp_raw_key}"})
    assert old_res.status_code == 403
    assert "revoked" in old_res.json()["detail"].lower()

    # 4. New rotated key must work
    new_res = client.get("/api/v1/geotechnical/reports/GT-9999", headers={"Authorization": f"Bearer {new_active_raw_key}"})
    assert new_res.status_code in [200, 404]

    # 5. Revoke new key
    new_key_id = rot_data["new_key_id"]
    revoke_res = client.post(f"/api/v1/geotechnical/keys/{new_key_id}/revoke", headers=headers)
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "revoked"

    # Verify revoked key fails
    assert client.get("/api/v1/geotechnical/reports/GT-9999", headers={"Authorization": f"Bearer {new_active_raw_key}"}).status_code == 403


def test_no_secrets_leaked_in_responses(setup_tenants_and_keys):
    """Verifies that internal DB passwords, JWT secret keys, and credentials are never in API responses."""
    _, erp_raw_key = setup_tenants_and_keys["erp"]
    headers = {"Authorization": f"Bearer {erp_raw_key}"}

    keys_list_res = client.get("/api/v1/geotechnical/keys", headers=headers)
    assert keys_list_res.status_code == 200
    keys_text = json.dumps(keys_list_res.json())

    # Ensure no full raw key is present in listing
    assert erp_raw_key not in keys_text
    # Ensure internal secret key string from security.py is not present
    assert "super-secret" not in keys_text
    assert "sqlite:///" not in keys_text
