from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])

@router.get("")
def list_audit_logs(
    entity_name: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if entity_name:
        query = query.filter(AuditLog.entity_name == entity_name)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_name": l.entity_name,
            "entity_id": l.entity_id,
            "old_values": l.old_values_json,
            "new_values": l.new_values_json,
            "timestamp": l.timestamp.isoformat()
        }
        for l in logs
    ]
