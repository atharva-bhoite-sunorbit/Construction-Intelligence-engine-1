import datetime
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, Activity, ActivityDependency, User, MLDelayPrediction, Blocker
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


def is_structure_or_handover_activity(activity: Activity) -> bool:
    phase = (activity.phase or "").strip().lower()
    if phase in {"substructure", "superstructure", "handover"}:
        return True

    scope = " ".join(
        value or ""
        for value in (
            activity.work_package,
            activity.category,
            activity.subcategory,
            activity.name,
        )
    ).lower()
    return bool(
        re.search(r"\b(substructure|superstructure|structural|structure|rcc|shear wall|foundation)\b", scope)
        or re.search(
            r"\b(handover|commissioning|occupancy certificate|completion certificate|statutory clearance|noc)\b",
            scope,
        )
    )


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
    sched_info = SchedulingEngine.generate_and_apply_schedule(db, project_id, overwrite_dates=True)

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

def synthesize_task_requirements(name: str, work_pkg: Optional[str], tower: str, floor: int, qty: float, unit: str, raw_labour: int, raw_mat: Optional[str], raw_equip: Optional[str]):
    n_lower = name.lower()
    pkg_lower = (work_pkg or "").lower()

    if "slab" in n_lower:
        scope = f"Shuttering, rebar binding, conduit embedment, and concrete casting for {name} on {tower} Floor {floor}."
        specs = "Concrete Grade: M40 Self-Compacting / Slump: 140±20mm / Rebar: Fe500D (lap length 50d) / Cover: 25mm bottom, 20mm top / Level tolerance: ±3mm."
        materials = f"Ready Mix Concrete M40 (~35 m³), TMT Rebar Fe500D (~4.8 MT), Marine Plywood Shuttering 18mm, Curing Compound, Polythene Sheets."
        equipment = "1x 36m Boom Concrete Pump, 2x 60mm Needle Vibrators, 1x Tower Crane Hook, 1x Total Station."
        safety_qa = "Mandatory pre-pour inspection signed by Site Engineer; 6 cube samples (3 @ 7d, 3 @ 28d); Safety harnesses anchored to static lifelines above 2.0m; Fall netting active."
        trades = {"masons": 3, "bar_benders": 6, "carpenters": 5, "helpers": 6, "operators": 2, "supervisors": 1}
    elif "waterproofing" in n_lower:
        scope = f"Surface preparation, primer application, and dual-coat elastomeric membrane waterproofing for {name} on {tower}."
        specs = "Two-coat polyurethane elastomeric system / Dry film thickness: 1.5mm / 72-hour hydrostatic ponding test required / Zero dampness sign-off."
        materials = "PU Liquid Membrane (180 kg), Primer (40 L), Geotextile Fleece (200 sq.m), Polymer Modified Protective Screed M20."
        equipment = "1x High-Pressure Airless Sprayer, 1x Surface Grinder, 1x Moisture Meter, Inflatable Test Plugs."
        safety_qa = "Organic vapor masks required; enclosed space ventilation active; water-retaining flood test certification before tiling."
        trades = {"masons": 2, "bar_benders": 0, "carpenters": 0, "helpers": 4, "operators": 1, "supervisors": 1}
    elif "electrical" in n_lower or "mep" in pkg_lower:
        scope = f"Conduit chasing, PVC pipe laying, junction box fixing, and circuit cable pulling for {name}."
        specs = "FRLS Heavy Duty PVC Conduits (25mm/32mm) / Multi-strand copper wire per IEC 60364 / Megger insulation resistance > 50 MΩ."
        materials = "FRLS Copper Wire (2.5 & 4.0 sq.mm), 25mm PVC Conduits, Cast Iron Junction Boxes, Earthing Electrodes."
        equipment = "1x Wall Chaser Machine, 1x Digital Megger Tester, 1x Pipe Bender, Safety Stepladders."
        safety_qa = "Lockout-Tagout (LOTO) procedures; 1000V rated insulated hand tools; conduit alignment verification before concrete pour."
        trades = {"masons": 0, "bar_benders": 0, "carpenters": 0, "helpers": 3, "operators": 0, "supervisors": 1, "electricians": 4}
    elif "excavation" in n_lower or "basement" in n_lower:
        scope = f"Earthwork excavation, hard basalt rock breaking, and muck carting for {name} to designated founding level."
        specs = "Excavation slope 1:1.5 / Rock strata RQD > 65% / Bearing capacity 450 kN/m² / Pit sump dewatering continuously active."
        materials = "Shoring nails, rock bolts, drainage gravel 20-40mm, PVC perforated drain pipes, geotextile wrap."
        equipment = "1x 20T Hydraulic Excavator, 1x Rock Breaker, 2x 16T Tipper Trucks, 1x 10HP Submersible Dewatering Pump."
        safety_qa = "Daily geotechnical pit edge inspection; rock slope stability clearance; groundwater level log; 100% PPE."
        trades = {"masons": 0, "bar_benders": 0, "carpenters": 0, "helpers": 4, "operators": 3, "supervisors": 1}
    elif "ugwt" in n_lower or "water tank" in n_lower:
        scope = f"Reinforced concrete construction, hydrophilic waterstop placement, and chemical waterproofing for {name}."
        specs = "Water-retaining structure per IS 3370 / M35 concrete with crystalline waterproofing admixture / Continuous monolithic pour."
        materials = "Crystalline Waterproofing Concrete M35 (~50 m³), Fe500D Rebar (~6.2 MT), Hydrophilic Swellable Waterstops."
        equipment = "1x Stationary Concrete Pump, 2x High-Frequency Vibrators, 1x Tower Crane Hook, Hydrostatic Gauge."
        safety_qa = "Confined space entry permit required; forced-air ventilation fan; 7-day water-retaining leak test sign-off."
        trades = {"masons": 3, "bar_benders": 5, "carpenters": 4, "helpers": 5, "operators": 1, "supervisors": 1}
    elif "rcc" in n_lower or "column" in n_lower or "shear" in n_lower:
        scope = f"Column and shear wall formwork assembly, starter curing, and M40/M50 concrete pouring for {name}."
        specs = "Grade: M50 / Slump: 120±15mm / Max drop height 1.5m / Formwork tolerance: ±2mm vertical plumbness."
        materials = "Ready-Mix Concrete M50 (~25 m³), TMT Rebar Fe500D (~3.5 MT), Steel Panel Shuttering, Shuttering Oil."
        equipment = "1x Crane Bucket / Tremie Pipe, 2x 40mm Pencil Vibrators, 1x Laser Plummet."
        safety_qa = "Check cover blocks; verify shear wall tie-rods; vibrating probe inspection to prevent honeycombing."
        trades = {"masons": 2, "bar_benders": 4, "carpenters": 5, "helpers": 5, "operators": 1, "supervisors": 1}
    elif "masonry" in n_lower or "block" in n_lower:
        scope = f"AAC blockwork wall erection with polymer-modified adhesive mortar and RCC band lintels for {name}."
        specs = "Block compressive strength ≥4.0 N/mm² / Mortar joint thickness 3-4mm / Lintel bearing min 200mm / Plumbness ±2mm/m."
        materials = "AAC Blocks (600x200x150mm), Thin Bed Mortar Adhesive, GI Wall Ties, Ready-mix Lintel Concrete."
        equipment = "1x Pan Mortar Mixer, 2x Rubber Mallets, 2x Spirit Levels, Masons Trowels."
        safety_qa = "Scaffold safety inspection tag; dust masks for adhesive mixing; wall anchor inspection at column joints."
        trades = {"masons": 4, "bar_benders": 1, "carpenters": 1, "helpers": 5, "operators": 0, "supervisors": 1}
    else:
        scope = f"Execution of {name} on {tower} Floor {floor} in compliance with master construction plan."
        specs = "Compliance with IS/CPWD codes of practice, approved shop drawings revision R2, and QA tolerance criteria."
        materials = raw_mat or f"Approved building materials & consumables for {name} ({qty} {unit})."
        equipment = raw_equip or "Standard construction plant, tower crane hook, hand power tools."
        safety_qa = "Daily safety toolbox briefing; mandatory PPE compliance; Site Engineer milestone clearance."
        trades = {"masons": 2, "bar_benders": 2, "carpenters": 2, "helpers": 4, "operators": 1, "supervisors": 1}

    total_headcount = max(raw_labour, sum(trades.values()))

    return {
        "brief_requirements": {
            "work_scope": scope,
            "technical_specifications": specs,
            "material_requirements": materials,
            "equipment_requirements": equipment,
            "safety_and_quality": safety_qa
        },
        "labour_requirement": {
            "total_headcount": total_headcount,
            "trades": trades,
            "shift": "General Day Shift (08:00 - 17:00)",
            "muster_status": "ALLOCATED & READY"
        }
    }

