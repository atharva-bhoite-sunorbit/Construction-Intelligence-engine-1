from typing import Dict, Any, List
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.all_models import Resource, Activity, ActivityResourcePlan, MLMaterialPrediction

class MaterialForecastService:
    @staticmethod
    def forecast_material_consumption(db: Session, project_id: int, resource_id: int) -> Dict[str, Any]:
        """
        Calculates upcoming material requirements against current stock to forecast shortages.
        """
        resource = db.query(Resource).filter(Resource.id == resource_id, Resource.project_id == project_id).first()
        if not resource:
            raise ValueError(f"Resource {resource_id} not found")

        current_stock = resource.available_capacity or 0.0

        # Sum requirements across pending or in-progress activities
        plans = (
            db.query(ActivityResourcePlan)
            .join(Activity)
            .filter(
                Activity.project_id == project_id,
                ActivityResourcePlan.resource_id == resource_id,
                Activity.status.in_(["NOT_STARTED", "IN_PROGRESS", "DELAYED"])
            )
            .all()
        )

        expected_req = sum(p.required_qty for p in plans) if plans else (current_stock * 1.15)
        predicted_shortage = max(0.0, expected_req - current_stock)

        shortage_prob = 0.0
        if current_stock <= 0:
            shortage_prob = 1.0
        elif expected_req > current_stock:
            deficit_ratio = (expected_req - current_stock) / expected_req
            shortage_prob = min(0.98, max(0.3, deficit_ratio * 1.2))
        else:
            buffer = (current_stock - expected_req) / max(1.0, expected_req)
            shortage_prob = max(0.02, 0.2 - buffer * 0.2)

        pred_record = MLMaterialPrediction(
            project_id=project_id,
            resource_id=resource_id,
            prediction_date=date.today(),
            expected_consumption=round(expected_req, 1),
            current_stock=round(current_stock, 1),
            predicted_shortage=round(predicted_shortage, 1),
            shortage_probability=round(shortage_prob, 2),
            model_version="v1.0",
            prediction_mode="BASELINE"
        )
        db.add(pred_record)
        db.commit()

        return {
            "resource_id": resource.id,
            "resource_name": resource.type_name,
            "unit": resource.unit,
            "current_stock": round(current_stock, 1),
            "expected_consumption": round(expected_req, 1),
            "predicted_shortage": round(predicted_shortage, 1),
            "shortage_probability": round(shortage_prob, 2),
            "prediction_mode": "BASELINE",
            "model_version": "v1.0"
        }
