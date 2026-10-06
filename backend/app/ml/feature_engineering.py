import json
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from datetime import date
from sqlalchemy.orm import Session
from backend.app.models.all_models import (
    Project, Activity, DailyProgress, Blocker, ActivityDependency
)

FEATURE_COLUMNS = [
    "c_type_encoded",
    "phase_encoded",
    "floor",
    "quantity",
    "planned_duration",
    "workers_available",
    "workers_assigned",
    "labour_shortage",
    "working_hours",
    "material_availability_pct",
    "equipment_availability_pct",
    "daily_productivity",
    "cumulative_productivity",
    "progress_variance_pct",
    "open_blockers_count",
    "critical_path_flag",
    "weather_encoded",
    "remaining_quantity",
    "predecessor_count",
    "successor_count"
]

CONSTRUCTION_TYPE_MAP = {
    "residential": 0,
    "commercial": 1,
    "high-rise": 2,
    "mall": 3,
    "factory": 4,
    "industrial": 5,
    "hotel": 6,
    "hospital": 7,
    "warehouse": 8,
    "infrastructure": 9,
    "other": 10
}

PHASE_MAP = {
    "pre-construction": 0,
    "substructure": 1,
    "superstructure": 2,
    "structure": 2,
    "masonry": 3,
    "mep": 4,
    "finishing": 5,
    "handover": 6,
    "execution": 2
}

WEATHER_MAP = {
    "clear": 0,
    "cloudy": 1,
    "rain": 2,
    "extreme heat": 3,
    "storm": 4
}

class FeatureEngineering:
    @staticmethod
    def extract_features_for_activity(db: Session, activity: Activity, project: Optional[Project] = None) -> Dict[str, Any]:
        """Extracts complete 20-dimensional feature vector for an activity."""
        if not project:
            project = db.query(Project).filter(Project.id == activity.project_id).first()

        c_type_str = (project.construction_type or "other").lower()
        c_type_encoded = CONSTRUCTION_TYPE_MAP.get(c_type_str, 10)

        phase_str = (activity.phase or "execution").lower()
        phase_encoded = PHASE_MAP.get(phase_str, 2)

        # Recent daily progress
        latest_progress = (
            db.query(DailyProgress)
            .filter(DailyProgress.activity_id == activity.id)
            .order_by(DailyProgress.report_date.desc())
            .first()
        )

        workers_avail = latest_progress.workers_available if latest_progress else (activity.required_labour or 8)
        workers_assign = latest_progress.workers_assigned if latest_progress else (activity.required_labour or 8)
        labour_short = latest_progress.labour_shortage if latest_progress else max(0, (activity.required_labour or 8) - workers_assign)
        working_hrs = latest_progress.working_hours if latest_progress else 8.0
        mat_avail = latest_progress.material_availability_percent if latest_progress else 100.0
        eq_avail = latest_progress.equipment_availability_percent if latest_progress else 100.0
        daily_prod = latest_progress.daily_productivity if latest_progress else 1.0
        cum_prod = latest_progress.cumulative_productivity if latest_progress else 1.0
        prog_var = latest_progress.progress_variance_percent if latest_progress else 0.0
        weather_str = (latest_progress.weather if latest_progress else "Clear").lower()
        weather_enc = WEATHER_MAP.get(weather_str, 0)

        # Open blockers
        open_blockers = (
            db.query(Blocker)
            .filter(Blocker.activity_id == activity.id, Blocker.status.in_(["OPEN", "IN_PROGRESS"]))
            .count()
        )

        # Dependencies count
        pred_count = db.query(ActivityDependency).filter(ActivityDependency.successor_id == activity.id).count()
        succ_count = db.query(ActivityDependency).filter(ActivityDependency.predecessor_id == activity.id).count()

        # Remaining quantity
        rem_qty = max(0.0, (activity.quantity or 1.0) * (1.0 - (activity.progress_percent or 0.0) / 100.0))

        feat = {
            "c_type_encoded": float(c_type_encoded),
            "phase_encoded": float(phase_encoded),
            "floor": float(activity.floor or 0),
            "quantity": float(activity.quantity or 1.0),
            "planned_duration": float(activity.planned_duration or 1),
            "workers_available": float(workers_avail),
            "workers_assigned": float(workers_assign),
            "labour_shortage": float(labour_short),
            "working_hours": float(working_hrs),
            "material_availability_pct": float(mat_avail),
            "equipment_availability_pct": float(eq_avail),
            "daily_productivity": float(daily_prod),
            "cumulative_productivity": float(cum_prod),
            "progress_variance_pct": float(prog_var),
            "open_blockers_count": float(open_blockers),
            "critical_path_flag": 1.0 if activity.is_critical else 0.0,
            "weather_encoded": float(weather_enc),
            "remaining_quantity": float(rem_qty),
            "predecessor_count": float(pred_count),
            "successor_count": float(succ_count)
        }
        return feat

    @staticmethod
    def to_feature_vector(feat: Dict[str, Any]) -> np.ndarray:
        """Converts dict of features into ordered 2D numpy array for sklearn estimators."""
        row = [feat.get(col, 0.0) for col in FEATURE_COLUMNS]
        return np.array([row], dtype=np.float32)
