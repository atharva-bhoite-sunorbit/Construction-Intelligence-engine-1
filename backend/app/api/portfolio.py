from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, Project, ProjectMember, Task, User
from backend.app.services.problems import delay_summary
from backend.app.services.building import parse_level
from backend.app.services.sequence import RUNNING, compute_sequence
from backend.app.utils.access import allowed_towers, has_global_access, tower_allowed
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Portfolio"])
APPROVER_ROLES = {"Project Manager", "Admin"}


class CurrentWork(BaseModel):
    name: str
    towers: List[str]


class PortfolioProject(BaseModel):
    id: int
    name: str
    code: str
    location: Optional[str]
    status: str
    cover_image_url: Optional[str] = None
    current_work: List[CurrentWork] = []
    expected_finish: Optional[date] = None
    planned_start_date: Optional[date]
    target_completion_date: Optional[date]
    activities: int
    progress_percent: float
    late_activities: int
    open_problems: int
    problems_waiting_for_review: int
    largest_confirmed_project_delay_days: float
    pending_approvals: int


def _weighted_progress(activities: List[Activity]) -> float:
    weights = [max(a.planned_duration or 0, 1) for a in activities]
    total = sum(weights)
    if not total:
        return 0.0
    return round(sum((a.progress_percent or 0) * w for a, w in zip(activities, weights)) / total, 1)


@router.get("/api/portfolio", response_model=List[PortfolioProject])
def portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """One line per project the signed-in user belongs to (Admin: all), for the director's overview."""
    query = db.query(Project).filter(Project.status != "ARCHIVED")
    if not has_global_access(current_user):
        mine = db.query(ProjectMember.project_id).filter(ProjectMember.user_id == current_user.id)
        query = query.filter(Project.id.in_(mine))
    today = date.today()
    rows = []
    for p in query.order_by(Project.name).all():
        towers = allowed_towers(db, current_user, p.id)
        acts = [a for a in db.query(Activity).filter(Activity.project_id == p.id).all() if tower_allowed(towers, a.tower)]
        late = [a for a in acts if a.status != "COMPLETED" and (a.progress_percent or 0) < 100 and a.end_date and a.end_date < today]
        summary = delay_summary(db, p.id, towers)
        pending = 0
        if current_user.role in APPROVER_ROLES:
            pending = db.query(Task).filter(Task.project_id == p.id, Task.status == "PENDING_APPROVAL").count()
        running: dict = {}
        for item in compute_sequence(db, p.id):
            if item["state"] == RUNNING and tower_allowed(towers, item["tower"]):
                level = parse_level(item["name"])
                label = f"{level[2]} slab" if level and level[0] != "foundation" else " ".join(item["name"].split()).capitalize()
                running.setdefault(label, [])
                if item["tower"] and item["tower"] not in running[label]:
                    running[label].append(item["tower"])
        current = [CurrentWork(name=n, towers=t) for n, t in list(running.items())[-2:]]  # the latest steps reached
        expected = p.target_completion_date + timedelta(days=round(summary["largest_confirmed_project_delay_days"])) if p.target_completion_date else None
        rows.append(PortfolioProject(
            id=p.id, name=p.name, code=p.code, location=p.location, status=p.status, cover_image_url=p.cover_image_url,
            current_work=current, expected_finish=expected,
            planned_start_date=p.planned_start_date, target_completion_date=p.target_completion_date,
            activities=len(acts), progress_percent=_weighted_progress(acts), late_activities=len(late),
            open_problems=summary["open_problems"], problems_waiting_for_review=summary["waiting_for_review"],
            largest_confirmed_project_delay_days=summary["largest_confirmed_project_delay_days"], pending_approvals=pending,
        ))
    return rows
