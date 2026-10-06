from typing import Dict, Any
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.model_registry import ModelRegistryService

class ProductivityPredictionService:
    @staticmethod
    def predict_productivity(feat: Dict[str, Any], unit: str = "units/day") -> Dict[str, Any]:
        """Predicts expected daily productivity based on workers, floor, quantity, weather, and availability."""
        model = ModelRegistryService.load_model("productivity_model")
        mode = "ML" if model is not None else "BASELINE"

        workers = feat.get("workers_assigned", 8.0)
        hours = feat.get("working_hours", 8.0)
        floor = feat.get("floor", 0.0)

        if model is not None:
            X = FeatureEngineering.to_feature_vector(feat)
            pred = float(model.predict(X)[0])
            pred_prod = max(0.1, round(pred, 2))
        else:
            # Benchmark rate: baseline 2.5 units per worker-day, attenuated by floor height and shortages
            height_factor = max(0.7, 1.0 - (floor * 0.015))
            mat_factor = feat.get("material_availability_pct", 100.0) / 100.0
            eq_factor = feat.get("equipment_availability_pct", 100.0) / 100.0
            base_rate = 3.2

            pred_prod = round(workers * base_rate * height_factor * mat_factor * eq_factor, 2)

        return {
            "predicted_daily_productivity": pred_prod,
            "unit": unit,
            "confidence_score": 0.88 if mode == "ML" else 0.76,
            "model_version": "v1.0" if mode == "ML" else "rule_engine_v1",
            "prediction_mode": mode
        }
