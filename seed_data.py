import sys
import os
from datetime import date, timedelta
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.app.database.connection import SessionLocal, engine, Base
from backend.app.models.all_models import *
from backend.app.utils.security import get_password_hash
from backend.app.services.template_engine import TemplateEngine
from backend.app.services.scheduling_engine import SchedulingEngine
from backend.app.services.resource_service import ResourceService
from backend.app.services.progress_service import ProgressService
from backend.app.services.forecast_service import ForecastService
from backend.app.ml.training_pipeline import MLTrainingPipeline
from backend.app.services.ai_service import AIService
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.delay_model import DelayPredictionService
from backend.app.ml.duration_model import DurationPredictionService
from backend.app.ml.productivity_model import ProductivityPredictionService
from backend.app.ml.labour_model import LabourPredictionService
from backend.app.ml.material_forecast import MaterialForecastService

def seed_database():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if users exist
        admin = db.query(User).filter(User.email == "admin@construction.ai").first()
        if not admin:
            print("Seeding Users...")
            admin = User(
                email="admin@construction.ai",
                hashed_password=get_password_hash("admin123"),
                full_name="Alexander Vance (Admin)",
                role="Admin"
            )
            pm = User(
                email="pm@construction.ai",
                hashed_password=get_password_hash("pm123"),
                full_name="Marcus Brody (Project Manager)",
                role="Project Manager"
            )
            sm = User(
                email="sm@construction.ai",
                hashed_password=get_password_hash("sm123"),
                full_name="Elena Rostova (Site Manager)",
                role="Site Manager"
            )
            eng = User(
                email="eng@construction.ai",
                hashed_password=get_password_hash("eng123"),
                full_name="Liam Chen (Lead Structural Engineer)",
                role="Engineer"
            )
            db.add_all([admin, pm, sm, eng])
            db.commit()

        # Seed Project 1: The Grand Apex Tower (High-Rise)
        p1 = db.query(Project).filter(Project.code == "PRJ-APEX-01").first()
        if not p1:
            print("Seeding Project 1: The Grand Apex Tower (High-Rise)...")
            start_d = date.today() - timedelta(days=90)
            end_d = start_d + timedelta(days=480)

            p1 = Project(
                name="The Grand Apex Tower",
                code="PRJ-APEX-01",
                construction_type="High-Rise",
                location="742 Evergreen Boulevard, Metro Core",
                num_floors=25,
                num_towers=2,
                built_up_area=48500.0,
                plot_area=12000.0,
                planned_start_date=start_d,
                target_completion_date=end_d,
                project_manager="Marcus Brody",
                site_manager="Elena Rostova",
                contractor="Apex Sterling Infra Ltd.",
                description="Luxury 25-storey dual-tower residential development featuring premium cast-in-place concrete structure, post-tensioned slabs, and panoramic glass facade.",
                status="IN_PROGRESS"
            )
            db.add(p1)
            db.commit()
            db.refresh(p1)

            ResourceService.initialize_standard_resources_for_project(db, p1.id)

            # Generate Auto Plan for Apex Tower (e.g. 5 representative floors for initial view)
            acts, deps = TemplateEngine.generate_plan_for_project(
                project=p1,
                num_floors=5,
                num_towers=1,
                zones_per_floor=1
            )
            for a in acts:
                db.add(a)
            db.flush()
            for d in deps:
                db.add(d)
            db.commit()

            # Schedule
            SchedulingEngine.generate_and_apply_schedule(db, p1.id)

            # Simulate completed & in-progress activities
            all_acts = db.query(Activity).filter(Activity.project_id == p1.id).order_by(Activity.start_date).all()
            for i, a in enumerate(all_acts):
                if i < 4: # Foundation completed
                    a.status = "COMPLETED"
                    a.progress_percent = 100.0
                    a.actual_start_date = a.start_date
                    a.actual_end_date = a.end_date
                    # Daily progress log
                    dp = DailyProgress(
                        project_id=p1.id,
                        activity_id=a.id,
                        report_date=a.end_date,
                        planned_quantity=a.quantity,
                        actual_quantity=a.quantity,
                        workers_available=16,
                        workers_assigned=16,
                        working_hours=8.0,
                        material_availability_percent=100.0,
                        equipment_availability_percent=100.0,
                        daily_productivity=3.8,
                        cumulative_productivity=3.8,
                        planned_progress_percent=100.0,
                        actual_progress_percent=100.0,
                        progress_variance_percent=0.0,
                        weather="Clear"
                    )
                    db.add(dp)
                elif i == 4: # Active Slab Formwork with delay risk
                    a.status = "DELAYED"
                    a.progress_percent = 65.0
                    a.actual_start_date = a.start_date
                    # Daily progress log with variance and shortage
                    dp = DailyProgress(
                        project_id=p1.id,
                        activity_id=a.id,
                        report_date=date.today(),
                        planned_quantity=a.quantity * 0.85,
                        actual_quantity=a.quantity * 0.65,
                        workers_available=14,
                        workers_assigned=11,
                        working_hours=8.0,
                        material_availability_percent=78.0,
                        equipment_availability_percent=85.0,
                        daily_productivity=2.1,
                        cumulative_productivity=2.3,
                        planned_progress_percent=85.0,
                        actual_progress_percent=65.0,
                        progress_variance_percent=-20.0,
                        labour_shortage=5,
                        material_shortage=22.0,
                        issues="Scaffolding prop delivery delayed by 48 hours; trade crew short 5 carpenters.",
                        remarks="Prioritizing central bay decking.",
                        weather="Clear"
                    )
                    db.add(dp)

                    # Add Blocker for this activity
                    blocker = Blocker(
                        project_id=p1.id,
                        activity_id=a.id,
                        category="Labour Shortage",
                        description="Deficit of 5 certified formwork carpenters delaying slab shuttering closure.",
                        severity="HIGH",
                        opened_date=date.today() - timedelta(days=2),
                        expected_resolution=date.today() + timedelta(days=2),
                        status="IN_PROGRESS",
                        mitigation_plan="Mobilizing supplementary carpentry gang from Subcontractor B."
                    )
                    db.add(blocker)

                    obs = SiteObservation(
                        project_id=p1.id,
                        activity_id=a.id,
                        date=date.today(),
                        photo_url="https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=800&q=80",
                        photo_caption="Floor 2 Decking Shuttering in Progress",
                        category="Progress",
                        description="Formwork deck alignment verified up to Grid C-5.",
                        verification_status="VERIFIED"
                    )
                    db.add(obs)
                elif i == 5:
                    a.status = "IN_PROGRESS"
                    a.progress_percent = 30.0
                    a.actual_start_date = a.start_date
                else:
                    a.status = "NOT_STARTED"
                    a.progress_percent = 0.0

            db.commit()

        # Seed Project 2: Titan Gigafactory (Factory / Industrial)
        p2 = db.query(Project).filter(Project.code == "PRJ-GIGA-02").first()
        if not p2:
            print("Seeding Project 2: Titan Gigafactory (Industrial)...")
            start_d2 = date.today() - timedelta(days=40)
            end_d2 = start_d2 + timedelta(days=280)

            p2 = Project(
                name="Titan Gigafactory Logistics & Assembly Plant",
                code="PRJ-GIGA-02",
                construction_type="Factory",
                location="Plot 18, Industrial Corridor Zone 4",
                num_floors=2,
                num_towers=1,
                built_up_area=72000.0,
                plot_area=150000.0,
                planned_start_date=start_d2,
                target_completion_date=end_d2,
                project_manager="Sarah Jenkins",
                site_manager="Tariq Mansour",
                contractor="Vanguard Heavy Industrial Corp.",
                description="Advanced manufacturing facility featuring 32m clear-span structural steel framing, laser-screed FM2 high-tolerance flooring, and heavy-duty EOT cranes.",
                status="IN_PROGRESS"
            )
            db.add(p2)
            db.commit()
            db.refresh(p2)

            ResourceService.initialize_standard_resources_for_project(db, p2.id)

            acts2, deps2 = TemplateEngine.generate_plan_for_project(
                project=p2,
                num_floors=1,
                num_towers=1
            )
            for a in acts2:
                db.add(a)
            db.flush()
            for d in deps2:
                db.add(d)
            db.commit()

            SchedulingEngine.generate_and_apply_schedule(db, p2.id)

            # Set progress on factory
            fac_acts = db.query(Activity).filter(Activity.project_id == p2.id).order_by(Activity.start_date).all()
            if len(fac_acts) >= 3:
                fac_acts[0].status = "COMPLETED"
                fac_acts[0].progress_percent = 100.0
                fac_acts[1].status = "IN_PROGRESS"
                fac_acts[1].progress_percent = 70.0
                fac_acts[2].status = "NOT_STARTED"
                db.commit()

        # Run predictions & generate AI recommendations for both projects
        for p in [p1, p2]:
            if not p:
                continue
            acts = db.query(Activity).filter(Activity.project_id == p.id).all()
            today = date.today()
            for act in acts:
                feat = FeatureEngineering.extract_features_for_activity(db, act, p)
                d_out = DelayPredictionService.predict_delay(feat)
                db.add(MLDelayPrediction(
                    project_id=p.id,
                    activity_id=act.id,
                    prediction_date=today,
                    delay_probability=d_out["delay_probability"],
                    risk_level=d_out["risk_level"],
                    predicted_delay_days=d_out["predicted_delay_days"],
                    confidence_score=d_out["confidence_score"],
                    model_version=d_out["model_version"],
                    prediction_mode=d_out["prediction_mode"]
                ))
                dur_out = DurationPredictionService.predict_duration(feat)
                db.add(MLDurationPrediction(
                    project_id=p.id,
                    activity_id=act.id,
                    prediction_date=today,
                    predicted_duration=dur_out["predicted_duration"],
                    interval_lower=dur_out["interval_lower"],
                    interval_upper=dur_out["interval_upper"],
                    confidence_score=dur_out["confidence_score"],
                    model_version=dur_out["model_version"],
                    prediction_mode=dur_out["prediction_mode"]
                ))
            db.commit()

            # Materials forecast
            for m in db.query(Resource).filter(Resource.project_id == p.id, Resource.category == "Material").all():
                MaterialForecastService.forecast_material_consumption(db, p.id, m.id)

            # Completion forecast & AI
            ForecastService.calculate_completion_forecast(db, p.id)
            AIService.generate_recommendations_for_project(db, p.id)
            AIService.generate_daily_management_summary(db, p.id)

        print("\nSeed data created successfully!")
        print("Ready with 2 enterprise projects, activities, schedules, ML predictions, and AI recommendations.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
