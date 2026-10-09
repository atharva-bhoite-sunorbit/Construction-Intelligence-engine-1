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
    assigned_role: Optional[str] = Query(None),
    validation_status: Optional[str] = Query(None),
    final_recorded: Optional[bool] = Query(None),
    awaiting_pm_verification: Optional[bool] = Query(None),
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
    if assigned_role:
        query = query.filter(Activity.assigned_role == assigned_role)
    if validation_status:
        query = query.filter(Activity.validation_status == validation_status)
    if final_recorded is not None:
        query = query.filter(Activity.final_recorded == final_recorded)
    if awaiting_pm_verification:
        query = query.filter(
            (Activity.validation_status == "AWAITING_PM_VERIFICATION") |
            ((Activity.stage1_status == "APPROVED") & (Activity.final_recorded == False) & (Activity.assigned_role != "Project Manager"))
        )

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

def _resolve_caller_role(current_user: Optional[User], validator_role: Optional[str], validated_by: Optional[str]) -> str:
    if validator_role and validator_role.strip():
        vr = validator_role.strip().lower()
        if vr in ["site engineer", "engineer", "site_engineer", "geotech engineer", "geotechnical engineer"]:
            return "Site Engineer"
        if vr in ["site manager", "manager", "site_manager"]:
            return "Site Manager"
        if vr in ["admin", "administrator"]:
            return "Admin"
        if vr in ["project manager", "pm", "project_manager"]:
            return "Project Manager"
        if vr in ["top management", "executive", "director", "top_management"]:
            return "Top Management"
        return validator_role.strip()
    if current_user and current_user.role:
        r = current_user.role.strip().lower()
        if "engineer" in r:
            return "Site Engineer"
        if "manager" in r and "project" not in r:
            return "Site Manager"
        if "project" in r or "pm" in r:
            return "Project Manager"
        if "admin" in r:
            return "Admin"
        if "top" in r or "management" in r or "executive" in r:
            return "Top Management"
        return current_user.role.strip()
    vb = (validated_by or "").lower()
    if "engineer" in vb:
        return "Site Engineer"
    if "top management" in vb or "executive" in vb or "director" in vb:
        return "Top Management"
    if "admin" in vb:
        return "Admin"
    if "project manager" in vb or "(pm" in vb or " pm" in vb:
        return "Project Manager"
    if "site manager" in vb or "manager" in vb:
        return "Site Manager"
    return "Site Manager"

def _resolve_validator_name(current_user: Optional[User], validated_by: Optional[str], role: str) -> str:
    if current_user and current_user.full_name:
        return f"{current_user.full_name} ({current_user.role})"
    if validated_by and validated_by.strip():
        return validated_by.strip()
    if role == "Site Engineer":
        return "Liam Chen (Site Engineer)"
    if role == "Site Manager":
        return "Elena Rostova (Site Manager)"
    if role == "Admin":
        return "Alexander Vance (Admin)"
    if role == "Project Manager":
        return "Marcus Brody (Project Manager)"
    if role == "Top Management":
        return "Sophia Sterling (Top Management)"
    return f"Authorized {role}"

