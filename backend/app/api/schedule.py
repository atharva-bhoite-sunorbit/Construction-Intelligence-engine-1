from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, Activity, ActivityDependency
from backend.app.services.scheduling_engine import SchedulingEngine
from backend.app.services.cpm_engine import CPMEngine

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Scheduling & Gantt"])

@router.post("/schedule/generate")
def generate_schedule(project_id: int, db: Session = Depends(get_db)):
    """Runs CPM forward/backward passes and updates start dates, end dates, and critical status."""
    return SchedulingEngine.generate_and_apply_schedule(db, project_id)

@router.get("/schedule")
def get_schedule_and_gantt(project_id: int, db: Session = Depends(get_db)):
    """
    Returns full schedule data optimized for Interactive Gantt Chart:
    - Activity bars with planned and actual progress
    - Dependency links (predecessors & successors)
    - Critical path highlights
    - Floors, towers, and phase groupings
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id)
        .order_by(Activity.floor, Activity.sort_order, Activity.start_date)
        .all()
    )
    dependencies = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

    act_map = {a.id: a for a in activities}

    tasks = []
    for a in activities:
        tasks.append({
            "id": a.id,
            "name": a.name,
            "code": a.code,
            "phase": a.phase,
            "work_package": a.work_package,
            "tower": a.tower,
            "floor": a.floor,
            "start": a.start_date.isoformat(),
            "end": a.end_date.isoformat(),
            "duration": a.planned_duration,
            "progress": a.progress_percent,
            "status": a.status,
            "is_critical": a.is_critical,
            "total_float": a.total_float,
            "free_float": a.free_float,
            "required_labour": a.required_labour,
            "early_start": a.early_start,
            "early_finish": a.early_finish,
            "late_start": a.late_start,
            "late_finish": a.late_finish,
        })

    links = []
    for d in dependencies:
        links.append({
            "id": d.id,
            "source": d.predecessor_id,
            "target": d.successor_id,
            "type": d.dependency_type,
            "lag": d.lag_days,
            "source_name": act_map[d.predecessor_id].name if d.predecessor_id in act_map else "",
            "target_name": act_map[d.successor_id].name if d.successor_id in act_map else "",
        })

    critical_count = sum(1 for a in activities if a.is_critical)

    return {
        "project_id": project_id,
        "project_name": project.name,
        "planned_start_date": project.planned_start_date.isoformat(),
        "target_completion_date": project.target_completion_date.isoformat(),
        "total_activities": len(activities),
        "critical_activities_count": critical_count,
        "tasks": tasks,
        "links": links
    }

@router.get("/critical-path")
def get_critical_path(project_id: int, db: Session = Depends(get_db)):
    """Returns critical path activities and float analysis."""
    critical_acts = (
        db.query(Activity)
        .filter(Activity.project_id == project_id, Activity.is_critical == True)
        .order_by(Activity.start_date)
        .all()
    )

    return {
        "project_id": project_id,
        "critical_path_length": len(critical_acts),
        "total_duration_days": sum(a.planned_duration for a in critical_acts),
        "activities": [
            {
                "id": a.id,
                "name": a.name,
                "floor": a.floor,
                "tower": a.tower,
                "start_date": a.start_date.isoformat(),
                "end_date": a.end_date.isoformat(),
                "planned_duration": a.planned_duration,
                "progress_percent": a.progress_percent,
                "status": a.status,
                "total_float": a.total_float,
                "free_float": a.free_float
            }
            for a in critical_acts
        ]
    }
