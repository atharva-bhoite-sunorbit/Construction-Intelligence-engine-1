import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, Activity, ActivityDependency, User, MLDelayPrediction
from backend.app.schemas.all_schemas import (
    ActivityCreate,
    ActivityUpdate,
    ActivityResponse,
    AutoPlanRequest,
    ActivityValidationRequest,
    BatchActivityValidationRequest,
)
from backend.app.services.template_engine import TemplateEngine
from backend.app.services.scheduling_engine import SchedulingEngine
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["Activities"])

@router.post("/api/projects/{project_id}/activities/generate", status_code=status.HTTP_201_CREATED)
def generate_auto_plan(
    project_id: int,
    request: AutoPlanRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    AUTO PLAN ENGINE:
    Generates full multi-level activity tree and logical dependencies based on:
    - Construction type
    - Number of floors and towers
    - Construction template sequence
    Automatically executes baseline CPM scheduling.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clear existing activities & dependencies for fresh generation
    db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).delete()
    db.query(Activity).filter(Activity.project_id == project_id).delete()
    db.commit()

    floors = request.num_floors if request.num_floors is not None else project.num_floors
    towers = request.num_towers if request.num_towers is not None else project.num_towers

    acts, deps = TemplateEngine.generate_plan_for_project(
        project=project,
        num_floors=floors,
        num_towers=towers,
        zones_per_floor=request.zones_per_floor
    )

    for a in acts:
        db.add(a)
    db.flush()

    for d in deps:
        db.add(d)
    db.commit()

    # Recalculate CPM schedule
    sched_info = SchedulingEngine.generate_and_apply_schedule(db, project_id)

    project.status = "IN_PROGRESS"
    db.commit()

    AuditService.log_action(
        db,
        action="GENERATE_AUTO_PLAN",
        entity_name="Project",
        entity_id=str(project_id),
        new_values={"activities_generated": len(acts), "dependencies_generated": len(deps)},
        user_id=current_user.id if current_user else None
    )

    return {
        "message": f"Successfully generated {len(acts)} activities and {len(deps)} dependencies.",
        "activities_count": len(acts),
        "dependencies_count": len(deps),
        "schedule": sched_info
    }

