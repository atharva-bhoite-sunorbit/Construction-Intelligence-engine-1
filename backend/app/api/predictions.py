from typing import List, Dict, Any, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import (
    Project, Activity, Resource, MLDelayPrediction, MLDurationPrediction,
    MLProductivityPrediction, MLLabourPrediction, MLMaterialPrediction, MLActivityFeatures
)
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.delay_model import DelayPredictionService
from backend.app.ml.duration_model import DurationPredictionService
from backend.app.ml.productivity_model import ProductivityPredictionService
from backend.app.ml.labour_model import LabourPredictionService
from backend.app.ml.material_forecast import MaterialForecastService
from backend.app.services.ai_service import AIService
from backend.app.services.forecast_service import ForecastService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["ML Predictions & Risk Center"])

@router.post("/predictions/run")
def run_all_predictions(project_id: int, db: Session = Depends(get_db)):
    """
    Executes complete ML Feature Engineering & Multi-Model Inference:
    1. Feature Engineering (20 features per activity)
    2. Delay Prediction (Classification + Delay days)
    3. Duration Prediction (Regression + Intervals)
    4. Daily Productivity Prediction
    5. Required Labour Prediction
    6. Material Shortage Forecast
    7. Dynamic Completion Forecast Update
    8. Generates AI Recommendations
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    if not activities:
        raise HTTPException(status_code=400, detail="No activities found to run predictions on.")

    today = date.today()

    # Clear previous predictions for fresh run
    db.query(MLDelayPrediction).filter(MLDelayPrediction.project_id == project_id).delete()
    db.query(MLDurationPrediction).filter(MLDurationPrediction.project_id == project_id).delete()
    db.query(MLProductivityPrediction).filter(MLProductivityPrediction.project_id == project_id).delete()
    db.query(MLLabourPrediction).filter(MLLabourPrediction.project_id == project_id).delete()
    db.commit()

    delay_results = []
    duration_results = []
    productivity_results = []
    labour_results = []

    for act in activities:
        # Extract features
        feat = FeatureEngineering.extract_features_for_activity(db, act, project)

        # 1. Delay Prediction
        delay_out = DelayPredictionService.predict_delay(feat)
        dp = MLDelayPrediction(
            project_id=project_id,
            activity_id=act.id,
            prediction_date=today,
            delay_probability=delay_out["delay_probability"],
            risk_level=delay_out["risk_level"],
            predicted_delay_days=delay_out["predicted_delay_days"],
            confidence_score=delay_out["confidence_score"],
            model_version=delay_out["model_version"],
            prediction_mode=delay_out["prediction_mode"]
        )
        db.add(dp)
        delay_results.append({
            "activity_id": act.id,
            "activity_name": act.name,
            **delay_out
        })

        # 2. Duration Prediction
        dur_out = DurationPredictionService.predict_duration(feat)
        dup = MLDurationPrediction(
            project_id=project_id,
            activity_id=act.id,
            prediction_date=today,
            predicted_duration=dur_out["predicted_duration"],
            interval_lower=dur_out["interval_lower"],
            interval_upper=dur_out["interval_upper"],
            confidence_score=dur_out["confidence_score"],
            model_version=dur_out["model_version"],
            prediction_mode=dur_out["prediction_mode"]
        )
        db.add(dup)
        duration_results.append({
            "activity_id": act.id,
            "activity_name": act.name,
            **dur_out
        })

        # 3. Productivity Prediction
        prod_out = ProductivityPredictionService.predict_productivity(feat, f"{act.unit}/day")
        pp = MLProductivityPrediction(
            project_id=project_id,
            activity_id=act.id,
            prediction_date=today,
            predicted_daily_productivity=prod_out["predicted_daily_productivity"],
            unit=prod_out["unit"],
            confidence_score=prod_out["confidence_score"],
            model_version=prod_out["model_version"],
            prediction_mode=prod_out["prediction_mode"]
        )
        db.add(pp)
        productivity_results.append({
            "activity_id": act.id,
            "activity_name": act.name,
            **prod_out
        })

        # 4. Labour Requirement Prediction
        lab_out = LabourPredictionService.predict_labour_requirement(feat)
        lp = MLLabourPrediction(
            project_id=project_id,
            activity_id=act.id,
            prediction_date=today,
            predicted_workers_required=lab_out["predicted_workers_required"],
            confidence_score=lab_out["confidence_score"],
            model_version=lab_out["model_version"],
            prediction_mode=lab_out["prediction_mode"]
        )
        db.add(lp)
        labour_results.append({
            "activity_id": act.id,
            "activity_name": act.name,
            **lab_out
        })

    db.commit()

    # 5. Material Forecast for project materials
    materials = db.query(Resource).filter(Resource.project_id == project_id, Resource.category.ilike("mat%")).all()
    material_results = []
    for m in materials:
        m_out = MaterialForecastService.forecast_material_consumption(db, project_id, m.id)
        material_results.append(m_out)

    # 6. Recalculate Dynamic Project Completion Forecast with new ML predictions
    forecast_data = ForecastService.calculate_completion_forecast(db, project_id)

    # 7. Generate AI Recommendations based on predictions
    AIService.generate_recommendations_for_project(db, project_id)

    return {
        "project_id": project_id,
        "prediction_date": today.isoformat(),
        "total_activities_analyzed": len(activities),
        "prediction_mode": delay_results[0]["prediction_mode"] if delay_results else "BASELINE",
        "delays": delay_results,
        "durations": duration_results,
        "productivity": productivity_results,
        "labour": labour_results,
        "materials": material_results,
        "forecast": forecast_data
    }

@router.get("/predictions")
def get_all_predictions(project_id: int, db: Session = Depends(get_db)):
    """Returns the latest ML prediction state across all activities in the project."""
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    delays = {p.activity_id: p for p in db.query(MLDelayPrediction).filter(MLDelayPrediction.project_id == project_id).all()}
    durations = {p.activity_id: p for p in db.query(MLDurationPrediction).filter(MLDurationPrediction.project_id == project_id).all()}
    productivity = {p.activity_id: p for p in db.query(MLProductivityPrediction).filter(MLProductivityPrediction.project_id == project_id).all()}
    labour = {p.activity_id: p for p in db.query(MLLabourPrediction).filter(MLLabourPrediction.project_id == project_id).all()}

    items = []
    for a in activities:
        d = delays.get(a.id)
        dur = durations.get(a.id)
        prod = productivity.get(a.id)
        lab = labour.get(a.id)

        items.append({
            "activity_id": a.id,
            "activity_name": a.name,
            "code": a.code,
            "floor": a.floor,
            "tower": a.tower,
            "status": a.status,
            "is_critical": a.is_critical,
            "delay_probability": d.delay_probability if d else 0.15,
            "risk_level": d.risk_level if d else "LOW",
            "predicted_delay_days": d.predicted_delay_days if d else 0.0,
            "planned_duration": a.planned_duration,
            "predicted_duration": dur.predicted_duration if dur else a.planned_duration,
            "duration_interval": [dur.interval_lower, dur.interval_upper] if dur else [a.planned_duration, a.planned_duration],
            "predicted_productivity": prod.predicted_daily_productivity if prod else 2.5,
            "predicted_workers": lab.predicted_workers_required if lab else a.required_labour,
            "prediction_mode": d.prediction_mode if d else "BASELINE"
        })

    return {
        "project_id": project_id,
        "items": items
    }

@router.get("/risks")
def get_ai_risk_center(project_id: int, db: Session = Depends(get_db)):
    """
    AI RISK CENTER:
    Categorizes all project risks into Critical, High, Medium, and Low.
    Provides root causal factors, potential impact, and recommended investigation.
    """
    delays = (
        db.query(MLDelayPrediction)
        .filter(MLDelayPrediction.project_id == project_id)
        .order_by(MLDelayPrediction.delay_probability.desc())
        .all()
    )
    act_map = {a.id: a for a in db.query(Activity).filter(Activity.project_id == project_id).all()}

    grouped = {
        "CRITICAL": [],
        "HIGH": [],
        "MEDIUM": [],
        "LOW": []
    }

    for d in delays:
        act = act_map.get(d.activity_id)
        if not act or act.status == "COMPLETED":
            continue

        item = {
            "prediction_id": d.id,
            "activity_id": act.id,
            "activity_name": act.name,
            "floor": act.floor,
            "tower": act.tower,
            "delay_probability": d.delay_probability,
            "risk_level": d.risk_level,
            "predicted_delay_days": d.predicted_delay_days,
            "is_critical_path": act.is_critical,
            "total_float": act.total_float,
            "status": act.status,
            "reason": (
                f"Elevated delay risk on {act.name}. Model detected labour/material sensitivity "
                f"with {d.predicted_delay_days}d projected slippage."
            ),
            "potential_impact": (
                f"Directly impacts project milestone and pushes dependent successors."
                if act.is_critical else f"Can absorb up to {act.total_float}d float before impacting finish date."
            ),
            "recommended_investigation": (
                "Audit gang productivity, verify concrete batch delivery confirmation, and clear any work-front blockers."
            )
        }
        level = d.risk_level if d.risk_level in grouped else "MEDIUM"
        grouped[level].append(item)

    counts = {k: len(v) for k, v in grouped.items()}

    return {
        "project_id": project_id,
        "risk_counts": counts,
        "critical_risks": grouped["CRITICAL"],
        "high_risks": grouped["HIGH"],
        "medium_risks": grouped["MEDIUM"],
        "low_risks": grouped["LOW"]
    }
