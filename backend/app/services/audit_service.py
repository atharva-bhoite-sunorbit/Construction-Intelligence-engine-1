import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from backend.app.models.all_models import AuditLog

class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        entity_name: str,
        entity_id: Optional[str] = None,
        old_values: Optional[Any] = None,
        new_values: Optional[Any] = None,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None
    ):
        try:
            entry = AuditLog(
                user_id=user_id,
                action=action,
                entity_name=entity_name,
                entity_id=str(entity_id) if entity_id else None,
                old_values_json=json.dumps(old_values) if old_values else None,
                new_values_json=json.dumps(new_values) if new_values else None,
                ip_address=ip_address
            )
            db.add(entry)
            db.commit()
        except Exception as e:
            print(f"Failed to record audit log: {e}")
