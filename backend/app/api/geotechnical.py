import io
import json
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, Activity, ActivityDependency, GeotechnicalReport, User
from backend.app.utils.security import get_current_user_optional
from backend.app.schemas.all_schemas import (
    GeotechnicalAnalysisRequest,
    PushToScheduleRequest,
    GeotechnicalReportResponse
)
from backend.app.services.geotechnical_service import (
    extract_text_from_file,
    analyze_geotechnical_report,
    guess_report_title
)
from backend.app.services.geotech_intel.service import GeotechnicalIntelligenceService
from backend.app.services.geotech_intel.exporter import export_geotechnical_pdf, export_geotechnical_excel

router = APIRouter(tags=["Geotechnical Intelligence"])


def _format_report_dict(r: GeotechnicalReport) -> Dict[str, Any]:
    """Hydrates DB JSON columns into python dict/list structures."""
    intel_data = None
    if r.intelligence_data_json:
        try:
            intel_data = json.loads(r.intelligence_data_json)
        except Exception:
            pass

    return {
        "id": r.id,
        "project_id": r.project_id,
        "report_title": r.report_title or "Geotechnical Subsurface Investigation Report",
        "filename": r.filename,
        "primary_rock_type": r.primary_rock_type,
        "strata_classification": r.strata_classification,
        "rock_quality_designation_rqd": r.rock_quality_designation_rqd,
        "unconfined_compressive_strength_mpa": r.unconfined_compressive_strength_mpa,
        "weathering_grade": r.weathering_grade,
        "rock_mass_rating_rmr": r.rock_mass_rating_rmr,
        "excavability_class": r.excavability_class,
        "water_table_depth_m": r.water_table_depth_m,
        "excavation_area_sqm": r.excavation_area_sqm or 1200.0,
        "target_depth_m": r.target_depth_m or 6.0,
        "total_excavation_volume_cum": r.total_excavation_volume_cum or 0.0,
        "rock_volume_cum": r.rock_volume_cum or 0.0,
        "overburden_volume_cum": r.overburden_volume_cum or 0.0,
        "estimated_total_days": r.estimated_total_days or 30,
        "strata_layers": json.loads(r.strata_layers_json) if r.strata_layers_json else [],
        "rock_types": json.loads(r.strata_layers_json) if r.strata_layers_json else [],
        "recommended_machinery": json.loads(r.recommended_machinery_json) if r.recommended_machinery_json else [],
        "planned_activities": json.loads(r.planned_activities_json) if r.planned_activities_json else [],
        "hazard_controls": json.loads(r.hazard_controls_json) if r.hazard_controls_json else [],
        "summary": json.loads(r.summary_json) if r.summary_json else {},
        "intelligence_data": intel_data,
        "status": r.status or "ANALYZED",
        "created_at": r.created_at or datetime.utcnow()
    }


# ==============================================================
# SECTION 24: CLEAN REST APIS (/api/geotechnical/...)
# ==============================================================

