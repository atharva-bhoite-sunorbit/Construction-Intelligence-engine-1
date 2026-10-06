from typing import Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.all_models import DailyProgress, Activity, Project

class ProgressService:
    @staticmethod
    def record_daily_progress(
        db: Session,
        project_id: int,
        activity_id: int,
        report_date: date,
        planned_quantity: float,
        actual_quantity: float,
        workers_available: int,
        workers_assigned: int,
        working_hours: float = 8.0,
        material_availability_percent: float = 100.0,
        equipment_availability_percent: float = 100.0,
        issues: Optional[str] = None,
        remarks: Optional[str] = None,
        weather: Optional[str] = "Clear",
        user_id: Optional[int] = None
    ) -> DailyProgress:
        """
        Records daily progress entry and calculates all productivity and variance metrics.
        Updates parent Activity's progress percentage and status.
        """
        activity = db.query(Activity).filter(Activity.id == activity_id, Activity.project_id == project_id).first()
        if not activity:
            raise ValueError(f"Activity {activity_id} not found in project {project_id}")

        # Compute metrics
        manhours = max(1.0, float(workers_assigned * working_hours))
        daily_productivity = round(actual_quantity / manhours, 3)

        # Previous total completed
        prev_actual_sum = db.query(func.sum(DailyProgress.actual_quantity)).filter(
            DailyProgress.activity_id == activity_id,
            DailyProgress.report_date < report_date
        ).scalar() or 0.0

        cum_actual = prev_actual_sum + actual_quantity
        total_qty = max(1.0, activity.quantity)
        actual_progress_pct = min(100.0, round((cum_actual / total_qty) * 100.0, 1))

        # Planned progress %
        planned_cum_sum = db.query(func.sum(DailyProgress.planned_quantity)).filter(
            DailyProgress.activity_id == activity_id,
            DailyProgress.report_date < report_date
        ).scalar() or 0.0
        total_planned_to_date = planned_cum_sum + planned_quantity
        planned_progress_pct = min(100.0, round((total_planned_to_date / total_qty) * 100.0, 1))

        progress_variance_pct = round(actual_progress_pct - planned_progress_pct, 1)

        # Shortages
        req_labour = activity.required_labour or 5
        labour_shortage = max(0, req_labour - workers_assigned)
        mat_shortage = max(0.0, 100.0 - material_availability_percent)
        eq_shortage = max(0.0, 100.0 - equipment_availability_percent)

        # Cumulative productivity
        total_manhours_to_date = (
            db.query(func.sum(DailyProgress.workers_assigned * DailyProgress.working_hours))
            .filter(DailyProgress.activity_id == activity_id)
            .scalar() or 0.0
        ) + manhours
        cum_productivity = round(cum_actual / max(1.0, total_manhours_to_date), 3)

        record = DailyProgress(
            project_id=project_id,
            activity_id=activity_id,
            report_date=report_date,
            planned_quantity=planned_quantity,
            actual_quantity=actual_quantity,
            workers_available=workers_available,
            workers_assigned=workers_assigned,
            working_hours=working_hours,
            material_availability_percent=material_availability_percent,
            equipment_availability_percent=equipment_availability_percent,
            daily_productivity=daily_productivity,
            cumulative_productivity=cum_productivity,
            planned_progress_percent=planned_progress_pct,
            actual_progress_percent=actual_progress_pct,
            progress_variance_percent=progress_variance_pct,
            labour_shortage=labour_shortage,
            material_shortage=mat_shortage,
            equipment_shortage=eq_shortage,
            issues=issues,
            remarks=remarks,
            weather=weather,
            reported_by_user_id=user_id
        )
        db.add(record)

        # Update Activity status
        activity.progress_percent = actual_progress_pct
        if actual_progress_pct >= 100.0:
            activity.status = "COMPLETED"
            activity.actual_end_date = report_date
        elif actual_progress_pct > 0:
            if activity.status == "NOT_STARTED":
                activity.status = "IN_PROGRESS"
                activity.actual_start_date = report_date
            elif progress_variance_pct < -10:
                activity.status = "DELAYED"
            else:
                activity.status = "IN_PROGRESS"

        db.commit()
        db.refresh(record)
        return record
