from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.environmental import router
from backend.app.database.connection import Base
from backend.app.models.all_models import Activity, Project, SiteEnvironmentalLog, User
from backend.app.schemas.all_schemas import EnvironmentalAnalysisCreate
from backend.app.services.weather_soil_service import WeatherSoilService


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[Project.__table__, User.__table__, Activity.__table__, SiteEnvironmentalLog.__table__],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_weather_report_parser_extracts_and_converts_observations():
    report = """
    Site Weather Observation
    Ambient Temperature: 95 °F
    Wind speed: 10 m/s
    Relative humidity: 72%
    Daily rainfall: 0.5 inches
    Condition: Thunderstorm warning
    """

    parsed = WeatherSoilService.parse_weather_report_content(report, "site-weather.txt")

    assert parsed["temperature_c"] == 35.0
    assert parsed["wind_speed_kmh"] == 36.0
    assert parsed["humidity_percent"] == 72.0
    assert parsed["rainfall_mm"] == 12.7
    assert parsed["weather_condition"] == "Thunderstorm"
    assert parsed["weather_report_filename"] == "site-weather.txt"
    assert set(parsed["extracted_fields"]) == {
        "temperature_c",
        "wind_speed_kmh",
        "humidity_percent",
        "rainfall_mm",
        "weather_condition",
    }
    assert parsed["warnings"] == []


def test_weather_report_parser_preserves_unreported_values_as_missing():
    parsed = WeatherSoilService.parse_weather_report_content(
        "Weather bulletin\nWind speed: 45 km/h",
        "wind-only.txt",
    )

    assert parsed["wind_speed_kmh"] == 45.0
    assert parsed["temperature_c"] is None
    assert parsed["rainfall_mm"] is None
    assert any("existing form values were left unchanged" in warning for warning in parsed["warnings"])


def test_zero_rainfall_measurement_does_not_claim_rainy_conditions():
    parsed = WeatherSoilService.parse_weather_report_content(
        "Daily weather\nRainfall: 0 mm\nWind speed: 10 km/h",
        "clear-weather.txt",
    )

    assert parsed["rainfall_mm"] == 0.0
    assert parsed["weather_condition"] is None


def test_weather_report_parser_rejects_unreadable_or_unrelated_text():
    try:
        WeatherSoilService.parse_weather_report_content("Construction progress report")
    except ValueError as exc:
        assert "No supported weather readings" in str(exc)
    else:
        raise AssertionError("Expected unrelated document text to be rejected.")


def test_weather_report_upload_endpoint_extracts_text_and_returns_readings():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/api/environmental-analysis/parse-weather-report",
        files={
            "file": (
                "weekly-weather.txt",
                b"Temperature: 34 C\nWind speed: 42 km/h\nHumidity: 65%\nRainfall: 18 mm\nHeavy rain",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["temperature_c"] == 34.0
    assert data["wind_speed_kmh"] == 42.0
    assert data["humidity_percent"] == 65.0
    assert data["rainfall_mm"] == 18.0
    assert data["weather_condition"] == "Heavy Rain"
    assert data["weather_report_filename"] == "weekly-weather.txt"
    assert "Wind speed: 42 km/h" in data["raw_text"]


def test_weather_report_upload_endpoint_returns_clear_error_for_non_weather_file():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/api/environmental-analysis/parse-weather-report",
        files={"file": ("notes.txt", b"Construction progress report", "text/plain")},
    )

    assert response.status_code == 422
    assert "No supported weather readings" in response.json()["detail"]


def test_weather_report_source_is_persisted_with_engineering_analysis(db):
    project = Project(
        name="Weather Report Persistence Test",
        code="PRJ-WEATHER-REPORT-TEST",
        construction_type="Residential",
        location="Test site",
        built_up_area=1000,
        planned_start_date=date(2028, 1, 1),
        target_completion_date=date(2028, 12, 31),
    )
    db.add(project)
    db.commit()
    raw_report = "Temperature: 34 C\nWind speed: 42 km/h\nHumidity: 65%\nRainfall: 18 mm"

    log = WeatherSoilService.record_and_analyze(
        db=db,
        project_id=project.id,
        data=EnvironmentalAnalysisCreate(
            temperature_c=34,
            wind_speed_kmh=42,
            weather_condition="Heavy Rain",
            humidity_percent=65,
            rainfall_mm=18,
            weather_report_filename="weekly-weather.txt",
            weather_report_raw_text=raw_report,
        ),
    )

    stored = db.query(SiteEnvironmentalLog).filter_by(id=log.id).one()
    assert stored.weather_report_filename == "weekly-weather.txt"
    assert stored.weather_report_raw_text == raw_report
    assert stored.wind_speed_kmh == 42
    assert "38 km/h" in stored.wind_risk_assessment