def _apply_validation_decision(
    activity: Activity,
    status_val: str,
    action_type: Optional[str],
    caller_role: str,
    validator_name: str,
    notes: Optional[str]
):
    now = datetime.datetime.utcnow()
    decision = status_val.upper()

    # Reset option
    if action_type == "RESET" or decision == "PENDING":
        activity.validation_status = "PENDING"
        activity.stage1_status = "PENDING"
        activity.stage1_validated_by = None
        activity.stage1_validated_at = None
        activity.stage1_notes = None
        activity.pm_verification_status = "PENDING"
        activity.pm_verified_by = None
        activity.pm_verified_at = None
        activity.pm_verification_notes = None
        activity.final_recorded = False
        activity.validated_by = None
        activity.validated_at = None
        activity.validation_notes = None
        return

    # Top Management: Read-only oversight
    if caller_role == "Top Management":
        raise HTTPException(
            status_code=403,
            detail="Top Management role has executive read-only oversight. Geotechnical and excavation activities are validated by Site Engineer and verified by Admin. Field tasks are validated by Site Manager and verified by Project Manager."
        )

    # Site Engineer validation: Geotechnical & Excavation Tasks (Stage 1 -> Awaiting Admin Verification)
    if caller_role in ["Site Engineer", "Engineer"]:
        is_se_task = (
            activity.assigned_role in ["Site Engineer", "Engineer"] or
            "geotech" in (activity.work_package or "").lower() or
            "excavation" in (activity.work_package or "").lower() or
            "geotech" in (activity.phase or "").lower() or
            (activity.code or "").upper().startswith("GX-")
        )
        if not is_se_task:
            raise HTTPException(
                status_code=403,
                detail=f"Action Forbidden: Site Engineer can validate only Geotechnical and Excavation activities. This activity is assigned to '{activity.assigned_role}'."
            )
        if action_type in ["PM_VERIFY", "ADMIN_VERIFY"]:
            raise HTTPException(
                status_code=403,
                detail="Action Forbidden: Only Admin has authority to perform Stage 2 Final Verification on Site Engineer activities."
            )
        if decision in ["APPROVED", "YES"]:
            activity.stage1_status = "APPROVED"
            activity.stage1_validated_by = validator_name
            activity.stage1_validated_at = now
            activity.stage1_notes = notes or "Validated by Site Engineer (Geotechnical & Excavation Gate). Forwarded to Admin for final verification."
            activity.validation_status = "AWAITING_ADMIN_VERIFICATION"
            activity.final_recorded = False  # MANDATORY GATE: NOT RECORDED UNTIL ADMIN VERIFIES
            activity.validated_by = validator_name
            activity.validated_at = now
            activity.validation_notes = activity.stage1_notes
        elif decision in ["REJECTED", "NO"]:
            activity.stage1_status = "REJECTED"
            activity.stage1_validated_by = validator_name
            activity.stage1_validated_at = now
            activity.stage1_notes = notes or "Rejected by Site Engineer."
            activity.validation_status = "REJECTED"
            activity.final_recorded = False
            activity.validated_by = validator_name
            activity.validated_at = now
            activity.validation_notes = activity.stage1_notes
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")

    # Site Manager validation: Field Operations & Superstructure (Stage 1 -> Awaiting PM Verification)
    elif caller_role in ["Site Manager", "Manager"]:
        if activity.assigned_role not in ["Site Manager", "Manager"]:
            raise HTTPException(
                status_code=403,
                detail=f"Action Forbidden: Site Manager can validate only Site Manager activities. This activity is assigned to '{activity.assigned_role}'."
            )
        if action_type == "PM_VERIFY":
            raise HTTPException(
                status_code=403,
                detail="Action Forbidden: Only Project Manager has authority to perform Stage 2 PM Verification."
            )
        if decision in ["APPROVED", "YES"]:
            activity.stage1_status = "APPROVED"
            activity.stage1_validated_by = validator_name
            activity.stage1_validated_at = now
            activity.stage1_notes = notes or "Validated by Site Manager. Awaiting Project Manager verification."
            activity.validation_status = "AWAITING_PM_VERIFICATION"
            activity.final_recorded = False  # MANDATORY GATE: NOT RECORDED UNTIL PM VERIFIES
            activity.validated_by = validator_name
            activity.validated_at = now
            activity.validation_notes = activity.stage1_notes
        elif decision in ["REJECTED", "NO"]:
            activity.stage1_status = "REJECTED"
            activity.stage1_validated_by = validator_name
            activity.stage1_validated_at = now
            activity.stage1_notes = notes or "Rejected by Site Manager."
            activity.validation_status = "REJECTED"
            activity.final_recorded = False
            activity.validated_by = validator_name
            activity.validated_at = now
            activity.validation_notes = activity.stage1_notes
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")

    # Admin validation & Verification
    elif caller_role == "Admin":
        is_se_task = (
            activity.assigned_role in ["Site Engineer", "Engineer"] or
            "geotech" in (activity.work_package or "").lower() or
            "excavation" in (activity.work_package or "").lower() or
            (activity.code or "").upper().startswith("GX-")
        )

        if is_se_task:
            # Stage 2 Final Verification of Site Engineer's Geotechnical/Excavation Task
            if activity.stage1_status != "APPROVED" and decision in ["APPROVED", "VERIFIED", "YES"]:
                raise HTTPException(
                    status_code=400,
                    detail="Gate Restriction: Activity is assigned to Site Engineer. It must first be validated and approved by Site Engineer before Admin can verify and record it."
                )
            if decision in ["APPROVED", "VERIFIED", "YES"]:
                activity.pm_verification_status = "VERIFIED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or "Verified & countersigned by Admin after Site Engineer geotechnical validation. Officially recorded."
                activity.final_recorded = True  # MANDATORY GATE: OFFICIALLY RECORDED ONLY UPON ADMIN VERIFICATION!
                activity.validation_status = "RECORDED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            elif decision in ["REJECTED", "NO"]:
                activity.pm_verification_status = "REJECTED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or "Rejected / Remanded by Admin back to Site Engineer."
                activity.final_recorded = False
                activity.validation_status = "REJECTED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")

        elif activity.assigned_role == "Admin":
            # Stage 1 Validation of Admin's own Statutory / Compliance tasks -> forwards to PM
            if action_type == "PM_VERIFY":
                raise HTTPException(
                    status_code=403,
                    detail="Action Forbidden: Only Project Manager has authority to perform Stage 2 PM Verification on Admin statutory activities."
                )
            if decision in ["APPROVED", "YES"]:
                activity.stage1_status = "APPROVED"
                activity.stage1_validated_by = validator_name
                activity.stage1_validated_at = now
                activity.stage1_notes = notes or "Validated by Admin. Awaiting Project Manager verification."
                activity.validation_status = "AWAITING_PM_VERIFICATION"
                activity.final_recorded = False  # MANDATORY GATE: NOT RECORDED UNTIL PM VERIFIES
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.stage1_notes
            elif decision in ["REJECTED", "NO"]:
                activity.stage1_status = "REJECTED"
                activity.stage1_validated_by = validator_name
                activity.stage1_validated_at = now
                activity.stage1_notes = notes or "Rejected by Admin."
                activity.validation_status = "REJECTED"
                activity.final_recorded = False
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.stage1_notes
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")
        else:
            raise HTTPException(
                status_code=403,
                detail=f"Action Forbidden: Admin can validate Admin statutory activities or perform final verification on Site Engineer geotechnical/excavation activities. This activity is assigned to '{activity.assigned_role}'."
            )

    # Project Manager validation & Stage 2 verification gate
    elif caller_role == "Project Manager":
        if activity.assigned_role == "Project Manager":
            # PM Direct activity
            if decision in ["APPROVED", "VERIFIED", "YES"]:
                activity.stage1_status = "APPROVED"
                activity.stage1_validated_by = validator_name
                activity.stage1_validated_at = now
                activity.stage1_notes = notes or "Direct structural validation by Project Manager."
                activity.pm_verification_status = "VERIFIED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or "Direct structural sign-off by Project Manager."
                activity.final_recorded = True  # DIRECT PM ACTIVITY RECORDED
                activity.validation_status = "RECORDED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            elif decision in ["REJECTED", "NO"]:
                activity.stage1_status = "REJECTED"
                activity.stage1_validated_by = validator_name
                activity.stage1_validated_at = now
                activity.stage1_notes = notes or "Rejected by Project Manager."
                activity.pm_verification_status = "REJECTED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or "Rejected by Project Manager."
                activity.final_recorded = False
                activity.validation_status = "REJECTED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")
        else:
            # Stage 2 PM Verification of Site Manager or Admin activity
            if activity.stage1_status != "APPROVED" and decision in ["APPROVED", "VERIFIED", "YES"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Gate Restriction: Activity is assigned to '{activity.assigned_role}'. It must first be validated and approved by {activity.assigned_role} before Project Manager can verify and record it."
                )
            if decision in ["APPROVED", "VERIFIED", "YES"]:
                activity.pm_verification_status = "VERIFIED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or f"Verified & countersigned by Project Manager after {activity.assigned_role} validation. Officially recorded."
                activity.final_recorded = True  # OFFICIALLY RECORDED ONLY UPON PM VERIFICATION!
                activity.validation_status = "RECORDED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            elif decision in ["REJECTED", "NO"]:
                activity.pm_verification_status = "REJECTED"
                activity.pm_verified_by = validator_name
                activity.pm_verified_at = now
                activity.pm_verification_notes = notes or f"Remanded / Rejected by Project Manager back to {activity.assigned_role}."
                activity.final_recorded = False
                activity.validation_status = "REJECTED"
                activity.validated_by = validator_name
                activity.validated_at = now
                activity.validation_notes = activity.pm_verification_notes
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported status value: {decision}")
    else:
        raise HTTPException(status_code=403, detail=f"Unrecognized role '{caller_role}'. Must be Site Engineer, Site Manager, Admin, or Project Manager.")

