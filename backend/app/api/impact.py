from typing import Optional
from datetime import date
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
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    eligible_activities = [
        activity
        for activity in activities
        if not any(
            (value or "").strip().lower() == "summary header"
            for value in (activity.category, activity.subcategory, activity.work_package)
        )
    ]
    eligible_ids = [activity.id for activity in eligible_activities]
    if not eligible_ids:
        raise HTTPException(status_code=400, detail="No executable activities in project.")

    # If no activity specified, default to the activity with highest delay prediction
    if not activity_id:
        top_delayed = (
            db.query(MLDelayPrediction)
            .filter(
                MLDelayPrediction.project_id == project_id,
                MLDelayPrediction.activity_id.in_(eligible_ids),
            )
            .order_by(MLDelayPrediction.delay_probability.desc())
            .first()
        )
        if top_delayed:
            activity_id = top_delayed.activity_id
            if delay_days is None:
                delay_days = top_delayed.predicted_delay_days
        else:
            first_act = min(
                eligible_activities,
                key=lambda activity: (
                    activity.baseline_start_date or activity.start_date or date.max,
                    activity.baseline_task_id
                    if activity.baseline_task_id is not None
                    else activity.sort_order or activity.id,
                ),
                default=None,
            )
            if not first_act:
                raise HTTPException(status_code=400, detail="No activities in project.")
            activity_id = first_act.id

    if activity_id not in eligible_ids:
        raise HTTPException(status_code=400, detail="Selected activity is not an executable project activity.")

    if delay_days is None or delay_days <= 0:
        pred = db.query(MLDelayPrediction).filter(MLDelayPrediction.activity_id == activity_id).first()
        delay_days = pred.predicted_delay_days if pred and pred.predicted_delay_days > 0 else 3.0

    return ImpactService.analyze_activity_delay(db, project_id, activity_id, delay_days)
