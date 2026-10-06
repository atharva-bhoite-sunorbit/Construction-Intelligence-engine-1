import os
import joblib
from typing import Dict, Any, Optional

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

class ModelRegistryService:
    _cached_models: Dict[str, Any] = {}

    @classmethod
    def get_model_path(cls, model_name: str) -> str:
        return os.path.join(MODELS_DIR, f"{model_name}.joblib")

    @classmethod
    def is_model_trained(cls, model_name: str) -> bool:
        return os.path.exists(cls.get_model_path(model_name))

    @classmethod
    def load_model(cls, model_name: str) -> Optional[Any]:
        if model_name in cls._cached_models:
            return cls._cached_models[model_name]

        path = cls.get_model_path(model_name)
        if os.path.exists(path):
            try:
                model = joblib.load(path)
                cls._cached_models[model_name] = model
                return model
            except Exception as e:
                print(f"Error loading model {model_name}: {e}")
                return None
        return None

    @classmethod
    def save_model(cls, model_name: str, model_artifact: Any):
        path = cls.get_model_path(model_name)
        joblib.dump(model_artifact, path)
        cls._cached_models[model_name] = model_artifact
