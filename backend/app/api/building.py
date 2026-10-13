from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, User
from backend.app.services.building import building_progress
from backend.app.utils.access import allowed_towers
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Building"])


@router.get("/api/projects/{project_id}/building")
def get_building(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Floor-by-floor structural progress per tower, with the building shape (from the drawing when available)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return building_progress(db, project, allowed_towers(db, current_user, project_id))
