from typing import Dict, Any, List
from datetime import date, timedelta
from sqlalchemy.orm import Session
from backend.app.models.all_models import (
    Project, Activity, ActivityDependency, ProjectCompletionForecast, MLDelayPrediction, MLDurationPrediction
)
from backend.app.services.cpm_engine import CPMEngine

class ForecastService:
    @staticmethod
    def calculate_completion_forecast(db: Session, project_id: int) -> Dict[str, Any]:
        """
        Dynamically calculates project completion date by integrating:
        - Baseline schedule
        - Actual progress (started / finished activities)
        - ML duration & delay predictions
        - Dependency network & critical path
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        activities = db.query(Activity).filter(Activity.project_id == project_id).all()
        dependencies = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

        if not activities:
            return {
                "project_id": project_id,
                "forecast_date": date.today(),
                "baseline_completion_date": project.target_completion_date,
                "predicted_completion_date": project.target_completion_date,
                "slippage_days": 0,
                "schedule_health_score": 100.0,
                "critical_path_length_days": 0,
                "confidence_interval_days": 0,
                "methodology_notes": "No activities scheduled yet.",
                "prediction_mode": "BASELINE"
            }

        # Query recent ML predictions for activities
        delay_preds = {
            p.activity_id: p for p in db.query(MLDelayPrediction).filter(MLDelayPrediction.project_id == project_id).all()
        }
        duration_preds = {
            p.activity_id: p for p in db.query(MLDurationPrediction).filter(MLDurationPrediction.project_id == project_id).all()
        }

        # Compute effective remaining duration per activity
        effective_durations: Dict[int, int] = {}
        prediction_modes = []

        for act in activities:
            if act.status == "COMPLETED":
                effective_durations[act.id] = 0
            elif act.status == "IN_PROGRESS":
                remaining_pct = max(0.0, 1.0 - (act.progress_percent / 100.0))
                base_rem_dur = int(round(act.planned_duration * remaining_pct))
                
                # Check ML prediction
                if act.id in duration_preds:
                    predicted_tot = duration_preds[act.id].predicted_duration
                    base_rem_dur = max(1, int(round(predicted_tot * remaining_pct)))
                    prediction_modes.append("ML")

                # Add delay risk days if high delay probability
                if act.id in delay_preds and delay_preds[act.id].delay_probability > 0.5:
                    base_rem_dur += int(round(delay_preds[act.id].predicted_delay_days))
                    prediction_modes.append("ML")

                effective_durations[act.id] = max(1, base_rem_dur)
            else: # NOT_STARTED
                base_dur = act.planned_duration
                if act.id in duration_preds:
                    base_dur = int(round(duration_preds[act.id].predicted_duration))
                    prediction_modes.append("ML")
                if act.id in delay_preds and delay_preds[act.id].delay_probability > 0.6:
                    base_dur += int(round(delay_preds[act.id].predicted_delay_days))
                    prediction_modes.append("ML")
                effective_durations[act.id] = max(1, base_dur)

        # Temporary activity objects with effective durations to feed CPM forward pass
        temp_activities = []
        for a in activities:
            temp_a = Activity(
                id=a.id,
                name=a.name,
                planned_duration=effective_durations.get(a.id, a.planned_duration)
            )
            temp_activities.append(temp_a)

        # Run CPM starting from today (or planned start date if project is in future)
        today = date.today()
        cpm_start_date = max(today, project.planned_start_date)
        cpm_result = CPMEngine.calculate_cpm(temp_activities, dependencies, cpm_start_date)
        predicted_finish = cpm_result["project_finish_date"]

        # Calculate slippage
        baseline_finish = project.target_completion_date
        slippage_delta = (predicted_finish - baseline_finish).days
        slippage_days = max(0, slippage_delta)

        # Health score: 100 - (slippage days * factor)
        health_score = max(10.0, min(100.0, 100.0 - (slippage_days * 3.5)))

        mode = "ML" if len(prediction_modes) >= 3 else "BASELINE"
        notes = (
            f"Forecast computed via Dynamic CPM integrating {len(activities)} activities, "
            f"{len(delay_preds)} ML delay predictions, and current actual progress. "
            f"Prediction mode: {mode}."
        )

        forecast_record = ProjectCompletionForecast(
            project_id=project_id,
            forecast_date=today,
            baseline_completion_date=baseline_finish,
            predicted_completion_date=predicted_finish,
            slippage_days=slippage_days,
            schedule_health_score=round(health_score, 1),
            critical_path_length_days=cpm_result["project_duration_days"],
            confidence_interval_days=max(3, int(slippage_days * 0.2) + 2),
            methodology_notes=notes
        )
        db.add(forecast_record)
        db.commit()

        return {
            "project_id": project_id,
            "forecast_date": today,
            "baseline_completion_date": baseline_finish,
            "predicted_completion_date": predicted_finish,
            "slippage_days": slippage_days,
            "schedule_health_score": round(health_score, 1),
            "critical_path_length_days": cpm_result["project_duration_days"],
            "confidence_interval_days": forecast_record.confidence_interval_days,
            "methodology_notes": notes,
            "prediction_mode": mode
        }
