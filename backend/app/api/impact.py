from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, MLDelayPrediction
from backend.app.services.impact_service import ImpactService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Impact Analysis"])

@router.get("/impact-analysis")
def get_impact_analysis(
    project_id: int,
    activity_id: Optional[int] = Query(None),
    delay_days: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Cascading Delay Propagation Engine:
    Traces downstream dependency pathways from a delayed activity, calculates float absorption,
    and returns all affected activities, cascade chain, severity level, and overall project finish slippage.
    """
    # If no activity specified, default to the activity with highest delay prediction
    if not activity_id:
        top_delayed = (
            db.query(MLDelayPrediction)
            .filter(MLDelayPrediction.project_id == project_id)
            .order_by(MLDelayPrediction.delay_probability.desc())
            .first()
        )
        if top_delayed:
            activity_id = top_delayed.activity_id
            if delay_days is None:
                delay_days = top_delayed.predicted_delay_days
        else:
            first_act = db.query(Activity).filter(Activity.project_id == project_id).first()
            if not first_act:
                raise HTTPException(status_code=400, detail="No activities in project.")
            activity_id = first_act.id

    if delay_days is None or delay_days <= 0:
        pred = db.query(MLDelayPrediction).filter(MLDelayPrediction.activity_id == activity_id).first()
        delay_days = pred.predicted_delay_days if pred and pred.predicted_delay_days > 0 else 3.0

    return ImpactService.analyze_activity_delay(db, project_id, activity_id, delay_days)
