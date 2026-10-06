from typing import Dict, Any
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.model_registry import ModelRegistryService

class LabourPredictionService:
    @staticmethod
    def predict_labour_requirement(feat: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts required workers for an activity based on quantity, target duration, floor, and productivity benchmarks.
        """
        model = ModelRegistryService.load_model("labour_model")
        mode = "ML" if model is not None else "BASELINE"

        qty = max(1.0, feat.get("quantity", 10.0))
        target_dur = max(1.0, feat.get("planned_duration", 5.0))
        floor = feat.get("floor", 0.0)

        if model is not None:
            X = FeatureEngineering.to_feature_vector(feat)
            pred = float(model.predict(X)[0])
            workers = max(1, int(round(pred)))
        else:
            # Baseline: daily needed = (qty / target_dur) / (productivity per worker)
            daily_output_target = qty / target_dur
            height_penalty = 1.0 + (floor * 0.015)
            # Default average productivity constant
            est_prod_per_worker = 2.5
            workers = max(2, int(round((daily_output_target / est_prod_per_worker) * height_penalty)))

        return {
            "predicted_workers_required": workers,
            "confidence_score": 0.87 if mode == "ML" else 0.80,
            "model_version": "v1.0" if mode == "ML" else "rule_engine_v1",
            "prediction_mode": mode
        }