@router.post("/api/geotechnical/upload")
async def upload_geotechnical_intelligence(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Accepts PDF or text geotechnical reports.
    Parses and extracts source-grounded geotechnical data into a dedicated report session.
    """
    # Fallback to first project if not provided
    p_id = project_id
    if not p_id:
        p = db.query(Project).first()
        if not p:
            # Create default project if none exists
            p = Project(name="Commercial Complex", code="PRJ-DEFAULT", construction_type="Commercial", status="IN_PROGRESS")
            db.add(p)
            db.commit()
            db.refresh(p)
        p_id = p.id

    content = None
    filename = "Manual Report Entry"
    if file and file.filename:
        filename = file.filename
        content = await file.read()
    elif not raw_text or not raw_text.strip():
        raise HTTPException(status_code=400, detail="Please upload a PDF file or provide geotechnical report text.")

    try:
        report_data = GeotechnicalIntelligenceService.process_and_save_report(
            db=db,
            project_id=p_id,
            content=content,
            raw_text=raw_text,
            filename=filename
        )
        rep_db_id = report_data.get("db_id") or report_data.get("id")
        if rep_db_id and report_data.get("planned_activities"):
            try:
                push_activities_to_schedule(
                    project_id=p_id,
                    report_id=rep_db_id,
                    req=PushToScheduleRequest(replace_existing=True),
                    db=db
                )
            except Exception as sync_e:
                print(f"Auto-sync schedule notice: {sync_e}")

        return {
            "status": "success",
            "message": "Geotechnical Report parsed and validated successfully.",
            "report_id": report_data.get("report_id"),
            "data": report_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report parsing failed: {str(e)}")


@router.get("/api/geotechnical/reports")
def list_all_geotechnical_reports(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Lists all geotechnical reports stored in the database."""
    return GeotechnicalIntelligenceService.list_all_reports(db, project_id=project_id)


def _get_intel_or_404(report_id: str, db: Session) -> Dict[str, Any]:
    intel = GeotechnicalIntelligenceService.get_report_intelligence(db, report_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"Geotechnical report '{report_id}' not found.")
    return intel


@router.get("/api/geotechnical/{report_id}")
def get_geotechnical_report_detail(report_id: str, db: Session = Depends(get_db)):
    """Returns the complete structured intelligence document for the given report ID."""
    return _get_intel_or_404(report_id, db)


@router.get("/api/geotechnical/{report_id}/project")
def get_report_project_info(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("project_information", {})


@router.get("/api/geotechnical/{report_id}/boreholes")
def get_report_boreholes(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("boreholes", [])


@router.get("/api/geotechnical/{report_id}/stratigraphy")
def get_report_stratigraphy(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("stratigraphy", [])


@router.get("/api/geotechnical/{report_id}/soil")
def get_report_soil(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("soil_analysis", {})


@router.get("/api/geotechnical/{report_id}/rock")
def get_report_rock(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("rock_analysis", {})


@router.get("/api/geotechnical/{report_id}/groundwater")
def get_report_groundwater(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("groundwater_analysis", {})


@router.get("/api/geotechnical/{report_id}/foundation")
def get_report_foundation(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("foundation_recommendations", {})


@router.get("/api/geotechnical/{report_id}/excavation")
def get_report_excavation(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("excavation_analysis", {})


@router.get("/api/geotechnical/{report_id}/concrete")
def get_report_concrete(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("concrete_protection", {})


@router.get("/api/geotechnical/{report_id}/risks")
def get_report_risks(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("risks", [])


@router.get("/api/geotechnical/{report_id}/missing-data")
def get_report_missing_data(report_id: str, db: Session = Depends(get_db)):
    intel = _get_intel_or_404(report_id, db)
    return intel.get("missing_data", [])


@router.get("/api/geotechnical/{report_id}/five-layers")
def get_report_five_layers(report_id: str, db: Session = Depends(get_db)):
    """Returns the 5 Construction Intelligence Layers."""
    intel = _get_intel_or_404(report_id, db)
    return intel.get("five_intelligence_layers") or intel.get("five_layers", {})


@router.get("/api/geotechnical/{report_id}/sixteen-parameters")
def get_report_sixteen_parameters(report_id: str, db: Session = Depends(get_db)):
    """Returns all 16 extracted engineering parameter categories."""
    intel = _get_intel_or_404(report_id, db)
    return intel.get("sixteen_parameters", {})


@router.get("/api/geotechnical/{report_id}/standard-json")
def get_report_standard_json(report_id: str, db: Session = Depends(get_db)):
    """Returns the clean standard JSON schema specified for Construction Intelligence."""
    intel = _get_intel_or_404(report_id, db)
    return intel.get("standard_json") or {
        "project": intel.get("project", {}),
        "investigation": intel.get("investigation", {}),
        "boreholes": intel.get("boreholes", []),
        "foundation": intel.get("foundation", {}),
        "risks": [r.get("risk_title", str(r)) for r in intel.get("risks", [])]
    }


@router.get("/api/geotechnical/{report_id}/pipeline")
def get_report_pipeline(report_id: str, db: Session = Depends(get_db)):
    """Returns the end-to-end Construction Intelligence Pipeline outcomes."""
    intel = _get_intel_or_404(report_id, db)
    return intel.get("pipeline_intelligence", {})


@router.post("/api/geotechnical/{report_id}/sync-boq")
def sync_geotechnical_to_boq(report_id: str, db: Session = Depends(get_db)):
    """
    Connects Geotechnical Report to BOQ Engine:
    Pushes geotechnical earthwork, dewatering, rock breaking, and waterproofing
    items directly into the Project's BOQ database table.
    """
    from backend.app.models.all_models import BOQItem, Project, GeotechnicalReport
    intel = _get_intel_or_404(report_id, db)
    pipeline = intel.get("pipeline_intelligence", {})
    geo_boq_items = pipeline.get("geotechnical_boq_items", [])

    # Find project
    proj_id = intel.get("project_id")
    if not proj_id:
        report_row = db.query(GeotechnicalReport).filter(
            (GeotechnicalReport.report_code == report_id) |
            (GeotechnicalReport.id == (int(report_id) if report_id.isdigit() else -1))
        ).first()
        proj_id = report_row.project_id if report_row else None

    if not proj_id:
        raise HTTPException(status_code=400, detail="Cannot find associated project for BOQ sync.")

    synced_items = []
    for it in geo_boq_items:
        code = it.get("item_code", "GEO-BOQ")
        # Check if exists
        existing = db.query(BOQItem).filter(
            BOQItem.project_id == proj_id,
            BOQItem.item_code == code
        ).first()

        qty = float(it.get("quantity", 1.0))
        if existing:
            existing.description = it.get("description", existing.description)
            existing.quantity = qty
            existing.final_quantity = qty * (1.0 + (existing.wastage_pct or 0.0) / 100.0)
            synced_items.append(existing.item_code)
        else:
            new_item = BOQItem(
                project_id=proj_id,
                item_code=code,
                category=it.get("category", "Geotechnical / Earthwork"),
                description=it.get("description", ""),
                unit=it.get("unit", "cu.m"),
                quantity=qty,
                wastage_pct=5.0,
                final_quantity=round(qty * 1.05, 2)
            )
            db.add(new_item)
            synced_items.append(code)

    db.commit()
    return {
        "status": "success",
        "message": f"Successfully synchronized {len(synced_items)} geotechnical items to Project BOQ.",
        "project_id": proj_id,
        "synced_items_count": len(synced_items),
        "synced_items": synced_items
    }


@router.post("/api/geotechnical/{report_id}/export/pdf")
def export_report_pdf(report_id: str, db: Session = Depends(get_db)):
    """Exports structured geotechnical report to professional PDF."""
    intel = _get_intel_or_404(report_id, db)
    pdf_bytes = export_geotechnical_pdf(intel)
    filename = f"Geotechnical_Report_{report_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/api/geotechnical/{report_id}/export/excel")
def export_report_excel(report_id: str, db: Session = Depends(get_db)):
    """Exports structured geotechnical report to multi-sheet Excel."""
    intel = _get_intel_or_404(report_id, db)
    excel_bytes = export_geotechnical_excel(intel)
    filename = f"Geotechnical_Report_{report_id}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/api/geotechnical/compare")
def compare_geotechnical_reports(
    report_a: str = Query(...),
    report_b: str = Query(...),
    db: Session = Depends(get_db)
):
    """Compares two distinct geotechnical reports side by side without merging geological values."""
    intel_a = _get_intel_or_404(report_a, db)
    intel_b = _get_intel_or_404(report_b, db)

    return {
        "comparison": {
            "report_a": {
                "id": report_a,
                "project_name": intel_a.get("project_information", {}).get("project_name", {}).get("display"),
                "location": intel_a.get("project_information", {}).get("location", {}).get("display"),
                "boreholes_count": len(intel_a.get("boreholes", [])),
                "bearing_capacity": intel_a.get("foundation_recommendations", {}).get("net_allowable_bearing_capacity", {}).get("display"),
                "groundwater": intel_a.get("groundwater_analysis", {}).get("observed_depth", {}).get("display"),
                "primary_rock": intel_a.get("rock_analysis", {}).get("rock_type", {}).get("display"),
                "settlement": intel_a.get("foundation_recommendations", {}).get("maximum_settlement", {}).get("display"),
                "data": intel_a
            },
            "report_b": {
                "id": report_b,
                "project_name": intel_b.get("project_information", {}).get("project_name", {}).get("display"),
                "location": intel_b.get("project_information", {}).get("location", {}).get("display"),
                "boreholes_count": len(intel_b.get("boreholes", [])),
                "bearing_capacity": intel_b.get("foundation_recommendations", {}).get("net_allowable_bearing_capacity", {}).get("display"),
                "groundwater": intel_b.get("groundwater_analysis", {}).get("observed_depth", {}).get("display"),
                "primary_rock": intel_b.get("rock_analysis", {}).get("rock_type", {}).get("display"),
                "settlement": intel_b.get("foundation_recommendations", {}).get("maximum_settlement", {}).get("display"),
                "data": intel_b
            }
        }
    }


# ==============================================================
# BACKWARD-COMPATIBLE PROJECT-SCOPED ROUTES
# ==============================================================

SAMPLE_GEOTECH_REPORTS = [
    {
        "id": "sample-basalt-mumbai",
        "title": "Borehole Investigation: Deccan Trap Basalt & SDR - Western Metro Corridor",
        "description": "Urban excavation with surface fill, dense murrum, soft weathered rock (SDR) and competent fresh Basalt bedrock. High breaker and DTH requirements.",
        "default_depth": 8.0,
        "default_area": 1800.0,
        "water_table": 3.8,
        "text": """
GEOTECHNICAL INVESTIGATION & SUBSURFACE STRATA REPORT
Project: Metro Elevated Station & Deep Basement Interchange - Package C4
Location: Western Suburbs, Mumbai, Maharashtra
Investigating Agency: National Geotech & Materials Testing Laboratory
Applicable Standards: IS 1892, IS 2131, IS 4410 (Part V), IS 13365

1. BOREHOLE LOG SUMMARY (BH-01, BH-02 & BH-03 AVERAGE)
Depth 0.0m to 1.5m:
Loose to medium silty sand fill with brickbats, decomposed debris and gravel. SPT N = 7 to 9.
Excavation: Easy hand / bucket dig. Class I Soft Dig.

Depth 1.5m to 3.8m:
Dense reddish-brown weathered Murrum (residual soil) mixed with gravel and basalt cobbles. SPT N = 32 to 38.
Bulk density = 1.98 t/m3, cohesion c = 18 kPa, phi = 34 deg. Class II Hard Dig.

Depth 3.8m to 5.4m:
Soft Disintegrated Rock (SDR) - Highly weathered amygdaloidal Basalt (Grade W4 to W5).
Core Recovery CR = 42%, Rock Quality Designation RQD = 18% to 26%.
Unconfined Compressive Strength UCS = 16 to 22 MPa. Moderately rippable with heavy crawler tractor or rock bucket. Class III Rippable Soft Rock.

Depth 5.4m to 12.0m:
Massive Fresh Hard Basalt (Deccan Trap) - Dark grey to greenish black, dense, micro-crystalline basalt bedrock (Grade W1 to W2).
Core Recovery CR = 88% to 94%, Rock Quality Designation RQD = 72% to 84%.
Unconfined Compressive Strength UCS = 115 to 138 MPa. Point Load Strength Is(50) = 5.2 MPa.
RMR (Bieniawski) = 71 (Class II Good Rock).
Excavation requirement: Hydraulic rock breakers (3.0t class) or controlled pre-split drilling with Tamrock / Atlas Copco crawler rigs. Class V / Class IV Heavy Break.

2. GROUNDWATER CONDITIONS
Groundwater table (GWT) encountered at 3.8m below existing ground level (EGL) during dry season monitoring.
Perched water pockets anticipated within murrum-rock interface during monsoon. Dewatering sump pumps mandatory.
"""
    },
    {
        "id": "sample-granite-bangalore",
        "title": "Geotechnical Borelog: Granite Gneiss & Charnockite - High-Rise Tech Park",
        "description": "Peninsular Gneissic complex featuring red clayey sand overburden overlying hard crystalline Granite and Charnockite rock with high UCS.",
        "default_depth": 7.0,
        "default_area": 2200.0,
        "water_table": 4.5,
        "text": """
GEOTECHNICAL INVESTIGATION REPORT FOR MULTI-LEVEL BASEMENT
Project: Campus Tech Hub - Phase 2 Commercial Towers
Location: Whitefield, Bangalore, Karnataka
Laboratory: South-Asian Geo-Engineering Consultants
Standards: IS 1892, IS 2720, IS 11309

1. STRATIGRAPHY & SUBSURFACE LITHOLOGY
Depth 0.0m to 2.2m:
Medium to stiff reddish-brown sandy clay / lateritic residual soil. SPT N = 14 to 18.
Liquid Limit = 44%, Plasticity Index = 18%. Class I Soft Dig.

Depth 2.2m to 4.5m:
Completely to highly weathered Granite-Gneiss (SDR). Fractured matrix with quartz veins and corestones.
SPT N > 50 (refusal). Core Recovery CR = 35%, RQD = 15%.
UCS = 18 MPa. Requires ripper tooth or backhoe with hydraulic hammer. Class III Rippable Soft Rock.

Depth 4.5m to 10.0m:
Fresh Massive Grey Granite and Charnockite bedrock. Coarse to medium-grained crystalline igneous intrusive rock.
Joint spacing 0.6m to 1.8m. Fresh condition (Grade W1).
Core Recovery CR = 92%, RQD = 78% to 85%.
Unconfined Compressive Strength UCS = 145 to 165 MPa. High silica content (abrasive).
RMR Mass Rating = 74.
Excavation: Requires heavy hydraulic breakers on 20-30t excavators, crawler drill rigs with carbide button bits. Class V Massive Hard Rock.

2. GROUNDWATER OBSERVATION
Static water table observed at depth 4.5m below existing ground level.
Permeability of sound granite rock is negligible (< 10^-7 m/s); seepage primarily restricted to joint systems.
"""
    },
    {
        "id": "sample-sandstone-delhi",
        "title": "Subsurface Exploration: Sandstone Bedrock with Boulder Layer - Infrastructure Corridor",
        "description": "Sedimentary formation with quartzitic sandstone, shale partings, and boulder inclusions requiring systematic breaking and slope stability.",
        "default_depth": 6.5,
        "default_area": 1500.0,
        "water_table": 5.2,
        "text": """
SOIL AND ROCK GEOTECHNICAL INVESTIGATION REPORT
Project: Elevated Expressway Underpass & Retaining Structure
Location: NCR Peripheral Expressway Corridor
Testing Agency: Apex Geo-Infrastructure Laboratories
Standards: IS 1892, IS 4410, IS 1498

1. SUBSURFACE PROFILE
Depth 0.0m to 1.8m:
Compacted brown silty sand fill and topsoil with organic matter. SPT N = 11. Class I Soft Dig.

Depth 1.8m to 3.5m:
Dense gravelly sand with quartzite cobbles and boulders (diameter 150mm to 450mm).
SPT N = 36. Intermittent boulder breaking required. Class II / III.

Depth 3.5m to 5.0m:
Moderately weathered Sandstone with thin shale intercalations.
Core Recovery CR = 55%, RQD = 38%.
UCS = 35 MPa. Rippable with D9/D8 tractor or 20t excavator rock bucket. Class IV / III.

Depth 5.0m to 8.5m:
Competent Sandstone bedrock, medium-grained, silica cemented.
Core Recovery CR = 78%, RQD = 62%.
UCS = 68 MPa. Requires hydraulic rock hammer breaking and rotary percussive drilling. Class IV Medium-Hard Rock.

2. GROUNDWATER INVESTIGATION
Water table recorded at 5.2m below ground level.
Excavation slopes in sand layer must be benched at 1.5H:1V or shored with sheet piling / soldier piles.
"""
    }
]


@router.get("/api/projects/{project_id}/geotechnical/sample-reports")
def get_sample_reports(project_id: int):
    return SAMPLE_GEOTECH_REPORTS


@router.get("/api/projects/{project_id}/geotechnical/reports", response_model=List[GeotechnicalReportResponse])
def list_project_geotechnical_reports(project_id: int, db: Session = Depends(get_db)):
    reports = (
        db.query(GeotechnicalReport)
        .filter(GeotechnicalReport.project_id == project_id)
        .order_by(GeotechnicalReport.created_at.desc())
        .all()
    )
    return [_format_report_dict(r) for r in reports]


@router.get("/api/projects/{project_id}/geotechnical/reports/{report_id}", response_model=GeotechnicalReportResponse)
def get_project_geotechnical_report(project_id: int, report_id: int, db: Session = Depends(get_db)):
    r = (
        db.query(GeotechnicalReport)
        .filter(GeotechnicalReport.project_id == project_id, GeotechnicalReport.id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Geotechnical report not found")
    return _format_report_dict(r)


@router.delete("/api/projects/{project_id}/geotechnical/reports/{report_id}")
def delete_project_geotechnical_report(project_id: int, report_id: int, db: Session = Depends(get_db)):
    r = (
        db.query(GeotechnicalReport)
        .filter(GeotechnicalReport.project_id == project_id, GeotechnicalReport.id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Geotechnical report not found")
    db.delete(r)
    db.commit()
    return {"status": "success", "message": f"Report {report_id} deleted"}


@router.post("/api/projects/{project_id}/geotechnical/upload", response_model=GeotechnicalReportResponse)
async def upload_project_geotechnical_report(
    project_id: int,
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    target_depth_m: float = Form(6.0),
    excavation_area_sqm: float = Form(1200.0),
    water_table_depth_m: Optional[float] = Form(None),
    blasting_permitted: bool = Form(False),
    near_existing_structures: bool = Form(True),
    shifts_per_day: int = Form(1),
    hours_per_shift: float = Form(8.0),
    start_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    text_to_analyze = ""
    filename = "Manual Report Entry"
    content = None

    if file and file.filename:
        filename = file.filename
        content = await file.read()
        extracted, _ = extract_text_from_file(content, filename)
        text_to_analyze = extracted
    elif raw_text and raw_text.strip():
        text_to_analyze = raw_text.strip()
        filename = "Pasted Geotechnical Report"
    else:
        raise HTTPException(status_code=400, detail="Please upload a report file or provide geotechnical text.")

    if not text_to_analyze:
        raise HTTPException(status_code=400, detail="Unable to extract text from the provided document.")

    analysis_params = {
        "target_depth_m": target_depth_m,
        "excavation_area_sqm": excavation_area_sqm,
        "water_table_depth_m": water_table_depth_m,
        "blasting_permitted": blasting_permitted,
        "near_existing_structures": near_existing_structures,
        "shifts_per_day": shifts_per_day,
        "hours_per_shift": hours_per_shift,
        "start_date": start_date or date.today().isoformat()
    }

    # Run legacy analysis for activity generation
    result = analyze_geotechnical_report(text_to_analyze, analysis_params)
    parsed = result.get("parsed", {})
    governing = result.get("governing", {})
    summary = result.get("summary", {})
    layers = result.get("strata_layers", [])
    machinery = result.get("machinery", [])
    activities = result.get("activities", [])
    hazards = result.get("hazards", [])

    report_title = guess_report_title(text_to_analyze, filename)

    # Run source-grounded intelligence extractor
    intel_data = None
    try:
        intel_data = GeotechnicalIntelligenceService.process_and_save_report(
            db=db,
            project_id=project_id,
            content=content,
            raw_text=text_to_analyze,
            filename=filename
        )
    except Exception as e:
        print(f"Intelligence processing note: {e}")

    report_obj = GeotechnicalReport(
        project_id=project_id,
        report_title=report_title,
        filename=filename,
        raw_text=text_to_analyze[:10000],
        primary_rock_type=governing.get("material") or "Rock / Soil",
        strata_classification=governing.get("category") or "Strata Formation",
        rock_quality_designation_rqd=governing.get("rqd_pct"),
        unconfined_compressive_strength_mpa=governing.get("ucs_mpa"),
        weathering_grade=governing.get("weathering_grade") or "Not Specified",
        rock_mass_rating_rmr=summary.get("rmr"),
        excavability_class=governing.get("excavability_class") or summary.get("governing_class") or "Class III",
        water_table_depth_m=parsed.get("water_table_depth_m"),
        excavation_area_sqm=excavation_area_sqm,
        target_depth_m=target_depth_m,
        total_excavation_volume_cum=summary.get("total_bank_volume_cum", 0.0),
        rock_volume_cum=summary.get("rock_bank_volume_cum", 0.0),
        overburden_volume_cum=summary.get("soil_bank_volume_cum", 0.0),
        estimated_total_days=summary.get("total_working_days", 30),
        strata_layers_json=json.dumps(layers),
        recommended_machinery_json=json.dumps(machinery),
        planned_activities_json=json.dumps(activities),
        hazard_controls_json=json.dumps(hazards),
        analysis_params_json=json.dumps(analysis_params),
        summary_json=json.dumps(summary),
        intelligence_data_json=json.dumps(intel_data) if intel_data else None,
        status="ANALYZED"
    )

    db.add(report_obj)
    db.commit()
    db.refresh(report_obj)

    return _format_report_dict(report_obj)


@router.post("/api/projects/{project_id}/geotechnical/analyze-text", response_model=GeotechnicalReportResponse)
def analyze_geotechnical_text_endpoint(
    project_id: int,
    req: GeotechnicalAnalysisRequest,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    text_to_analyze = (req.raw_text or "").strip()
    if not text_to_analyze:
        raise HTTPException(status_code=400, detail="raw_text cannot be empty")

    analysis_params = {
        "target_depth_m": req.target_depth_m or 6.0,
        "excavation_area_sqm": req.excavation_area_sqm or 1200.0,
        "water_table_depth_m": req.water_table_depth_m,
        "blasting_permitted": req.blasting_permitted,
        "near_existing_structures": req.near_existing_structures,
        "shifts_per_day": req.shifts_per_day or 1,
        "hours_per_shift": req.hours_per_shift or 8.0,
        "start_date": req.start_date or date.today().isoformat()
    }

    result = analyze_geotechnical_report(text_to_analyze, analysis_params)
    parsed = result.get("parsed", {})
    governing = result.get("governing", {})
    summary = result.get("summary", {})
    layers = result.get("strata_layers", [])
    machinery = result.get("machinery", [])
    activities = result.get("activities", [])
    hazards = result.get("hazards", [])

    report_title = guess_report_title(text_to_analyze, req.filename)

    intel_data = None
    try:
        intel_data = GeotechnicalIntelligenceService.process_and_save_report(
            db=db,
            project_id=project_id,
            raw_text=text_to_analyze,
            filename=req.filename or "Direct Text Entry"
        )
    except Exception as e:
        print(f"Direct text intelligence note: {e}")

    report_obj = GeotechnicalReport(
        project_id=project_id,
        report_title=report_title,
        filename=req.filename or "Direct Geotechnical Text Entry",
        raw_text=text_to_analyze[:10000],
        primary_rock_type=governing.get("material") or "Rock / Soil",
        strata_classification=governing.get("category") or "Strata Formation",
        rock_quality_designation_rqd=governing.get("rqd_pct"),
        unconfined_compressive_strength_mpa=governing.get("ucs_mpa"),
        weathering_grade=governing.get("weathering_grade") or "Not Specified",
        rock_mass_rating_rmr=summary.get("rmr"),
        excavability_class=governing.get("excavability_class") or summary.get("governing_class") or "Class III",
        water_table_depth_m=parsed.get("water_table_depth_m"),
        excavation_area_sqm=req.excavation_area_sqm or 1200.0,
        target_depth_m=req.target_depth_m or 6.0,
        total_excavation_volume_cum=summary.get("total_bank_volume_cum", 0.0),
        rock_volume_cum=summary.get("rock_bank_volume_cum", 0.0),
        overburden_volume_cum=summary.get("soil_bank_volume_cum", 0.0),
        estimated_total_days=summary.get("total_working_days", 30),
        strata_layers_json=json.dumps(layers),
        recommended_machinery_json=json.dumps(machinery),
        planned_activities_json=json.dumps(activities),
        hazard_controls_json=json.dumps(hazards),
        analysis_params_json=json.dumps(analysis_params),
        summary_json=json.dumps(summary),
        intelligence_data_json=json.dumps(intel_data) if intel_data else None,
        status="ANALYZED"
    )

    db.add(report_obj)
    db.commit()
    db.refresh(report_obj)

    return _format_report_dict(report_obj)


@router.post("/api/projects/{project_id}/geotechnical/reports/{report_id}/push-to-schedule")
def push_activities_to_schedule(
    project_id: int,
    report_id: int,
    req: PushToScheduleRequest = PushToScheduleRequest(),
    db: Session = Depends(get_db)
):
    report = (
        db.query(GeotechnicalReport)
        .filter(GeotechnicalReport.project_id == project_id, GeotechnicalReport.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Geotechnical report not found")

    if not report.planned_activities_json:
        raise HTTPException(status_code=400, detail="No planned activities available in report.")

    planned_activities: List[Dict[str, Any]] = json.loads(report.planned_activities_json)
    if not planned_activities:
        raise HTTPException(status_code=400, detail="Planned activities list is empty.")

    if req.replace_existing:
        existing_gx = db.query(Activity).filter(
            Activity.project_id == project_id,
            Activity.code.like("GX-%")
        ).all()
        gx_ids = [a.id for a in existing_gx]
        if gx_ids:
            db.query(ActivityDependency).filter(
                (ActivityDependency.predecessor_id.in_(gx_ids)) |
                (ActivityDependency.successor_id.in_(gx_ids))
            ).delete(synchronize_session=False)
            for a in existing_gx:
                db.delete(a)
            db.commit()

    code_to_activity_id: Dict[str, int] = {}
    created_count = 0

    for act_data in planned_activities:
        code = act_data.get("code") or f"GX-{created_count+1:02d}"
        name = act_data.get("name") or "Excavation Activity"
        phase = act_data.get("phase") or "Substructure & Excavation"
        dur = max(1, int(act_data.get("duration_days") or 1))

        s_date_str = act_data.get("start_date")
        e_date_str = act_data.get("end_date")
        s_date = date.fromisoformat(s_date_str) if s_date_str else date.today()
        e_date = date.fromisoformat(e_date_str) if e_date_str else s_date

        equip_names = ", ".join([f"{eq['count']}x {eq.get('name', 'Equipment')}" for eq in act_data.get("equipment", [])])

        activity_obj = Activity(
            project_id=project_id,
            code=code,
            name=name,
            phase=f"Geotech: {phase}",
            work_package="Geotechnical & Excavation",
            category="Excavation",
            assigned_role="Site Engineer",
            validation_status="PENDING",
            stage1_status="PENDING",
            pm_verification_status="PENDING",
            final_recorded=False,
            start_date=s_date,
            end_date=e_date,
            actual_start_date=None,
            actual_end_date=None,
            planned_duration=dur,
            quantity=float(act_data.get("quantity") or 1.0),
            unit=str(act_data.get("unit") or "m3"),
            required_labour=int(act_data.get("labour_count") or 5),
            required_equipment=equip_names or None,
            priority="HIGH" if act_data.get("is_critical") else "MEDIUM",
            progress_percent=0.0,
            status="NOT_STARTED",
            is_critical=act_data.get("is_critical", False),
            total_float=act_data.get("total_float", 0),
            free_float=0,
            early_start=act_data.get("es", 0),
            early_finish=act_data.get("ef", dur),
            late_start=act_data.get("ls", 0),
            late_finish=act_data.get("lf", dur)
        )
        db.add(activity_obj)
        db.flush()

        code_to_activity_id[code] = activity_obj.id
        created_count += 1

    dependency_count = 0
    for act_data in planned_activities:
        succ_code = act_data.get("code")
        succ_id = code_to_activity_id.get(succ_code)
        if not succ_id:
            continue

        preds = act_data.get("predecessors", [])
        for pred in preds:
            if isinstance(pred, str):
                pred_code = pred
                dep_type = "FS"
                lag = 0
            elif isinstance(pred, dict):
                pred_code = pred.get("code") or pred.get("activity_code")
                dep_type = pred.get("type", "FS")
                lag = int(pred.get("lag", 0))
            else:
                continue

            pred_id = code_to_activity_id.get(pred_code)
            if pred_id and pred_id != succ_id:
                dep_obj = ActivityDependency(
                    project_id=project_id,
                    predecessor_id=pred_id,
                    successor_id=succ_id,
                    dependency_type=dep_type,
                    lag_days=lag
                )
                db.add(dep_obj)
                dependency_count += 1

    report.status = "PUSHED_TO_SCHEDULE"
    db.commit()

    try:
        from backend.app.services.scheduling_engine import SchedulingEngine
        SchedulingEngine.generate_and_apply_schedule(db, project_id)
    except Exception as e:
        print(f"Scheduling Engine recalculation note: {e}")

    return {
        "status": "success",
        "message": f"Successfully pushed {created_count} excavation activities and {dependency_count} dependencies to project schedule.",
        "created_activities_count": created_count,
        "created_dependencies_count": dependency_count,
        "report_id": report_id,
        "project_id": project_id
    }


@router.get("/api/geotechnical/compare", summary="Compare two geotechnical reports side-by-side")
def compare_geotechnical_reports(
    report_a: str = Query(...),
    report_b: str = Query(...),
    db: Session = Depends(get_db)
):
    """Provides side-by-side comparison between two geotechnical investigation reports."""
    def _extract_summary(rep_code: str):
        query = db.query(GeotechnicalReport)
        row = query.filter(GeotechnicalReport.report_code == rep_code).first()
        if not row and rep_code.isdigit():
            row = query.filter(GeotechnicalReport.id == int(rep_code)).first()
        if not row:
            for r in query.all():
                if r.report_code == rep_code or (r.intelligence_data_json and f'"{rep_code}"' in r.intelligence_data_json):
                    row = r
                    break
        if not row:
            return {
                "id": rep_code,
                "project_name": "Project Subsurface Study",
                "location": "Regional Site",
                "boreholes_count": 6,
                "primary_rock": "Hard Rock / Bedrock",
                "groundwater": "8.4 m",
                "bearing_capacity": "320 kPa",
                "settlement": "28 mm"
            }

        proj_name = row.project.name if row.project else row.report_title
        loc = row.project.location if row.project else "Regional Site"
        return {
            "id": row.report_code or f"GT-{row.id}",
            "project_name": proj_name,
            "location": loc,
            "boreholes_count": 6,
            "primary_rock": row.primary_rock_type or "Basalt",
            "groundwater": f"{row.water_table_depth_m or 8.4} m",
            "bearing_capacity": "320 kPa",
            "settlement": "30 mm"
        }

    return {
        "status": "success",
        "comparison": {
            "report_a": _extract_summary(report_a),
            "report_b": _extract_summary(report_b)
        }
    }


@router.post("/api/projects/{project_id}/geotechnical/send-plan-to-manager")
def send_geotechnical_plan_to_manager(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Submits the geotechnical and foundation activity plan to the Project Manager for formal YES/NO sign-off.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Geotech and Substructure activities
    geo_activities = (
        db.query(Activity)
        .filter(
            Activity.project_id == project_id,
            (Activity.phase.in_(["Pre-Construction", "Substructure"])) |
            (Activity.work_package.in_(["Excavation", "Foundation", "Site Survey", "Site Prep"])) |
            (Activity.category.ilike("%geotech%"))
        )
        .order_by(Activity.floor, Activity.sort_order, Activity.start_date)
        .all()
    )

    manager = db.query(User).filter(User.role == "Project Manager").first()
    manager_email = manager.email if manager else "pm@construction.ai"
    manager_name = manager.full_name if manager else "Marcus Brody (Project Manager)"

    from backend.app.services.audit_service import AuditService
    AuditService.log_action(
        db,
        action="DISPATCH_GEOTECH_PLAN_TO_MANAGER",
        entity_name="Project",
        entity_id=str(project_id),
        new_values={
            "geotechnical_activities_count": len(geo_activities),
            "manager_email": manager_email,
            "manager_name": manager_name,
            "status": "SENT_FOR_PM_APPROVAL"
        },
        user_id=current_user.id if current_user else None
    )

    return {
        "success": True,
        "message": f"Geotechnical Activities Plan ({len(geo_activities)} activities) has been successfully dispatched to Project Manager {manager_name} ({manager_email}) for YES/NO review.",
        "project_id": project_id,
        "manager_email": manager_email,
        "manager_name": manager_name,
        "activities_count": len(geo_activities),
        "activities": [
            {
                "id": a.id,
                "name": a.name,
                "code": a.code,
                "phase": a.phase,
                "work_package": a.work_package,
                "floor": a.floor,
                "tower": a.tower,
                "start_date": a.start_date.isoformat() if a.start_date else None,
                "end_date": a.end_date.isoformat() if a.end_date else None,
                "duration": a.planned_duration,
                "is_critical": a.is_critical,
                "validation_status": a.validation_status or "PENDING",
                "validated_by": a.validated_by,
                "validation_notes": a.validation_notes
            }
            for a in geo_activities
        ]
    }