@router.post("/api/activities/{id}/validate", response_model=ActivityResponse)
@router.put("/api/activities/{id}/validate", response_model=ActivityResponse)
def validate_activity(
    id: int,
    req: ActivityValidationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Multi-Tier Activity Governance Engine:
    - Manager validates Site Manager activities (Stage 1 -> Awaiting PM Verification)
    - Admin validates Admin activities (Stage 1 -> Awaiting PM Verification)
    - Project Manager performs Stage 2 Verification -> ONLY THEN is final_recorded = True!
    - Project Manager validates direct PM structural activities -> final_recorded = True.
    - Top Management has executive read-only oversight.
    """
    activity = db.query(Activity).filter(Activity.id == id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    caller_role = _resolve_caller_role(current_user, req.validator_role, req.validated_by)
    validator_name = _resolve_validator_name(current_user, req.validated_by, caller_role)
    old_status = activity.validation_status

    _apply_validation_decision(
        activity=activity,
        status_val=req.validation_status,
        action_type=req.action_type,
        caller_role=caller_role,
        validator_name=validator_name,
        notes=req.validation_notes
    )

    db.commit()
    db.refresh(activity)

    AuditService.log_action(
        db,
        action="VALIDATE_ACTIVITY_MULTI_TIER",
        entity_name="Activity",
        entity_id=str(id),
        old_values={"validation_status": old_status},
        new_values={
            "validation_status": activity.validation_status,
            "stage1_status": activity.stage1_status,
            "pm_verification_status": activity.pm_verification_status,
            "final_recorded": activity.final_recorded,
            "validated_by": validator_name,
            "role": caller_role,
            "validation_notes": req.validation_notes,
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
    Multi-Tier Bulk Validation & Verification:
    - Applies role rules across batch of activity IDs
    """
    caller_role = _resolve_caller_role(current_user, req.validator_role, req.validated_by)
    validator_name = _resolve_validator_name(current_user, req.validated_by, caller_role)

    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id, Activity.id.in_(req.activity_ids))
        .all()
    )

    updated_count = 0
    errors = []

    for act in activities:
        try:
            _apply_validation_decision(
                activity=act,
                status_val=req.validation_status,
                action_type=req.action_type,
                caller_role=caller_role,
                validator_name=validator_name,
                notes=req.validation_notes
            )
            updated_count += 1
        except HTTPException as he:
            errors.append(f"Activity #{act.id} ({act.name}): {he.detail}")
        except Exception as e:
            errors.append(f"Activity #{act.id} ({act.name}): {str(e)}")

    db.commit()

    AuditService.log_action(
        db,
        action="BULK_VALIDATE_ACTIVITIES_MULTI_TIER",
        entity_name="Project",
        entity_id=str(project_id),
        new_values={
            "updated_count": updated_count,
            "status": req.validation_status,
            "validated_by": validator_name,
            "role": caller_role,
            "activity_ids": req.activity_ids,
            "errors": errors
        },
        user_id=current_user.id if current_user else None
    )

    return {
        "success": True,
        "updated_count": updated_count,
        "total_requested": len(req.activity_ids),
        "validation_status": req.validation_status.upper(),
        "validated_by": validator_name,
        "caller_role": caller_role,
        "errors": errors if errors else None
    }

