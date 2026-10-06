import json
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import DailyProgress, Activity, Project, User, Blocker, SiteObservation
from backend.app.schemas.all_schemas import (
    DailyProgressCreate, DailyProgressResponse,
    BlockerCreate, BlockerUpdate, BlockerResponse,
    SiteObservationCreate, SiteObservationResponse,
    ValidationChecklistSubmission
)
from backend.app.services.progress_service import ProgressService
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["Monitoring & Daily Progress"])

@router.post("/api/progress", response_model=DailyProgressResponse, status_code=status.HTTP_201_CREATED)
def submit_daily_progress(
    progress_in: DailyProgressCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Submits daily site progress update.
    Calculates Daily Productivity, Cumulative Productivity, Progress Variance %, Shortages,
    and automatically updates Activity completion percentage and status.
    """
    activity = db.query(Activity).filter(Activity.id == progress_in.activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    record = ProgressService.record_daily_progress(
        db=db,
        project_id=activity.project_id,
        activity_id=progress_in.activity_id,
        report_date=progress_in.report_date,
        planned_quantity=progress_in.planned_quantity,
        actual_quantity=progress_in.actual_quantity,
        workers_available=progress_in.workers_available,
        workers_assigned=progress_in.workers_assigned,
        working_hours=progress_in.working_hours,
        material_availability_percent=progress_in.material_availability_percent,
        equipment_availability_percent=progress_in.equipment_availability_percent,
        issues=progress_in.issues,
        remarks=progress_in.remarks,
        weather=progress_in.weather,
        user_id=current_user.id if current_user else None
    )

    AuditService.log_action(
        db,
        action="RECORD_PROGRESS",
        entity_name="DailyProgress",
        entity_id=str(record.id),
        new_values=progress_in.model_dump(mode="json"),
        user_id=current_user.id if current_user else None
    )

    res_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
    res_dict["activity_name"] = activity.name
    return res_dict

@router.get("/api/projects/{project_id}/progress", response_model=List[DailyProgressResponse])
def list_daily_progress(project_id: int, db: Session = Depends(get_db)):
    progress_entries = (
        db.query(DailyProgress)
        .filter(DailyProgress.project_id == project_id)
        .order_by(DailyProgress.report_date.desc(), DailyProgress.id.desc())
        .all()
    )
    act_map = {a.id: a.name for a in db.query(Activity).filter(Activity.project_id == project_id).all()}

    results = []
    for p in progress_entries:
        p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        p_dict["activity_name"] = act_map.get(p.activity_id, "Unknown")
        results.append(p_dict)
    return results

@router.post("/api/progress/{progress_id}/validate", response_model=DailyProgressResponse)
def validate_daily_progress(
    progress_id: int,
    val_in: ValidationChecklistSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Manager validates daily site progress using the interactive verification checklist.
    Sets validation status (VALIDATED, CONDITIONAL, REJECTED), validated_by, timestamp,
    checklist results, and notes.
    """
    prog = db.query(DailyProgress).filter(DailyProgress.id == progress_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Daily progress record not found")

    old_status = prog.validation_status
    prog.validation_status = val_in.overall_decision
    prog.validated_by = val_in.validated_by
    prog.validated_at = datetime.utcnow()
    prog.validation_checklist_json = json.dumps([item.model_dump() for item in val_in.checklist_items])
    prog.validation_notes = val_in.validation_notes

    db.commit()
    db.refresh(prog)

    AuditService.log_action(
        db,
        action="VALIDATE_PROGRESS_REPORT",
        entity_name="DailyProgress",
        entity_id=str(prog.id),
        old_values={"validation_status": old_status},
        new_values=val_in.model_dump(mode="json"),
        user_id=current_user.id if current_user else None
    )

    act = db.query(Activity).filter(Activity.id == prog.activity_id).first()
    res_dict = {c.name: getattr(prog, c.name) for c in prog.__table__.columns}
    res_dict["activity_name"] = act.name if act else "Unknown"
    return res_dict

@router.get("/api/projects/{project_id}/today-site-control")
def get_today_site_activities(project_id: int, db: Session = Depends(get_db)):
    """
    DAILY SITE CONTROL CENTER:
    Returns activities scheduled or active today, enabling the site manager to rapidly
    inspect and record progress, workers assigned, materials, and equipment.
    """
    today = date.today()
    activities = (
        db.query(Activity)
        .filter(
            Activity.project_id == project_id,
            Activity.status.in_(["IN_PROGRESS", "DELAYED", "NOT_STARTED"])
        )
        .order_by(Activity.floor, Activity.sort_order)
        .all()
    )

    rows = []
    for a in activities:
        latest_prog = (
            db.query(DailyProgress)
            .filter(DailyProgress.activity_id == a.id)
            .order_by(DailyProgress.report_date.desc())
            .first()
        )
        rows.append({
            "activity_id": a.id,
            "activity_name": a.name,
            "code": a.code,
            "phase": a.phase,
            "floor": a.floor,
            "tower": a.tower,
            "quantity": a.quantity,
            "unit": a.unit,
            "progress_percent": a.progress_percent,
            "status": a.status,
            "is_critical": a.is_critical,
            "required_labour": a.required_labour,
            "required_material": a.required_material,
            "required_equipment": a.required_equipment,
            "latest_actual_qty": latest_prog.actual_quantity if latest_prog else 0.0,
            "latest_workers_assigned": latest_prog.workers_assigned if latest_prog else a.required_labour,
            "latest_daily_productivity": latest_prog.daily_productivity if latest_prog else 0.0,
            "latest_variance_pct": latest_prog.progress_variance_percent if latest_prog else 0.0,
            "latest_issues": latest_prog.issues if latest_prog else None,
            "start_date": a.start_date.isoformat(),
            "end_date": a.end_date.isoformat(),
        })

    return {
        "project_id": project_id,
        "date": today.isoformat(),
        "total_active_workfronts": len(rows),
        "activities": rows
    }

# Blocker endpoints
@router.post("/api/projects/{project_id}/blockers", response_model=BlockerResponse, status_code=status.HTTP_201_CREATED)
def report_blocker(
    project_id: int,
    blocker_in: BlockerCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    b_data = blocker_in.model_dump()
    b_data["project_id"] = project_id
    b_data["reported_by_user_id"] = current_user.id if current_user else None
    blocker = Blocker(**b_data)
    db.add(blocker)
    db.commit()
    db.refresh(blocker)

    AuditService.log_action(
        db,
        action="REPORT_BLOCKER",
        entity_name="Blocker",
        entity_id=str(blocker.id),
        new_values=blocker_in.model_dump(mode="json"),
        user_id=current_user.id if current_user else None
    )

    act = db.query(Activity).filter(Activity.id == blocker.activity_id).first() if blocker.activity_id else None
    b_dict = {c.name: getattr(blocker, c.name) for c in blocker.__table__.columns}
    b_dict["activity_name"] = act.name if act else None
    return b_dict

@router.get("/api/projects/{project_id}/blockers", response_model=List[BlockerResponse])
def list_blockers(project_id: int, db: Session = Depends(get_db)):
    blockers = (
        db.query(Blocker)
        .filter(Blocker.project_id == project_id)
        .order_by(Blocker.status.asc(), Blocker.opened_date.desc())
        .all()
    )
    act_map = {a.id: a.name for a in db.query(Activity).filter(Activity.project_id == project_id).all()}

    results = []
    for b in blockers:
        b_dict = {c.name: getattr(b, c.name) for c in b.__table__.columns}
        b_dict["activity_name"] = act_map.get(b.activity_id) if b.activity_id else None
        results.append(b_dict)
    return results

@router.put("/api/blockers/{id}", response_model=BlockerResponse)
def update_blocker(
    id: int,
    b_update: BlockerUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    blocker = db.query(Blocker).filter(Blocker.id == id).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

    old_data = {c.name: getattr(blocker, c.name) for c in blocker.__table__.columns}
    update_data = b_update.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(blocker, k, v)
    db.commit()
    db.refresh(blocker)

    AuditService.log_action(
        db,
        action="UPDATE_BLOCKER",
        entity_name="Blocker",
        entity_id=str(id),
        old_values=old_data,
        new_values=update_data,
        user_id=current_user.id if current_user else None
    )

    act = db.query(Activity).filter(Activity.id == blocker.activity_id).first() if blocker.activity_id else None
    b_dict = {c.name: getattr(blocker, c.name) for c in blocker.__table__.columns}
    b_dict["activity_name"] = act.name if act else None
    return b_dict

# Site Photo Observation endpoints
@router.post("/api/projects/{project_id}/photos", response_model=SiteObservationResponse, status_code=status.HTTP_201_CREATED)
def upload_site_photo(
    project_id: int,
    photo_in: SiteObservationCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    p_data = photo_in.model_dump()
    p_data["project_id"] = project_id
    p_data["uploaded_by_user_id"] = current_user.id if current_user else None
    p_data["verification_status"] = "PENDING_REVIEW"
    obs = SiteObservation(**p_data)
    db.add(obs)
    db.commit()
    db.refresh(obs)

    act = db.query(Activity).filter(Activity.id == obs.activity_id).first() if obs.activity_id else None
    o_dict = {c.name: getattr(obs, c.name) for c in obs.__table__.columns}
    o_dict["activity_name"] = act.name if act else None
    return o_dict

@router.get("/api/projects/{project_id}/photos", response_model=List[SiteObservationResponse])
def list_site_photos(project_id: int, db: Session = Depends(get_db)):
    obs_list = (
        db.query(SiteObservation)
        .filter(SiteObservation.project_id == project_id)
        .order_by(SiteObservation.date.desc())
        .all()
    )
    act_map = {a.id: a.name for a in db.query(Activity).filter(Activity.project_id == project_id).all()}
    results = []
    for o in obs_list:
        o_dict = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        o_dict["activity_name"] = act_map.get(o.activity_id) if o.activity_id else None
        results.append(o_dict)
    return results
