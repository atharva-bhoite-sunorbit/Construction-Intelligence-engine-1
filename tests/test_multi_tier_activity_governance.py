import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import SessionLocal
from backend.app.models.all_models import Project, Activity, User
from backend.app.utils.security import create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_governance_data():
    db = SessionLocal()
    # Create or fetch test project
    prj = db.query(Project).filter(Project.code == "PRJ-TEST-GOV").first()
    if not prj:
        prj = Project(
            name="Test Governance Tower",
            code="PRJ-TEST-GOV",
            construction_type="Commercial",
            location="Test Site",
            num_floors=3,
            num_towers=1,
            built_up_area=10000.0,
            planned_start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=180),
            status="IN_PROGRESS"
        )
        db.add(prj)
        db.commit()
        db.refresh(prj)

    # Clean existing test activities for this test project
    db.query(Activity).filter(Activity.project_id == prj.id).delete()
    db.commit()

    # 1. Site Manager Activity
    sm_act = Activity(
        project_id=prj.id,
        name="Internal Partition Masonry Blockwork",
        phase="Superstructure",
        work_package="Masonry",
        assigned_role="Site Manager",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=10),
        validation_status="PENDING",
        stage1_status="PENDING",
        pm_verification_status="PENDING",
        final_recorded=False
    )

    # 2. Admin Activity
    adm_act = Activity(
        project_id=prj.id,
        name="Statutory Environmental Clearance & Boundary Survey",
        phase="Pre-Construction",
        work_package="Mobilization",
        assigned_role="Admin",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=5),
        validation_status="PENDING",
        stage1_status="PENDING",
        pm_verification_status="PENDING",
        final_recorded=False
    )

    # 3. Project Manager Activity
    pm_act = Activity(
        project_id=prj.id,
        name="Level 2 Post-Tensioned Suspended Slab Concreting",
        phase="Superstructure",
        work_package="Structure",
        assigned_role="Project Manager",
        is_critical=True,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=7),
        validation_status="PENDING",
        stage1_status="PENDING",
        pm_verification_status="PENDING",
        final_recorded=False
    )

    # 4. Site Engineer Activity (Geotechnical & Excavation)
    se_act = Activity(
        project_id=prj.id,
        name="Geotechnical Borehole Core Drilling & Bulk Pit Excavation",
        phase="Geotech: Pre-Construction",
        work_package="Geotechnical & Excavation",
        assigned_role="Site Engineer",
        code="GX-01",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=6),
        validation_status="PENDING",
        stage1_status="PENDING",
        pm_verification_status="PENDING",
        final_recorded=False
    )

    db.add_all([sm_act, adm_act, pm_act, se_act])
    db.commit()
    db.refresh(sm_act)
    db.refresh(adm_act)
    db.refresh(pm_act)
    db.refresh(se_act)

    yield {
        "project_id": prj.id,
        "sm_act_id": sm_act.id,
        "adm_act_id": adm_act.id,
        "pm_act_id": pm_act.id,
        "se_act_id": se_act.id
    }
    db.close()


