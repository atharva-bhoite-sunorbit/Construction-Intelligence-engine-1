from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, ProjectCompletionForecast
from backend.app.services.forecast_service import ForecastService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Completion Forecast"])

@router.get("/completion-forecast")
def get_completion_forecast(project_id: int, db: Session = Depends(get_db)):
    """Returns the latest dynamic completion forecast, accuracy metrics, total months, and historical trend."""
    return ForecastService.calculate_completion_forecast(db, project_id)

@router.post("/completion-forecast/recalculate")
def recalculate_forecast(project_id: int, db: Session = Depends(get_db)):
    """Forces dynamic re-calculation of project completion date combining CPM, progress, and ML."""
    return ForecastService.calculate_completion_forecast(db, project_id)