@router.post("/api/projects/{project_id}/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_manual_activity(
    project_id: int,
    activity_in: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """MANUAL PLAN: Add Activity manually."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    act_data = activity_in.model_dump()
    act_data["project_id"] = project_id
    activity = Activity(**act_data)
    db.add(activity)
    db.commit()
    db.refresh(activity)

    AuditService.log_action(
        db,
        action="CREATE",
        entity_name="Activity",
        entity_id=str(activity.id),
        new_values=activity_in.model_dump(mode="json"),
        user_id=current_user.id if current_user else None
    )

    return activity

@router.get("/api/projects/{project_id}/activities", response_model=List[ActivityResponse])
def list_activities(
    project_id: int,
    floor: Optional[int] = Query(None),
    tower: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    critical_only: Optional[bool] = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(Activity).filter(Activity.project_id == project_id)

    if floor is not None:
        query = query.filter(Activity.floor == floor)
    if tower:
        query = query.filter(Activity.tower == tower)
    if phase:
        query = query.filter(Activity.phase == phase)
    if status_filter:
        query = query.filter(Activity.status == status_filter)
    if critical_only:
        query = query.filter(Activity.is_critical == True)
    if search:
        query = query.filter(Activity.name.ilike(f"%{search}%"))

    activities = query.order_by(Activity.floor, Activity.sort_order, Activity.start_date).all()

    # Attach prediction data if available
    preds = {
        p.activity_id: p
        for p in db.query(MLDelayPrediction).filter(MLDelayPrediction.project_id == project_id).all()
    }

    results = []
    for a in activities:
        a_dict = {c.name: getattr(a, c.name) for c in a.__table__.columns}
        if a.id in preds:
            p = preds[a.id]
            a_dict["delay_risk_score"] = p.delay_probability
            a_dict["predicted_delay_days"] = p.predicted_delay_days
            a_dict["risk_level"] = p.risk_level
        results.append(a_dict)

    return results

@router.get("/api/activities/{id}", response_model=ActivityResponse)
def get_activity(id: int, db: Session = Depends(get_db)):
    activity = db.query(Activity).filter(Activity.id == id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    pred = db.query(MLDelayPrediction).filter(MLDelayPrediction.activity_id == id).first()
    a_dict = {c.name: getattr(activity, c.name) for c in activity.__table__.columns}
    if pred:
        a_dict["delay_risk_score"] = pred.delay_probability
        a_dict["predicted_delay_days"] = pred.predicted_delay_days
        a_dict["risk_level"] = pred.risk_level

    return a_dict

@router.put("/api/activities/{id}", response_model=ActivityResponse)
def update_activity(
    id: int,
    activity_update: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    activity = db.query(Activity).filter(Activity.id == id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    old_data = {c.name: getattr(activity, c.name) for c in activity.__table__.columns}
    update_data = activity_update.model_dump(exclude_unset=True)

    for k, v in update_data.items():
        setattr(activity, k, v)

    db.commit()
    db.refresh(activity)

    AuditService.log_action(
        db,
        action="UPDATE",
        entity_name="Activity",
        entity_id=str(id),
        old_values=old_data,
        new_values=update_data,
        user_id=current_user.id if current_user else None
    )

    return get_activity(id, db)

@router.delete("/api/activities/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    activity = db.query(Activity).filter(Activity.id == id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    AuditService.log_action(
        db,
        action="DELETE",
        entity_name="Activity",
        entity_id=str(id),
        user_id=current_user.id if current_user else None
    )

    db.delete(activity)
    db.commit()
    return None

@router.post("/api/activities/{id}/validate", response_model=ActivityResponse)
@router.put("/api/activities/{id}/validate", response_model=ActivityResponse)
def validate_activity(
    id: int,
    req: ActivityValidationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Project Manager 1-click validation (YES/NO):
    - Sets validation_status to 'APPROVED', 'REJECTED', or 'PENDING'
    - Records timestamp and reviewer
    """
    activity = db.query(Activity).filter(Activity.id == id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    validator = (
        current_user.full_name
        if current_user and current_user.full_name
        else (req.validated_by or "Project Manager")
    )

    old_status = activity.validation_status
    activity.validation_status = req.validation_status.upper()
    activity.validated_by = validator
    activity.validated_at = datetime.datetime.utcnow()
    if req.validation_notes is not None:
        activity.validation_notes = req.validation_notes

    db.commit()
    db.refresh(activity)

    AuditService.log_action(
        db,
        action="VALIDATE_ACTIVITY",
        entity_name="Activity",
        entity_id=str(id),
        old_values={"validation_status": old_status},
        new_values={
            "validation_status": activity.validation_status,
            "validated_by": validator,
            "validation_notes": activity.validation_notes,
        },
        user_id=current_user.id if current_user else None
    )

    return get_activity(id, db)

@router.post("/api/projects/{project_id}/activities/bulk-validate")
def bulk_validate_activities(
    project_id: int,
    req: BatchActivityValidationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Bulk validate all activities in a section or selected list:
    - Sets validation_status for multiple activities in one shot
    """
    validator = (
        current_user.full_name
        if current_user and current_user.full_name
        else (req.validated_by or "Project Manager")
    )
    now = datetime.datetime.utcnow()
    status_val = req.validation_status.upper()

    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id, Activity.id.in_(req.activity_ids))
        .all()
    )

    for act in activities:
        act.validation_status = status_val
        act.validated_by = validator
        act.validated_at = now
        if req.validation_notes:
            act.validation_notes = req.validation_notes

    db.commit()

    AuditService.log_action(
        db,
        action="BULK_VALIDATE_ACTIVITIES",
        entity_name="Project",
        entity_id=str(project_id),
        new_values={
            "updated_count": len(activities),
            "status": status_val,
            "validated_by": validator,
            "activity_ids": req.activity_ids,
        },
        user_id=current_user.id if current_user else None
    )

    return {
        "success": True,
        "updated_count": len(activities),
        "validation_status": status_val,
        "validated_by": validator
    }