@router.get("/api/projects/{project_id}/activities/by-date")
def get_activities_by_date(
    project_id: int,
    target_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to current date)"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Day-Wise Construction Activity Health & Daily Requirements Inspector:
    Given a specific project date, returns every activity active/scheduled on that day,
    with comprehensive brief requirements (scope, specs, materials, plant) and labour requirements.
    Categorized with AI intelligence as:
    - IN_CONTROL (🟢 On schedule, low risk, adequate float)
    - RISKY (🔴 High ML delay probability, critical path with low float, or active site blocker)
    - DELAYED (🟡 Delayed status, behind schedule pace, or overdue)
    """
    # 1. Parse date
    parsed_date = None
    if target_date:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                parsed_date = datetime.datetime.strptime(target_date.strip(), fmt).date()
                break
            except ValueError:
                pass
    if not parsed_date:
        parsed_date = datetime.date.today()

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Query all activities for project
    all_activities = db.query(Activity).filter(Activity.project_id == project_id).order_by(Activity.floor, Activity.sort_order).all()

    # Preload ML delay predictions and blockers
    preds = {
        p.activity_id: p
        for p in db.query(MLDelayPrediction).filter(MLDelayPrediction.project_id == project_id).all()
    }
    blockers = []
    if current_user and current_user.role == "Admin":
        blockers = db.query(Blocker).filter(Blocker.project_id == project_id, Blocker.status == "OPEN").all()
    blockers_by_act = {}
    for b in blockers:
        blockers_by_act.setdefault(b.activity_id, []).append(b)

    day_activities = []
    in_control_count = 0
    risky_count = 0
    delayed_count = 0
    total_labour_sum = 0

    candidate_activities = []
    for a in all_activities:
        # Filter out pure top-level summary headers
        if a.work_package == "Summary Header" and a.sort_order in (1, 3, 74, 144):
            continue
        candidate_activities.append(a)

    # Do not report completion while the scheduled activity plan still has unfinished dates.
    project_comp_date = project.target_completion_date
    if isinstance(project_comp_date, str):
        try:
            project_comp_date = datetime.date.fromisoformat(project_comp_date.split('T')[0])
        except Exception:
            pass
    elif isinstance(project_comp_date, datetime.datetime):
        project_comp_date = project_comp_date.date()

    scheduled_finish = max((a.end_date for a in candidate_activities), default=None)
    if scheduled_finish and (not project_comp_date or scheduled_finish > project_comp_date):
        project_comp_date = scheduled_finish

    # Check if the requested date is strictly AFTER project completion date
    is_project_completed = False
    if project_comp_date:
        if parsed_date > project_comp_date:
            is_project_completed = True
        elif project.status == "COMPLETED" and parsed_date >= project_comp_date:
            is_project_completed = True

    if is_project_completed and project_comp_date:
        formatted_finish = project_comp_date.strftime("%d %B %Y")
        return {
            "project_id": project_id,
            "project_name": project.name,
            "project_code": project.code,
            "target_date": parsed_date.isoformat(),
            "completion_date": project_comp_date.isoformat(),
            "is_project_completed": True,
            "total_activities": 0,
            "total_labour_required": 0,
            "total_equipment_deployed": 0,
            "in_control_count": 0,
            "risky_count": 0,
            "delayed_count": 0,
            "is_upcoming_view": False,
            "notice_message": f"Project is Completed. The construction lifecycle and structural handover was completed on {formatted_finish}. No active construction activities remain scheduled on {parsed_date.strftime('%d %B %Y')}.",
            "activities": []
        }

    for a in candidate_activities:
        act_start = a.actual_start_date or a.start_date
        act_end = a.actual_end_date or a.end_date

        # Check if activity is active on parsed_date:
        is_active = (act_start <= parsed_date <= act_end)

        # Or if activity started on or before parsed_date and was not yet completed:
        if not is_active and a.actual_start_date and a.actual_start_date <= parsed_date:
            if not a.actual_end_date or a.actual_end_date >= parsed_date:
                is_active = True

        if not is_active:
            continue

        # Activity is active on this day! Now classify:
        pred = preds.get(a.id)
        act_blockers = blockers_by_act.get(a.id, [])
        risk_score = pred.delay_probability if pred else 0.0
        pred_delay_days = pred.predicted_delay_days if pred else 0.0

        risk_factors = []
        is_delayed = False
        is_risky = False

        # Delayed criteria
        if a.status == "DELAYED":
            is_delayed = True
            risk_factors.append("Formally flagged as DELAYED in progress governance")
        elif parsed_date > a.end_date and a.status != "COMPLETED":
            is_delayed = True
            risk_factors.append(f"Overdue: Scheduled completion was {a.end_date.strftime('%d/%m/%Y')}")

        # Risky criteria
        if act_blockers:
            is_risky = True
            for blk in act_blockers:
                risk_factors.append(f"Active site blocker: {blk.title} ({blk.severity} severity)")

        if risk_score >= 0.40:
            is_risky = True
            risk_factors.append(f"High ML delay probability: {int(risk_score * 100)}% (+{pred_delay_days:.1f} days impact)")

        if a.is_critical and (a.total_float is not None and a.total_float <= 2):
            is_risky = True
            risk_factors.append(f"Critical path activity with minimal float ({a.total_float} days buffer)")

        if "EXCAVATION" in a.name.upper() or "BASEMENT" in a.name.upper():
            if any("groundwater" in (b.description or "").lower() for b in act_blockers) or risk_score > 0.35:
                is_risky = True
                risk_factors.append("Geotechnical alert: Groundwater ingress / Basalt bedrock strata excavation risk")

        # Determine final category
        if is_delayed:
            category = "DELAYED"
            delayed_count += 1
            if not risk_factors:
                risk_factors.append("Progress tracking behind scheduled velocity")
        elif is_risky:
            category = "RISKY"
            risky_count += 1
        else:
            category = "IN_CONTROL"
            in_control_count += 1
            if a.status == "COMPLETED":
                risk_factors.append("Milestone completed and QA signed off")
            else:
                risk_factors.append(f"On schedule ({a.progress_percent:.0f}% complete)")
                risk_factors.append(f"Float buffer adequate ({a.total_float or 5} days)")
                risk_factors.append("Optimal labor and material allocation")

        # Compute planned progress vs actual progress on this day
        tot_days = max(1, (a.end_date - a.start_date).days)
        elapsed_to_date = max(0, min(tot_days, (parsed_date - a.start_date).days))
        planned_pct = min(100.0, round((elapsed_to_date / tot_days) * 100.0, 1))

        # Synthesize brief requirements & trade-wise labour muster
        reqs = synthesize_task_requirements(
            name=a.name,
            work_pkg=a.work_package,
            tower=a.tower,
            floor=a.floor,
            qty=a.quantity,
            unit=a.unit,
            raw_labour=a.required_labour or 8,
            raw_mat=a.required_material,
            raw_equip=a.required_equipment
        )
        total_labour_sum += reqs["labour_requirement"]["total_headcount"]

        day_activities.append({
            "id": a.id,
            "name": a.name,
            "code": a.code,
            "phase": a.phase,
            "work_package": a.work_package,
            "tower": a.tower,
            "floor": a.floor,
            "zone": a.zone,
            "start_date": a.start_date.isoformat(),
            "end_date": a.end_date.isoformat(),
            "actual_start_date": a.actual_start_date.isoformat() if a.actual_start_date else None,
            "actual_end_date": a.actual_end_date.isoformat() if a.actual_end_date else None,
            "status": a.status,
            "progress_percent": a.progress_percent,
            "planned_progress_percent": planned_pct,
            "priority": a.priority,
            "is_critical": a.is_critical,
            "total_float": a.total_float or 0,
            "delay_risk_score": risk_score,
            "predicted_delay_days": pred_delay_days,
            "risk_level": pred.risk_level if pred else "LOW",
            "category": category, # "IN_CONTROL" | "RISKY" | "DELAYED"
            "risk_factors": risk_factors,
            "blockers_count": len(act_blockers),
            "blockers": [
                {
                    "id": b.id,
                    "title": b.title,
                    "category": b.category,
                    "severity": b.severity,
                    "status": b.status
                }
                for b in act_blockers
            ],
            "brief_requirements": reqs["brief_requirements"],
            "labour_requirement": reqs["labour_requirement"],
            "assigned_role": a.assigned_role,
            "stage1_status": a.stage1_status,
            "pm_verification_status": a.pm_verification_status,
            "final_recorded": a.final_recorded
        })

    # If no activities fell directly on this calendar date, fallback to initial scheduled project workfronts
    is_upcoming_view = False
    notice_message = None
    if not day_activities and candidate_activities:
        is_upcoming_view = True
        earliest_date = min(a.start_date for a in candidate_activities)
        notice_message = f"No activities scheduled directly on {parsed_date.isoformat()}. Displaying upcoming primary project workfronts starting from {earliest_date.isoformat()} with full requirements."
        
        # Take the top 15 earliest activities
        fallback_acts = sorted(candidate_activities, key=lambda x: (x.start_date, x.sort_order))[:15]
        for a in fallback_acts:
            pred = preds.get(a.id)
            act_blockers = blockers_by_act.get(a.id, [])
            risk_score = pred.delay_probability if pred else 0.0
            pred_delay_days = pred.predicted_delay_days if pred else 0.0
            
            reqs = synthesize_task_requirements(
                name=a.name,
                work_pkg=a.work_package,
                tower=a.tower,
                floor=a.floor,
                qty=a.quantity,
                unit=a.unit,
                raw_labour=a.required_labour or 8,
                raw_mat=a.required_material,
                raw_equip=a.required_equipment
            )
            total_labour_sum += reqs["labour_requirement"]["total_headcount"]
            in_control_count += 1

            day_activities.append({
                "id": a.id,
                "name": a.name,
                "code": a.code,
                "phase": a.phase,
                "work_package": a.work_package,
                "tower": a.tower,
                "floor": a.floor,
                "zone": a.zone,
                "start_date": a.start_date.isoformat(),
                "end_date": a.end_date.isoformat(),
                "actual_start_date": a.actual_start_date.isoformat() if a.actual_start_date else None,
                "actual_end_date": a.actual_end_date.isoformat() if a.actual_end_date else None,
                "status": a.status,
                "progress_percent": a.progress_percent,
                "planned_progress_percent": 0.0,
                "priority": a.priority,
                "is_critical": a.is_critical,
                "total_float": a.total_float or 0,
                "delay_risk_score": risk_score,
                "predicted_delay_days": pred_delay_days,
                "risk_level": pred.risk_level if pred else "LOW",
                "category": "IN_CONTROL",
                "risk_factors": ["Upcoming scheduled work package"],
                "blockers_count": len(act_blockers),
                "blockers": [],
                "brief_requirements": reqs["brief_requirements"],
                "labour_requirement": reqs["labour_requirement"],
                "assigned_role": a.assigned_role,
                "stage1_status": a.stage1_status,
                "pm_verification_status": a.pm_verification_status,
                "final_recorded": a.final_recorded
            })

    # Sort activities: RISKY first, then DELAYED, then IN_CONTROL
    priority_order = {"RISKY": 0, "DELAYED": 1, "IN_CONTROL": 2}
    day_activities.sort(key=lambda x: (priority_order.get(x["category"], 3), -x["is_critical"], x["floor"], x["id"]))

    return {
        "project_id": project_id,
        "project_name": project.name,
        "project_code": project.code,
        "target_date": parsed_date.isoformat(),
        "total_activities": len(day_activities),
        "total_labour_required": total_labour_sum,
        "total_equipment_deployed": max(len(day_activities), int(len(day_activities) * 1.2)),
        "in_control_count": in_control_count,
        "risky_count": risky_count,
        "delayed_count": delayed_count,
        "is_upcoming_view": is_upcoming_view,
        "notice_message": notice_message,
        "is_project_completed": False,
        "completion_date": project_comp_date.isoformat() if project_comp_date else None,
        "activities": day_activities
    }

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

    activities = [
        activity
        for activity in db.query(Activity).filter(Activity.project_id == project_id).all()
        if is_structure_or_handover_activity(activity)
    ]
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
