from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Notification, Project, User
from backend.app.utils.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class NotificationOut(BaseModel):
    id: int
    project_id: Optional[int]
    project_name: Optional[str] = None
    kind: str
    title: str
    body: Optional[str]
    entity_type: Optional[str]
    entity_id: Optional[int]
    created_at: datetime
    read: bool


class NotificationList(BaseModel):
    unread_count: int
    items: List[NotificationOut]


def _out(n: Notification, names: Optional[dict] = None) -> NotificationOut:
    return NotificationOut(id=n.id, project_id=n.project_id, project_name=(names or {}).get(n.project_id), kind=n.kind, title=n.title, body=n.body, entity_type=n.entity_type,
                           entity_id=n.entity_id, created_at=n.created_at, read=n.read_at is not None)


@router.get("", response_model=NotificationList)
def list_notifications(limit: int = Query(20, ge=1, le=100), unread_only: bool = Query(False),
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    unread = query.filter(Notification.read_at.is_(None)).count()
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    rows = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()
    ids = {n.project_id for n in rows if n.project_id}
    names = {p.id: p.name for p in db.query(Project).filter(Project.id.in_(ids)).all()} if ids else {}
    return NotificationList(unread_count=unread, items=[_out(n, names) for n in rows])


@router.post("/read-all", response_model=NotificationList)
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.read_at.is_(None)).update(
        {"read_at": datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return list_notifications(20, False, db, current_user)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    if n.read_at is None:
        n.read_at = datetime.utcnow()
        db.commit()
    return _out(n)
