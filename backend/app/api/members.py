from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, ProjectMember, User
from backend.app.services.audit_service import AuditService
from backend.app.utils.access import ALL_SCOPE, has_global_access, member_scopes
from backend.app.utils.security import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/members", tags=["Project Members"])


class MemberCreate(BaseModel):
    user_id: int
    scope: str = Field(default=ALL_SCOPE, min_length=1, max_length=100, description='"ALL" or a tower name, e.g. "Tower A"')


class MemberResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    role: str
    scope: str


def _can_manage(db: Session, user: User, project_id: int) -> bool:
    if user.role == "Admin":
        return True
    return user.role == "Project Manager" and ALL_SCOPE in (member_scopes(db, user, project_id) or set())


def _require_manager(db: Session, user: User, project_id: int) -> None:
    if not _can_manage(db, user, project_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an Admin or the project's Project Manager can manage members")


def _to_response(m: ProjectMember) -> MemberResponse:
    return MemberResponse(id=m.id, user_id=m.user_id, full_name=m.user.full_name, email=m.user.email,
                          role=m.user.role, scope=m.scope)


@router.get("", response_model=List[MemberResponse])
def list_members(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).order_by(ProjectMember.id).all()
    return [_to_response(m) for m in rows]


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(project_id: int, body: MemberCreate, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    _require_manager(db, current_user, project_id)
    if not db.query(Project).filter(Project.id == project_id).first():
        raise HTTPException(404, "Project not found")
    user = db.query(User).filter(User.id == body.user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(404, "User not found")
    scope = body.scope.strip()
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user.id, ProjectMember.scope == scope
    ).first()
    if existing:
        raise HTTPException(400, "This user already has that scope on the project")
    member = ProjectMember(project_id=project_id, user_id=user.id, scope=scope)
    db.add(member)
    db.commit()
    db.refresh(member)
    AuditService.log_action(db, action="CREATE", entity_name="ProjectMember", entity_id=str(member.id),
                            new_values={"project_id": project_id, "user_id": user.id, "scope": scope},
                            user_id=current_user.id)
    return _to_response(member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(project_id: int, member_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    _require_manager(db, current_user, project_id)
    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id, ProjectMember.project_id == project_id
    ).first()
    if not member:
        raise HTTPException(404, "Member not found")
    db.delete(member)
    db.commit()
    AuditService.log_action(db, action="DELETE", entity_name="ProjectMember", entity_id=str(member_id),
                            old_values={"project_id": project_id, "user_id": member.user_id, "scope": member.scope},
                            user_id=current_user.id)
