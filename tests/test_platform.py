import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from datetime import date, timedelta
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.all_models import *
from backend.app.services.template_engine import TemplateEngine
from backend.app.services.dependency_engine import DependencyEngine, CircularDependencyException
from backend.app.services.cpm_engine import CPMEngine
from backend.app.services.scheduling_engine import SchedulingEngine
from backend.app.services.progress_service import ProgressService
from backend.app.services.impact_service import ImpactService
from backend.app.services.forecast_service import ForecastService
from backend.app.services.ai_service import AIService
from backend.app.ml.feature_engineering import FeatureEngineering
from backend.app.ml.delay_model import DelayPredictionService
from backend.app.ml.duration_model import DurationPredictionService

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_project_and_template_engine(db):
    # Test Project Creation
    existing = db.query(Project).filter(Project.code == "PRJ-TEST-COMM-01").first()
    if existing:
        db.delete(existing)
        db.commit()

    p = Project(
        name="Test Commercial Hub",
        code="PRJ-TEST-COMM-01",
        construction_type="Commercial",
        location="Downtown Test District",
        num_floors=3,
        num_towers=1,
        built_up_area=15000.0,
        planned_start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=200)
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    assert p.id is not None

    # Test Auto Plan Generation
    acts, deps = TemplateEngine.generate_plan_for_project(p, num_floors=3, num_towers=1)
    assert len(acts) > 0
    assert len(deps) > 0

    for a in acts:
        db.add(a)
    db.flush()
    for d in deps:
        db.add(d)
    db.commit()

    # Test Scheduling Engine (CPM)
    sched = SchedulingEngine.generate_and_apply_schedule(db, p.id)
    assert sched["total_activities"] == len(acts)
    assert sched["critical_activities_count"] > 0

def test_circular_dependency_detection(db):
    # Create 3 activities A -> B -> C -> A
    existing_cycle = db.query(Project).filter(Project.code == "PRJ-CYCLE-01").first()
    if existing_cycle:
        db.delete(existing_cycle)
        db.commit()

    p = Project(
        name="Cycle Test Project",
        code="PRJ-CYCLE-01",
        construction_type="Residential",
        location="Test Loc",
        built_up_area=5000.0,
        planned_start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=100)
    )
    db.add(p)
    db.commit()

    a1 = Activity(project_id=p.id, name="Excavation", start_date=date.today(), end_date=date.today() + timedelta(days=5), planned_duration=5)
    a2 = Activity(project_id=p.id, name="Foundation", start_date=date.today(), end_date=date.today() + timedelta(days=5), planned_duration=5)
    a3 = Activity(project_id=p.id, name="Backfilling", start_date=date.today(), end_date=date.today() + timedelta(days=5), planned_duration=5)
    db.add_all([a1, a2, a3])
    db.commit()

    d1 = ActivityDependency(project_id=p.id, predecessor_id=a1.id, successor_id=a2.id)
    d2 = ActivityDependency(project_id=p.id, predecessor_id=a2.id, successor_id=a3.id)
    db.add_all([d1, d2])
    db.commit()

    # Attempting to add a3 -> a1 must raise CircularDependencyException
    with pytest.raises(CircularDependencyException):
        DependencyEngine.validate_no_cycles(
            activities=[a1, a2, a3],
            dependencies=[d1, d2],
            new_dep=(a3.id, a1.id)
        )

def test_progress_and_productivity_computation(db):
    p = db.query(Project).filter(Project.code == "PRJ-APEX-01").first()
    assert p is not None
    act = db.query(Activity).filter(Activity.project_id == p.id).first()
    assert act is not None

    record = ProgressService.record_daily_progress(
        db=db,
        project_id=p.id,
        activity_id=act.id,
        report_date=date.today(),
        planned_quantity=20.0,
        actual_quantity=18.0,
        workers_available=10,
        workers_assigned=8,
        working_hours=8.0,
        material_availability_percent=90.0,
        equipment_availability_percent=100.0
    )
    assert record.id is not None
    assert record.daily_productivity > 0.0
    assert record.labour_shortage >= 0

def test_ml_and_ai_services(db):
    p = db.query(Project).filter(Project.code == "PRJ-APEX-01").first()
    act = db.query(Activity).filter(Activity.project_id == p.id).first()

    feat = FeatureEngineering.extract_features_for_activity(db, act, p)
    assert "c_type_encoded" in feat
    assert "planned_duration" in feat

    delay_pred = DelayPredictionService.predict_delay(feat)
    assert "delay_probability" in delay_pred
    assert delay_pred["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    dur_pred = DurationPredictionService.predict_duration(feat)
    assert dur_pred["predicted_duration"] > 0

    impact = ImpactService.analyze_activity_delay(db, p.id, act.id, 4.0)
    assert "affected_activities" in impact
    assert "project_completion_slippage_days" in impact

    # AI chatbot query with DB context
    chat_resp = AIService.answer_assistant_query(db, "Which activities are delayed?", p.id)
    assert "response" in chat_resp
    assert len(chat_resp["response"]) > 0