def test_site_manager_validates_own_activity(setup_governance_data):
    act_id = setup_governance_data["sm_act_id"]
    token = create_access_token({"sub": "sm@construction.ai", "role": "Site Manager"})

    # Site manager validates their own activity
    res = client.post(
        f"/api/activities/{act_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Site Manager",
            "validated_by": "Elena Rostova (Site Manager)",
            "validation_notes": "Plaster lines and blockwork geometry inspected."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["stage1_status"] == "APPROVED"
    assert data["validation_status"] == "AWAITING_PM_VERIFICATION"
    assert data["final_recorded"] is False  # Must await PM verification!


def test_site_manager_cannot_validate_admin_or_pm(setup_governance_data):
    adm_id = setup_governance_data["adm_act_id"]
    token = create_access_token({"sub": "sm@construction.ai", "role": "Site Manager"})

    res = client.post(
        f"/api/activities/{adm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Site Manager",
            "validation_notes": "Should be rejected"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403
    assert "Site Manager can validate only Site Manager activities" in res.json()["detail"]


def test_admin_validates_own_activity(setup_governance_data):
    adm_id = setup_governance_data["adm_act_id"]
    token = create_access_token({"sub": "admin@construction.ai", "role": "Admin"})

    res = client.post(
        f"/api/activities/{adm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Admin",
            "validated_by": "Alexander Vance (Admin)",
            "validation_notes": "All permits signed and recorded."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["stage1_status"] == "APPROVED"
    assert data["validation_status"] == "AWAITING_PM_VERIFICATION"
    assert data["final_recorded"] is False


def test_admin_cannot_validate_sm_activity(setup_governance_data):
    sm_id = setup_governance_data["sm_act_id"]
    token = create_access_token({"sub": "admin@construction.ai", "role": "Admin"})

    res = client.post(
        f"/api/activities/{sm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Admin",
            "validation_notes": "Should be rejected"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403
    assert "Admin can validate Admin statutory activities" in res.json()["detail"]


def test_pm_verifies_stage1_validated_activities(setup_governance_data):
    sm_id = setup_governance_data["sm_act_id"]
    token = create_access_token({"sub": "pm@construction.ai", "role": "Project Manager"})

    # PM verifies SM activity that was already approved in Stage 1
    res = client.post(
        f"/api/activities/{sm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Project Manager",
            "action_type": "PM_VERIFY",
            "validated_by": "Marcus Brody (Project Manager)",
            "validation_notes": "Countersigned and verified against structural model."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["pm_verification_status"] == "VERIFIED"
    assert data["final_recorded"] is True  # Officially recorded!
    assert data["validation_status"] == "RECORDED"


def test_pm_validates_direct_activity(setup_governance_data):
    pm_id = setup_governance_data["pm_act_id"]
    token = create_access_token({"sub": "pm@construction.ai", "role": "Project Manager"})

    res = client.post(
        f"/api/activities/{pm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Project Manager",
            "validated_by": "Marcus Brody (Project Manager)",
            "validation_notes": "Pre-pour inspection passed. Concrete mix approved."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["final_recorded"] is True  # PM direct is recorded immediately!
    assert data["validation_status"] == "RECORDED"


def test_site_engineer_validates_geotech_excavation_activity(setup_governance_data):
    se_id = setup_governance_data["se_act_id"]
    token = create_access_token({"sub": "eng@construction.ai", "role": "Site Engineer"})

    # Site Engineer validates Geotechnical & Excavation activity
    res = client.post(
        f"/api/activities/{se_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Site Engineer",
            "validated_by": "Liam Chen (Site Engineer)",
            "validation_notes": "Borelog core samples verified. SPT N=28 confirms hard stratum. Ready for Admin sign-off."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["stage1_status"] == "APPROVED"
    assert data["validation_status"] == "AWAITING_ADMIN_VERIFICATION"
    assert data["final_recorded"] is False  # Mandatory Gate: Not recorded until Admin verifies!


def test_site_engineer_cannot_validate_sm_activity(setup_governance_data):
    sm_id = setup_governance_data["sm_act_id"]
    token = create_access_token({"sub": "eng@construction.ai", "role": "Site Engineer"})

    res = client.post(
        f"/api/activities/{sm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Site Engineer",
            "validation_notes": "Should fail - only geotech/excavation allowed"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403
    assert "Site Engineer can validate only Geotechnical and Excavation activities" in res.json()["detail"]


def test_admin_verifies_site_engineer_activity(setup_governance_data):
    se_id = setup_governance_data["se_act_id"]
    token = create_access_token({"sub": "admin@construction.ai", "role": "Admin"})

    # Admin verifies the Site Engineer's geotech activity (Stage 2)
    res = client.post(
        f"/api/activities/{se_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Admin",
            "validated_by": "Alexander Vance (Admin)",
            "validation_notes": "Statutory excavation clearance and soil borelog verified. Officially recorded."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["pm_verification_status"] == "VERIFIED"
    assert data["final_recorded"] is True  # Officially recorded by Admin!
    assert data["validation_status"] == "RECORDED"


def test_top_management_read_only_and_summary(setup_governance_data):
    prj_id = setup_governance_data["project_id"]
    sm_id = setup_governance_data["sm_act_id"]
    token = create_access_token({"sub": "exec@construction.ai", "role": "Top Management"})

    # Top management cannot validate directly
    res_val = client.post(
        f"/api/activities/{sm_id}/validate",
        json={
            "validation_status": "APPROVED",
            "validator_role": "Top Management",
            "validation_notes": "Attempting validation"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_val.status_code == 403
    assert "Top Management role has executive read-only oversight" in res_val.json()["detail"]

    # Top management views governance summary
    res_sum = client.get(
        f"/api/projects/{prj_id}/activities/governance-summary",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_sum.status_code == 200
    summary = res_sum.json()
    assert summary["project_id"] == prj_id
    assert summary["total_activities"] == 4
    assert summary["final_recorded_count"] >= 3  # sm_id verified + pm_id validated + se_id verified
    assert "Site Engineer" in summary["roles"]
    assert "Site Manager" in summary["roles"]
    assert "Admin" in summary["roles"]
    assert "Project Manager" in summary["roles"]
    assert len(summary["recent_verifications"]) > 0
