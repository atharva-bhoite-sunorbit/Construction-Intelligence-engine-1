import sys
import os

# Add root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.app.database.connection import SessionLocal, engine, Base
from backend.app.models.all_models import *
from backend.app.ml.training_pipeline import MLTrainingPipeline

def main():
    print("=======================================================")
    print("   CONSTRUCTION INTELLIGENCE PLATFORM - ML TRAINING    ")
    print("=======================================================")
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Starting Model Training Pipeline:")
        print("1. Generating Historical Construction Training Data...")
        print("2. Engineering 20-dimensional Feature Vectors...")
        print("3. Training & Evaluating Candidate Models (RF, GradientBoosting, Logistic)...")
        results = MLTrainingPipeline.train_all_models(db)
        print("\nModel Training Complete! Registered Best Models:")
        for model_name, metrics in results.items():
            print(f"  * {model_name:20s}: {metrics}")
        print("\nAll model artifacts serialized into models/ directory.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
