from typing import List, Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session
from backend.app.models.all_models import Project, Activity, ActivityDependency
from backend.app.services.cpm_engine import CPMEngine
from backend.app.services.dependency_engine import DependencyEngine

class SchedulingEngine:
    @staticmethod
    def generate_and_apply_schedule(db: Session, project_id: int) -> Dict[str, Any]:
        """
        Runs CPM schedule calculation and persists updated dates, float values, and critical status.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        activities = db.query(Activity).filter(Activity.project_id == project_id).order_by(Activity.sort_order).all()
        dependencies = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

        if not activities:
            return {
                "message": "No activities to schedule",
                "activities_count": 0,
                "project_finish_date": project.target_completion_date
            }

        # Check circular dependencies first
        DependencyEngine.validate_no_cycles(activities, dependencies)

        # Run CPM
        start_date = project.planned_start_date or date.today()
        cpm_result = CPMEngine.calculate_cpm(activities, dependencies, start_date)
        updates = cpm_result["activity_updates"]
        critical_ids = set(cpm_result["critical_activity_ids"])

        for act in activities:
            if act.id in updates:
                info = updates[act.id]
                act.early_start = info["early_start"]
                act.early_finish = info["early_finish"]
                act.late_start = info["late_start"]
                act.late_finish = info["late_finish"]
                act.total_float = info["total_float"]
                act.free_float = info["free_float"]
                act.is_critical = act.id in critical_ids

                # Update schedule dates only if status is not completed/actual locked
                if act.status != "COMPLETED":
                    act.start_date = info["calculated_start_date"]
                    act.end_date = info["calculated_end_date"]

        db.commit()

        return {
            "project_id": project_id,
            "project_duration_days": cpm_result["project_duration_days"],
            "calculated_finish_date": cpm_result["project_finish_date"],
            "target_completion_date": project.target_completion_date,
            "total_activities": len(activities),
            "critical_activities_count": len(critical_ids),
            "critical_activity_ids": list(critical_ids)
        }
