"""Today: the look-ahead (today + next 5 working days, with Plan B) and each person's daily checklist."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, User
from backend.app.services.daily_checklist import ChecklistError, checklist, set_step
from backend.app.services.lookahead import build_lookahead
from backend.app.utils.access import allowed_towers
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Today"])


class StepUpdate(BaseModel):
    done: bool


def _project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/api/projects/{project_id}/lookahead")
def lookahead(project_id: int, days: int = Query(5, ge=1, le=14), db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    """The work planned for today and the next working days in the caller's towers, what is stopped, and Plan B."""
    _project(db, project_id)
    return build_lookahead(db, project_id, allowed_towers(db, current_user, project_id), days=days)


@router.get("/api/projects/{project_id}/daily-checklist")
def get_daily_checklist(project_id: int, day: Optional[date] = Query(None), db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    _project(db, project_id)
    return checklist(db, current_user, project_id, day or date.today())


@router.post("/api/projects/{project_id}/daily-checklist/{item_id}")
def tick_daily_step(project_id: int, item_id: int, body: StepUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """Tick (or untick) a step of today's checklist. Steps go in order; unticking clears the steps after it."""
    _project(db, project_id)
    try:
        return set_step(db, current_user, project_id, item_id, body.done)
    except ChecklistError as exc:
        raise HTTPException(exc.status_code, str(exc))
