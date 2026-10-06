from typing import Dict, Any
import numpy as np
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.model_registry import ModelRegistryService

class DurationPredictionService:
    @staticmethod
    def predict_duration(feat: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts:
        - Predicted Total Duration (days)
        - Prediction Interval (Lower, Upper)
        - Confidence Score
        """
        model = ModelRegistryService.load_model("duration_model")
        mode = "ML" if model is not None else "BASELINE"
        planned_dur = feat.get("planned_duration", 5.0)

        if model is not None:
            X = FeatureEngineering.to_feature_vector(feat)
            pred = float(model.predict(X)[0])
            pred_dur = max(1.0, round(pred, 1))
        else:
            # Baseline benchmark
            multiplier = 1.0
            if feat.get("labour_shortage", 0.0) > 3:
                multiplier += 0.25
            if feat.get("material_availability_pct", 100.0) < 80.0:
                multiplier += 0.20
            if feat.get("open_blockers_count", 0.0) > 0:
                multiplier += 0.15 * feat.get("open_blockers_count", 0.0)

            pred_dur = round(planned_dur * multiplier, 1)

        interval_range = max(1.0, round(pred_dur * 0.15, 1))
        lower = max(1.0, round(pred_dur - interval_range, 1))
        upper = round(pred_dur + interval_range, 1)

        return {
            "predicted_duration": pred_dur,
            "interval_lower": lower,
            "interval_upper": upper,
            "confidence_score": 0.89 if mode == "ML" else 0.75,
            "model_version": "v1.0" if mode == "ML" else "rule_engine_v1",
            "prediction_mode": mode
        }
