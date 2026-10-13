from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import ReadinessTemplate, User
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user

router = APIRouter(prefix="/api/readiness-templates", tags=["Readiness Checks"])
MANAGE_ROLES = {"Admin", "Planning Engineer", "Quality Manager"}


class TemplateIn(BaseModel):
    work_type: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    mandatory: bool = True
    sort_order: int = 0


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    mandatory: Optional[bool] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class TemplateOut(BaseModel):
    id: int
    work_type: str
    name: str
    description: Optional[str]
    mandatory: bool
    sort_order: int
    active: bool


def _require_manager(user: User) -> None:
    if user.role not in MANAGE_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Admin, Planning Engineer or Quality Manager can change readiness checklists")


def _out(t: ReadinessTemplate) -> TemplateOut:
    return TemplateOut(id=t.id, work_type=t.work_type, name=t.name, description=t.description,
                       mandatory=t.mandatory, sort_order=t.sort_order, active=t.active)


@router.get("", response_model=List[TemplateOut])
def list_templates(work_type: Optional[str] = Query(None), include_inactive: bool = Query(False),
                   db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ReadinessTemplate)
    if work_type:
        query = query.filter(ReadinessTemplate.work_type == work_type)
    if not include_inactive:
        query = query.filter(ReadinessTemplate.active == True)  # noqa: E712
    return [_out(t) for t in query.order_by(ReadinessTemplate.work_type, ReadinessTemplate.sort_order, ReadinessTemplate.id)]


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(body: TemplateIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_manager(current_user)
    duplicate = db.query(ReadinessTemplate).filter(
        ReadinessTemplate.work_type == body.work_type, ReadinessTemplate.name == body.name,
        ReadinessTemplate.active == True).first()  # noqa: E712
    if duplicate:
        raise HTTPException(400, "That check already exists for this work type")
    t = ReadinessTemplate(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    AuditService.log_action(db, action="CREATE", entity_name="ReadinessTemplate", entity_id=str(t.id),
                            new_values=body.model_dump(), user_id=current_user.id)
    return _out(t)


@router.patch("/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, body: TemplateUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """Changes apply to tasks created from now on; checks already issued to tasks are not touched."""
    _require_manager(current_user)
    t = db.query(ReadinessTemplate).filter(ReadinessTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    changes = body.model_dump(exclude_unset=True)
    old = {k: getattr(t, k) for k in changes}
    for k, v in changes.items():
        setattr(t, k, v)
    db.commit()
    AuditService.log_action(db, action="UPDATE", entity_name="ReadinessTemplate", entity_id=str(t.id),
                            old_values=old, new_values=changes, user_id=current_user.id)
    return _out(t)
