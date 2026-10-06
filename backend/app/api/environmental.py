import json
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import SiteEnvironmentalLog, SiteValidationRecord, Project, User, Activity
from backend.app.schemas.all_schemas import (
    EnvironmentalAnalysisCreate, EnvironmentalAnalysisResponse,
    ValidationChecklistSubmission
)
from backend.app.services.weather_soil_service import WeatherSoilService
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["Site Weather & Geotechnical Soil Analysis"])

def _format_env_log_response(log: SiteEnvironmentalLog) -> dict:
    geo_details = None
    if getattr(log, "geotechnical_details_json", None):
        try:
            geo_details = json.loads(log.geotechnical_details_json)
        except Exception:
            pass

    return {
        "id": log.id,
        "project_id": log.project_id,
        "recorded_date": log.recorded_date,
        "temperature_c": log.temperature_c,
        "wind_speed_kmh": log.wind_speed_kmh,
        "weather_condition": log.weather_condition,
        "humidity_percent": log.humidity_percent,
        "rainfall_mm": log.rainfall_mm,
        "soil_type": log.soil_type,
        "safe_bearing_capacity_kpa": log.safe_bearing_capacity_kpa,
        "moisture_content_percent": log.moisture_content_percent,
        "water_table_depth_m": log.water_table_depth_m,
        "compaction_percent": log.compaction_percent,
        "soil_report_filename": log.soil_report_filename,
        "overall_site_risk": log.overall_site_risk,
        "wind_risk_assessment": log.wind_risk_assessment,
        "temperature_risk_assessment": log.temperature_risk_assessment,
        "soil_risk_assessment": log.soil_risk_assessment,
        "affected_activities": json.loads(log.affected_activities_json or "[]"),
        "recommendations": json.loads(log.recommendations_json or "[]"),
        "geotechnical_details": geo_details,
        "manager_notes": log.manager_notes,
        "created_at": log.created_at
    }

@router.post("/api/projects/{project_id}/environmental-analysis", response_model=EnvironmentalAnalysisResponse, status_code=status.HTTP_201_CREATED)
def submit_environmental_analysis(
    project_id: int,
    data: EnvironmentalAnalysisCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Manager updates site weather data (wind speed, temperature, rainfall, humidity)
    and soil level report (bearing capacity, soil type, moisture, water table, compaction).
    The system runs multi-criteria engineering analysis to assess crane safety,
    soil bearing stability, and impact on current project activities.
    """
    user_id = current_user.id if current_user else None
    log = WeatherSoilService.record_and_analyze(db=db, project_id=project_id, data=data, user_id=user_id)

    AuditService.log_action(
        db,
        action="UPDATE_SITE_WEATHER_SOIL",
        entity_name="SiteEnvironmentalLog",
        entity_id=str(log.id),
        new_values=data.model_dump(mode="json"),
        user_id=user_id
    )

    return _format_env_log_response(log)

@router.get("/api/projects/{project_id}/environmental-analysis/latest", response_model=Optional[EnvironmentalAnalysisResponse])
def get_latest_environmental_analysis(project_id: int, db: Session = Depends(get_db)):
    """Retrieves the latest recorded weather and soil report analysis for a project."""
    log = (
        db.query(SiteEnvironmentalLog)
        .filter(SiteEnvironmentalLog.project_id == project_id)
        .order_by(SiteEnvironmentalLog.id.desc())
        .first()
    )
    if not log:
        # Return default analysis if none exists yet
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        default_data = EnvironmentalAnalysisCreate()
        log = WeatherSoilService.record_and_analyze(db=db, project_id=project_id, data=default_data)

    return _format_env_log_response(log)

@router.get("/api/projects/{project_id}/environmental-analysis/history", response_model=List[EnvironmentalAnalysisResponse])
def get_environmental_analysis_history(project_id: int, db: Session = Depends(get_db)):
    """Retrieves history of weather & soil recordings."""
    logs = (
        db.query(SiteEnvironmentalLog)
        .filter(SiteEnvironmentalLog.project_id == project_id)
        .order_by(SiteEnvironmentalLog.id.desc())
        .limit(30)
        .all()
    )
    return [_format_env_log_response(log) for log in logs]

@router.post("/api/environmental-analysis/parse-report")
def parse_soil_report(payload: dict):
    """
    Parses pasted text or simulated document extract from a soil level report,
    returning structured geotechnical parameters.
    """
    raw_text = payload.get("raw_text", "")
    filename = payload.get("filename")
    parsed = WeatherSoilService.parse_soil_report_content(raw_text=raw_text, filename=filename)
    return parsed

# Validation endpoints
@router.post("/api/projects/{project_id}/validations", status_code=status.HTTP_201_CREATED)
def submit_site_validation(
    project_id: int,
    submission: ValidationChecklistSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Manager validates milestone/stage or site safety clearance with a multi-item checklist.
    """
    val = SiteValidationRecord(
        project_id=project_id,
        activity_id=submission.activity_id,
        validation_type=submission.validation_type or "STAGE_MILESTONE",
        overall_decision=submission.overall_decision,
        validated_by=submission.validated_by,
        validation_notes=submission.validation_notes,
        checklist_json=json.dumps([item.model_dump() for item in submission.checklist_items])
    )
    db.add(val)
    db.commit()
    db.refresh(val)

    AuditService.log_action(
        db,
        action="MANAGER_VALIDATION_SUBMITTED",
        entity_name="SiteValidationRecord",
        entity_id=str(val.id),
        new_values=submission.model_dump(mode="json"),
        user_id=current_user.id if current_user else None
    )

    return {
        "id": val.id,
        "project_id": val.project_id,
        "overall_decision": val.overall_decision,
        "validated_by": val.validated_by,
        "validation_notes": val.validation_notes,
        "checklist": submission.checklist_items,
        "created_at": val.created_at
    }

@router.get("/api/projects/{project_id}/validations")
def list_site_validations(project_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(SiteValidationRecord)
        .filter(SiteValidationRecord.project_id == project_id)
        .order_by(SiteValidationRecord.id.desc())
        .all()
    )
    results = []
    for r in records:
        results.append({
            "id": r.id,
            "project_id": r.project_id,
            "activity_id": r.activity_id,
            "validation_type": r.validation_type,
            "overall_decision": r.overall_decision,
            "validated_by": r.validated_by,
            "validation_notes": r.validation_notes,
            "checklist": json.loads(r.checklist_json or "[]"),
            "created_at": r.created_at
        })
    return results
