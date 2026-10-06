from typing import Dict, Any, Tuple
import numpy as np
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.model_registry import ModelRegistryService

class DelayPredictionService:
    @staticmethod
    def predict_delay(feat: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts:
        - Delay Probability (0.0 to 1.0)
        - Risk Level (LOW, MEDIUM, HIGH, CRITICAL)
        - Predicted Delay Days
        Uses ML model if trained; otherwise falls back to Rule-Based Construction Benchmark.
        """
        model = ModelRegistryService.load_model("delay_model")
        mode = "ML" if model is not None else "BASELINE"

        if model is not None:
            X = FeatureEngineering.to_feature_vector(feat)
            try:
                # Binary probability of delay
                probs = model.predict_proba(X)[0]
                prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
            except Exception:
                prob = float(model.predict(X)[0])
        else:
            # Rule-Based Cold-Start Estimator
            base_risk = 0.15
            # Impact of labour shortage
            shortage = feat.get("labour_shortage", 0.0)
            if shortage > 5:
                base_risk += 0.35
            elif shortage > 2:
                base_risk += 0.20

            # Impact of material shortage
            mat_avail = feat.get("material_availability_pct", 100.0)
            if mat_avail < 70.0:
                base_risk += 0.30
            elif mat_avail < 90.0:
                base_risk += 0.15

            # Impact of blockers
            blockers = feat.get("open_blockers_count", 0.0)
            base_risk += blockers * 0.15

            # Impact of progress variance
            variance = feat.get("progress_variance_pct", 0.0)
            if variance < -15.0:
                base_risk += 0.25
            elif variance < -5.0:
                base_risk += 0.10

            # Critical path sensitivity
            if feat.get("critical_path_flag", 0.0) > 0.5:
                base_risk += 0.10

            prob = min(0.98, max(0.05, base_risk))

        # Risk Level categorization
        if prob >= 0.75:
            risk_level = "CRITICAL" if feat.get("critical_path_flag", 0.0) > 0.5 else "HIGH"
        elif prob >= 0.45:
            risk_level = "HIGH" if feat.get("critical_path_flag", 0.0) > 0.5 else "MEDIUM"
        elif prob >= 0.25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Predicted delay days
        planned_dur = feat.get("planned_duration", 5.0)
        predicted_delay_days = round(prob * planned_dur * 0.4 + (feat.get("open_blockers_count", 0.0) * 1.5), 1)

        return {
            "delay_probability": round(prob, 2),
            "risk_level": risk_level,
            "predicted_delay_days": predicted_delay_days,
            "confidence_score": 0.92 if mode == "ML" else 0.78,
            "model_version": "v1.0" if mode == "ML" else "rule_engine_v1",
            "prediction_mode": mode
        }