@router.get("/api/projects/{project_id}/activities/governance-summary")
def get_governance_summary(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Executive Governance Summary for Top Management & Project Leadership:
    - Aggregated status matrix across Site Manager, Admin, and Project Manager
    - Breakdown of Stage 1 Validations, PM Verifications, and Final Recorded activities
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    total = len(activities)

    final_recorded_count = sum(1 for a in activities if a.final_recorded)
    awaiting_pm_count = sum(
        1 for a in activities
        if not a.final_recorded and (
            a.validation_status == "AWAITING_PM_VERIFICATION" or
            (a.stage1_status == "APPROVED" and a.assigned_role in ["Site Manager", "Admin"])
        )
    )
    awaiting_admin_count = sum(
        1 for a in activities
        if not a.final_recorded and (
            a.validation_status == "AWAITING_ADMIN_VERIFICATION" or
            (a.stage1_status == "APPROVED" and a.assigned_role in ["Site Engineer", "Engineer"])
        )
    )
    rejected_count = sum(
        1 for a in activities
        if a.validation_status == "REJECTED" or a.stage1_status == "REJECTED" or a.pm_verification_status == "REJECTED"
    )
    pending_stage1_count = sum(
        1 for a in activities
        if not a.final_recorded and (a.validation_status == "PENDING" or not a.validation_status) and a.stage1_status == "PENDING"
    )

    def role_stats(role_name: str):
        role_acts = [
            a for a in activities
            if a.assigned_role == role_name or (role_name == "Site Engineer" and a.assigned_role in ["Site Engineer", "Engineer"])
        ]
        r_total = len(role_acts)
        r_recorded = sum(1 for a in role_acts if a.final_recorded)
        r_awaiting = sum(
            1 for a in role_acts
            if not a.final_recorded and (
                a.validation_status in ["AWAITING_PM_VERIFICATION", "AWAITING_ADMIN_VERIFICATION"] or a.stage1_status == "APPROVED"
            )
        )
        r_rejected = sum(
            1 for a in role_acts
            if a.validation_status == "REJECTED" or a.stage1_status == "REJECTED" or a.pm_verification_status == "REJECTED"
        )
        r_pending = sum(
            1 for a in role_acts
            if not a.final_recorded and (a.validation_status == "PENDING" or not a.validation_status) and a.stage1_status == "PENDING"
        )
        return {
            "role": role_name,
            "total": r_total,
            "pending_validation": r_pending,
            "awaiting_verification": r_awaiting,
            "awaiting_pm_verification": r_awaiting if role_name != "Site Engineer" else 0,
            "awaiting_admin_verification": r_awaiting if role_name == "Site Engineer" else 0,
            "final_recorded": r_recorded,
            "rejected": r_rejected,
            "recorded_percentage": round((r_recorded / r_total * 100), 1) if r_total > 0 else 0.0
        }

    roles_data = {
        "Site Engineer": role_stats("Site Engineer"),
        "Site Manager": role_stats("Site Manager"),
        "Admin": role_stats("Admin"),
        "Project Manager": role_stats("Project Manager")
    }

    recent_verifications = [
        {
            "id": a.id,
            "name": a.name,
            "code": a.code,
            "floor": a.floor,
            "tower": a.tower,
            "phase": a.phase,
            "assigned_role": a.assigned_role,
            "stage1_status": a.stage1_status,
            "stage1_validated_by": a.stage1_validated_by,
            "stage1_validated_at": a.stage1_validated_at.isoformat() if a.stage1_validated_at else None,
            "pm_verification_status": a.pm_verification_status,
            "pm_verified_by": a.pm_verified_by,
            "pm_verified_at": a.pm_verified_at.isoformat() if a.pm_verified_at else None,
            "final_recorded": a.final_recorded,
            "validation_status": a.validation_status,
            "notes": a.pm_verification_notes or a.stage1_notes or a.validation_notes
        }
        for a in sorted(
            [act for act in activities if act.final_recorded or act.stage1_status == "APPROVED" or act.validation_status == "RECORDED"],
            key=lambda x: x.pm_verified_at or x.stage1_validated_at or datetime.datetime.min,
            reverse=True
        )[:20]
    ]

    return {
        "project_id": project_id,
        "project_name": project.name,
        "total_activities": total,
        "final_recorded_count": final_recorded_count,
        "recorded_percentage": round((final_recorded_count / total * 100), 1) if total > 0 else 0.0,
        "awaiting_verification_count": awaiting_pm_count + awaiting_admin_count,
        "awaiting_pm_count": awaiting_pm_count,
        "awaiting_admin_count": awaiting_admin_count,
        "pending_stage1_count": pending_stage1_count,
        "rejected_count": rejected_count,
        "roles": roles_data,
        "recent_verifications": recent_verifications
    }

