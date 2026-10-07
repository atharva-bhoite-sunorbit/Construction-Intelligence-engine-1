"""
Seed script/helper to provision initial demonstration API keys for external systems
(e.g., Construction ERP, Civil PMIS).
"""
import sys
import os
from sqlalchemy.orm import Session
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.all_models import GeotechAPIKey
from backend.app.services.geotech_auth_service import GeotechAuthService


DEMO_ERP_KEY = "geo_live_construction_erp_demo_secret_token_998877"


def seed_geotech_api_keys(db: Session = None) -> dict:
    close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close = True

    try:
        # Check if already seeded
        existing = db.query(GeotechAPIKey).filter(GeotechAPIKey.client_name == "Construction ERP").first()
        if existing:
            return {
                "client_name": existing.client_name,
                "tenant_id": existing.tenant_id,
                "key_id": existing.key_id,
                "key_prefix": existing.key_prefix,
                "status": existing.status
            }

        # Provision Construction ERP key
        key_record, raw_key = GeotechAuthService.create_api_key(
            db=db,
            client_name="Construction ERP",
            tenant_id="tenant_erp_01",
            permissions=[
                "geotechnical:upload",
                "geotechnical:read",
                "geotechnical:analyze",
                "geotechnical:alerts",
                "geotechnical:recommendations",
                "geotechnical:admin"
            ],
            environment="production",
            expiry_days=365,
            rate_limit_per_minute=120,
            created_by="Platform Admin",
            description="Primary API Key for external Construction ERP integration."
        )

        return {
            "client_name": key_record.client_name,
            "tenant_id": key_record.tenant_id,
            "key_id": key_record.key_id,
            "api_key": raw_key,
            "key_prefix": key_record.key_prefix,
            "status": key_record.status
        }
    finally:
        if close:
            db.close()


if __name__ == "__main__":
    result = seed_geotech_api_keys()
    print("Provisioned Geotech API Key:")
    for k, v in result.items():
        print(f"  {k}: {v}")
