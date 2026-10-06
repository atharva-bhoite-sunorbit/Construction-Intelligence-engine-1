import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from datetime import date
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.all_models import Project, Activity, DailyProgress, SiteEnvironmentalLog, SiteValidationRecord
from backend.app.services.weather_soil_service import WeatherSoilService
from backend.app.schemas.all_schemas import (
    EnvironmentalAnalysisCreate, ValidationChecklistSubmission, ChecklistItemSubmission
)

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_soil_report_parser():
    sample_borelog = """
    GEOTECHNICAL BOREHOLE LOG - BH-02
    Soil Description: Marine Clay (High Plasticity) with silty seams
    Safe Bearing Capacity (SBC): 135.0 kN/m2 at depth 3.0m
    Groundwater Table: GWL at 1.7 meters depth
    Standard Proctor Compaction: 91.5% dry density achieved
    Moisture Content is 23.5%
    """
    parsed = WeatherSoilService.parse_soil_report_content(sample_borelog, "borelog_bh02.pdf")
    assert "Marine Clay" in parsed["soil_type"]
    assert parsed["safe_bearing_capacity_kpa"] == 135.0
    assert parsed["water_table_depth_m"] == 1.7
    assert parsed["compaction_percent"] == 91.5
    assert parsed["moisture_content_percent"] == 23.5

def test_weather_and_soil_analysis_high_wind_and_soil_deficit(db):
    # Retrieve or create a project
    project = db.query(Project).first()
    assert project is not None

    activities = db.query(Activity).filter(Activity.project_id == project.id).all()

    # Test with high wind (42 km/h > 38 km/h crane shutdown limit), low SBC (130 kPa), and shallow water table (1.6m)
    analysis = WeatherSoilService.perform_engineering_analysis(
        project=project,
        activities=activities,
        temp_c=40.0, # Extreme Heat
        wind_kmh=42.0, # High Wind
        weather_condition="High Wind",
        humidity_pct=65.0,
        rainfall_mm=0.0,
        soil_type="Marine Clay (High Plasticity)",
        sbc_kpa=130.0, # Low bearing
        moisture_pct=24.0,
        water_table_m=1.6, # Shallow water table
        compaction_pct=91.0 # Compaction deficit
    )

    assert analysis["overall_site_risk"] in ["HIGH_RISK", "CRITICAL_HALT"]
    assert "38 km/h" in analysis["wind_risk_assessment"]
    assert "ACI 305R" in analysis["temperature_risk_assessment"]
    assert "130.0 kPa" in analysis["soil_risk_assessment"]
    assert len(analysis["recommendations"]) >= 3

def test_environmental_log_db_persistence(db):
    project = db.query(Project).first()
    assert project is not None

    data = EnvironmentalAnalysisCreate(
        temperature_c=32.0,
        wind_speed_kmh=20.0,
        weather_condition="Clear",
        humidity_percent=55.0,
        rainfall_mm=0.0,
        soil_type="Sandy Loam",
        safe_bearing_capacity_kpa=220.0,
        moisture_content_percent=14.0,
        water_table_depth_m=3.5,
        compaction_percent=96.0,
        manager_notes="Site weather normal; foundation compaction approved."
    )

    log = WeatherSoilService.record_and_analyze(db=db, project_id=project.id, data=data)
    assert log.id is not None
    assert log.overall_site_risk == "SAFE"
    assert log.safe_bearing_capacity_kpa == 220.0
    assert log.compaction_percent == 96.0

def test_daily_progress_validation_checklist(db):
    # Find a daily progress entry
    prog = db.query(DailyProgress).first()
    if not prog:
        act = db.query(Activity).first()
        prog = DailyProgress(
            project_id=act.project_id,
            activity_id=act.id,
            report_date=date.today(),
            planned_quantity=20.0,
            actual_quantity=19.0,
            workers_available=10,
            workers_assigned=10
        )
        db.add(prog)
        db.commit()
        db.refresh(prog)

    # Validate using checklist
    items = [
        ChecklistItemSubmission(category="Safety", item="Wind & Weather Clearance", status="PASS"),
        ChecklistItemSubmission(category="Quality", item="Rebar Placement & Formwork Alignment", status="PASS"),
        ChecklistItemSubmission(category="Quality", item="Soil Subgrade Compaction Test (>=95%)", status="PASS"),
        ChecklistItemSubmission(category="Material", item="Material Delivery & Slump Test", status="PASS"),
        ChecklistItemSubmission(category="Muster", item="Headcount & Output Measured", status="PASS"),
    ]

    import json
    from datetime import datetime
    prog.validation_status = "VALIDATED"
    prog.validated_by = "Marcus Brody (Project Director)"
    prog.validated_at = datetime.utcnow()
    prog.validation_checklist_json = json.dumps([i.model_dump() for i in items])
    prog.validation_notes = "Inspected and certified. Safe for subsequent trade."
    db.commit()
    db.refresh(prog)

    assert prog.validation_status == "VALIDATED"
    assert "Marcus Brody" in prog.validated_by
    assert prog.validated_at is not None
    assert "Rebar Placement" in prog.validation_checklist_json
