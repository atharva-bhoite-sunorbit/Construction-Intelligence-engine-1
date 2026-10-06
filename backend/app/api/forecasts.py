from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, ProjectCompletionForecast
from backend.app.services.forecast_service import ForecastService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Completion Forecast"])

@router.get("/completion-forecast")
def get_completion_forecast(project_id: int, db: Session = Depends(get_db)):
    """Returns the latest dynamic completion forecast and historical trend."""
    latest = (
        db.query(ProjectCompletionForecast)
        .filter(ProjectCompletionForecast.project_id == project_id)
        .order_by(ProjectCompletionForecast.id.desc())
        .first()
    )
    if not latest:
        # Generate initial forecast on-the-fly
        return ForecastService.calculate_completion_forecast(db, project_id)

    # Fetch last 10 historical forecasts for trend charting
    history = (
        db.query(ProjectCompletionForecast)
        .filter(ProjectCompletionForecast.project_id == project_id)
        .order_by(ProjectCompletionForecast.forecast_date.asc())
        .limit(10)
        .all()
    )

    return {
        "project_id": project_id,
        "forecast_date": latest.forecast_date.isoformat(),
        "baseline_completion_date": latest.baseline_completion_date.isoformat(),
        "predicted_completion_date": latest.predicted_completion_date.isoformat(),
        "slippage_days": latest.slippage_days,
        "schedule_health_score": latest.schedule_health_score,
        "critical_path_length_days": latest.critical_path_length_days,
        "confidence_interval_days": latest.confidence_interval_days,
        "methodology_notes": latest.methodology_notes,
        "history": [
            {
                "date": h.forecast_date.isoformat(),
                "slippage_days": h.slippage_days,
                "health_score": h.schedule_health_score
            }
            for h in history
        ]
    }

@router.post("/completion-forecast/recalculate")
def recalculate_forecast(project_id: int, db: Session = Depends(get_db)):
    """Forces dynamic re-calculation of project completion date combining CPM, progress, and ML."""
    return ForecastService.calculate_completion_forecast(db, project_id)
