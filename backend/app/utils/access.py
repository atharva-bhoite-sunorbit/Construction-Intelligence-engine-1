"""Project membership and tower/wing scope checks.

Rules
- Admin can reach every project.
- Everyone else, including Top Management (a director can hold several projects), must be a member of the project
  (a row in project_members). Directors are read-only because the handlers refuse them writes.
- A member's scope is "ALL" or a set of tower names. Activities in those towers, and shared activities
  (tower "Common" / "All"), are visible to them; other towers answer 403.
"""
import re
from typing import Iterable, Optional, Set

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import (
    Activity, ActivityDependency, AIRecommendation, Blocker, DailyProgress, GeotechnicalReport,
    ProjectMember, Resource, Task, User,
)
from backend.app.utils.security import get_current_user

ALL_SCOPE = "ALL"
SHARED_TOWERS = {"Common", "All"}
GLOBAL_ROLES = {"Admin"}


def has_global_access(user: User) -> bool:
    return user.role in GLOBAL_ROLES


def member_scopes(db: Session, user: User, project_id: int) -> Optional[Set[str]]:
    """None when the user is not a member; otherwise their scopes (may contain ALL)."""
    rows = (
        db.query(ProjectMember.scope)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .all()
    )
    return {r[0] for r in rows} if rows else None


def allowed_towers(db: Session, user: User, project_id: int) -> Optional[Set[str]]:
    """None means every tower; otherwise the towers the user may see. Raises 403 for non-members."""
    if has_global_access(user):
        return None
    scopes = member_scopes(db, user, project_id)
    if scopes is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this project")
    if ALL_SCOPE in scopes:
        return None
    return set(scopes)


def tower_allowed(towers: Optional[Iterable[str]], tower: Optional[str]) -> bool:
    if towers is None or tower is None or tower in SHARED_TOWERS:
        return True
    return tower in towers


def assert_project_access(db: Session, user: User, project_id: int, tower: Optional[str] = None) -> None:
    towers = allowed_towers(db, user, project_id)
    if not tower_allowed(towers, tower):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your access does not include {tower}")


def assert_activity_access(db: Session, user: User, activity: Activity) -> None:
    assert_project_access(db, user, activity.project_id, activity.tower)


def _activity_scope(db: Session, activity_id: Optional[int]):
    activity = db.query(Activity).filter(Activity.id == activity_id).first() if activity_id else None
    return (activity.project_id, activity.tower) if activity else (None, None)


_ACTIVITY_PATH = re.compile(r"^/api/activities/(\d+)(?:/|$)")
_BY_MODEL = (
    (re.compile(r"^/api/blockers/(\d+)(?:/|$)"), Blocker),
    (re.compile(r"^/api/dependencies/(\d+)(?:/|$)"), ActivityDependency),
    (re.compile(r"^/api/resources/(\d+)(?:/|$)"), Resource),
    (re.compile(r"^/api/ai/recommendations/(\d+)(?:/|$)"), AIRecommendation),
    (re.compile(r"^/api/geotechnical/(\d+)(?:/|$)"), GeotechnicalReport),
    (re.compile(r"^/api/progress/(\d+)(?:/|$)"), DailyProgress),
    (re.compile(r"^/api/tasks/(\d+)(?:/|$)"), Task),
    (re.compile(r"^/api/problems/(\d+)(?:/|$)"), Blocker),
)


def resolve_scope(request: Request, db: Session):
    """(project_id, tower) the request is about, or (None, None) when it names no project."""
    path = request.url.path
    params = request.path_params
    if "project_id" in params:
        return int(params["project_id"]), None
    if path.startswith("/api/projects/") and "id" in params:
        return int(params["id"]), None
    m = _ACTIVITY_PATH.match(path)
    if m:
        return _activity_scope(db, int(m.group(1)))
    for pattern, model in _BY_MODEL:
        m = pattern.match(path)
        if m:
            row = db.query(model).filter(model.id == int(m.group(1))).first()
            if row is None:
                return None, None
            tower = getattr(row, "tower", None)
            if tower is None and getattr(row, "activity_id", None):
                _, tower = _activity_scope(db, row.activity_id)
            return row.project_id, tower
    q = request.query_params.get("project_id")
    if q and q.isdigit():
        return int(q), None
    return None, None


def enforce_project_access(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Router-level guard: the caller must belong to the project (and tower) the request is about."""
    project_id, tower = resolve_scope(request, db)
    if project_id is None:
        return
    assert_project_access(db, user, project_id, tower)
