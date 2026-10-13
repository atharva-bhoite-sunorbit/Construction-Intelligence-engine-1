from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, Project, User
from backend.app.services.attention import activity_detail, build_attention, project_digest
from backend.app.services.sequence import compute_sequence
from backend.app.utils.access import allowed_towers, tower_allowed
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Plan Sequence"])


class PredecessorOut(BaseModel):
    id: int
    name: str
    type: str
    lag_days: int
    done: bool


class SequenceItem(BaseModel):
    activity_id: int
    step: int
    name: str
    tower: Optional[str]
    state: str  # DONE, IN_PROGRESS, READY, WAITING
    waiting_on: List[str]
    predecessors: List[PredecessorOut]
    status: str
    progress_percent: float
    start_date: Optional[date]
    end_date: Optional[date]
    planned_duration: Optional[int]


@router.get("/api/projects/{project_id}/sequence", response_model=List[SequenceItem])
def get_sequence(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Activities in planned order, with what is ready to start and what each one is waiting for."""
    towers = allowed_towers(db, current_user, project_id)
    return [item for item in compute_sequence(db, project_id) if tower_allowed(towers, item["tower"])]


class AttentionItem(BaseModel):
    kind: str
    severity: str
    title: str
    detail: str
    days: int
    tab: str
    entity_type: str
    entity_id: int
    tower: Optional[str]


@router.get("/api/projects/{project_id}/attention", response_model=List[AttentionItem])
def get_attention(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """What needs the signed-in project manager (or, as escalations, the director) to act. Empty for site roles."""
    return build_attention(db, project_id, current_user)


@router.get("/api/projects/{project_id}/digest")
def get_digest(project_id: int, days: int = Query(7, ge=1, le=60), db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """What happened in the last few days, plus planned versus expected finish."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project_digest(db, project, days, allowed_towers(db, current_user, project_id))


@router.get("/api/activities/{activity_id}/detail")
def get_activity_detail(activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """One activity in context: dates against baseline, what it waits for and unlocks, its tasks and problems."""
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    return activity_detail(db, activity)
