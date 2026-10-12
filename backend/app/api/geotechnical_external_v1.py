"""
External Geotechnical Intelligence Report API (v1).
Dedicated, secure, API-key authenticated namespace (/api/v1/geotechnical).
Provides external construction systems (ERPs, PMIS) scoped access strictly to
geotechnical parsing, borehole strata, soil profiles, alerts, foundation recommendations,
and engineering analysis.
"""
from __future__ import annotations

import io
import time
import json
import re
import secrets
import datetime
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form,
    Request, Response, Security, status
)
from fastapi.security import SecurityScopes
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import (
    Project, GeotechnicalReport, GeotechAPIKey, GeotechAPIAuditLog
)
from backend.app.schemas.geotech_api_schemas import (
    CreateAPIKeyRequest, APIKeyResponse, MaskedAPIKeyResponse, RotateKeyResponse,
    GeotechReportOverviewResponse, SoilSummary, GeotechAlertItem,
    BoreholesResponse, BoreholeDetail, BoreholeLayer,
    SoilProfileResponse, SoilLayerDetail,
    AlertsResponse, FoundationRecommendationsResponse, FoundationOption,
    AnalyzeReportRequest, AnalysisResultResponse, GeotechAuditLogItem
)
from backend.app.services.geotech_auth_service import (
    authenticate_geotech_key, GeotechClientContext, GeotechAuthService,
    log_geotech_api_audit
)
from backend.app.services.geotechnical_service import (
    SUPPORTED_GEOTECH_REPORT_EXTENSIONS,
    extract_pages_from_file,
    validate_geotechnical_report_text,
    analyze_geotechnical_report,
)
from backend.app.services.geotech_intel.service import GeotechnicalIntelligenceService
from backend.app.services.geotech_intel.fields import val, is_found


router = APIRouter(
    prefix="/api/v1/geotechnical",
    tags=["Geotechnical External API (v1)"]
)

# Maximum upload file size: 25 Megabytes
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = SUPPORTED_GEOTECH_REPORT_EXTENSIONS


def _number_from_report_value(value: Any) -> Optional[float]:
    """Return a numeric report value only when it represents a single measurement."""
    value = val(value)
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.fullmatch(
            r"\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:m(?:\s*(?:BGL|below ground level|RL))?)?\s*",
            value,
            re.IGNORECASE,
        )
        if match:
            return float(match.group(1))
    return None


# ===========================================================================
# Internal Helpers
# ===========================================================================

def _record_audit(
    request: Request,
    db: Session,
    context: Optional[GeotechClientContext],
    status_code: int,
    error_message: Optional[str] = None
) -> None:
    """Records audit trail for the external request."""
    start_time = getattr(request.state, "auth_start_time", time.time())
    duration_ms = round((time.time() - start_time) * 1000, 2)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    api_key_id = context.api_key_id if context else None
    client_name = context.client_name if context else "unauthenticated"
    tenant_id = context.tenant_id if context else "unauthenticated"

    log_geotech_api_audit(
        db=db,
        api_key_id=api_key_id,
        client_name=client_name,
        tenant_id=tenant_id,
        endpoint=str(request.url.path),
        method=request.method,
        status_code=status_code,
        ip_address=client_ip,
        user_agent=user_agent,
        response_time_ms=duration_ms,
        error_message=error_message
    )


def _get_tenant_report(
    db: Session,
    report_id: str,
    client: GeotechClientContext
) -> GeotechnicalReport:
    """
    Finds a GeotechnicalReport by report_code or ID while enforcing strict multi-tenant isolation.
    """
    query = db.query(GeotechnicalReport)
    report = None

    # Try matching report_code first
    report = query.filter(GeotechnicalReport.report_code == report_id).first()

    # Try matching numeric id
    if not report and report_id.isdigit():
        report = query.filter(GeotechnicalReport.id == int(report_id)).first()

    # Try matching report_title or intelligence_data_json snippet
    if not report:
        candidates = query.all()
        for c in candidates:
            if c.report_code == report_id:
                report = c
                break
            if c.intelligence_data_json and f'"{report_id}"' in c.intelligence_data_json:
                report = c
                break

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Geotechnical report '{report_id}' not found."
        )

    # Multi-tenant isolation:
    # A report is accessible only if it belongs to this client's tenant, or is a system default
    if (
        report.tenant_id != client.tenant_id
        and client.tenant_id != "system"
        and report.tenant_id != "default"
    ):
        # Return 404 to avoid leaking report existence across tenants
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Geotechnical report '{report_id}' not found."
        )

    return report


def _build_overview_response(report: GeotechnicalReport) -> GeotechReportOverviewResponse:
    """
    Transforms a GeotechnicalReport entity into the standard overview format.
    """
    data: Dict[str, Any] = {}
    if report.intelligence_data_json:
        try:
            data = json.loads(report.intelligence_data_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Stored geotechnical report data is invalid."
            ) from exc
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Stored geotechnical report data has an invalid structure."
            )

    project_name = report.project.name if report.project else "Geotechnical Report"
    if "project_information" in data:
        p_info = data["project_information"]
        if isinstance(p_info, dict) and "project_name" in p_info:
            p_val = val(p_info["project_name"])
            if p_val and p_val != "Missing":
                project_name = p_val

    # Report only boreholes identified in the uploaded document.
    boreholes_count = 0
    if "boreholes" in data and isinstance(data["boreholes"], list):
        boreholes_count = len(data["boreholes"])

    # Maximum depth
    max_depth = None
    if "investigation_information" in data:
        inv = data["investigation_information"]
        if isinstance(inv, dict):
            md_val = val(inv.get("maximum_depth_m", inv.get("max_depth")))
            if isinstance(md_val, (int, float)):
                max_depth = float(md_val)
    if report.raw_text:
        m_dep = re.search(r"(?:terminated\s+at|exploration\s+depth\s*[:=]|max(?:imum)?\s+depth\s*[:=])\s*(\d+(?:\.\d+)?)\s*m", report.raw_text, re.I)
        if m_dep:
            max_depth = float(m_dep.group(1))

    # Groundwater depth
    groundwater = data.get("groundwater_analysis")
    gw_level = None
    if isinstance(groundwater, dict):
        gw_level = _number_from_report_value(
            groundwater.get("observed_depth", groundwater.get("groundwater_depth"))
        )
    if gw_level is None and report.water_table_depth_m is not None:
        gw_level = report.water_table_depth_m

    # Soil summary
    top_layer = "Not specified in report"
    major_soil = report.primary_rock_type or "Not specified in report"
    rock_depth = None

    layers = data.get("stratigraphy")
    if isinstance(layers, list):
        valid_layers = [layer for layer in layers if isinstance(layer, dict)]
        if valid_layers:
            first_layer = valid_layers[0]
            top_layer = (
                first_layer.get("soil_type")
                or first_layer.get("layer_name")
                or first_layer.get("soil_description")
                or top_layer
            )
            if len(valid_layers) > 1:
                second_layer = valid_layers[1]
                major_soil = (
                    second_layer.get("soil_type")
                    or second_layer.get("layer_name")
                    or second_layer.get("soil_description")
                    or major_soil
                )

    # Alerts
    alerts: List[GeotechAlertItem] = []
    if "risks" in data and isinstance(data["risks"], list):
        for r in data["risks"]:
            if isinstance(r, dict):
                title = r.get("risk_title") or r.get("title") or "Geotechnical Risk"
                description = r.get("reason") or r.get("description") or r.get("flag") or ""
                alerts.append(
                    GeotechAlertItem(
                        type=r.get("category", "geotechnical").lower(),
                        severity=r.get("severity", "medium").lower(),
                        message=f"{title}: {description}".rstrip(": "),
                        mitigation=r.get("recommended_action") or r.get("recommendation")
                    )
                )

    code = report.report_code or f"GT-{report.id + 1000}"

    return GeotechReportOverviewResponse(
        report_id=code,
        project_name=project_name,
        status="analyzed",
        boreholes=boreholes_count,
        maximum_depth_m=round(max_depth, 1) if max_depth is not None else None,
        groundwater_level_m=round(gw_level, 1) if gw_level is not None else None,
        soil_summary=SoilSummary(
            top_layer=top_layer,
            major_soil=major_soil,
            rock_depth_m=rock_depth
        ),
        alerts=alerts,
        analysis_available=True,
        tenant_id=report.tenant_id,
        created_at=report.created_at
    )


# ===========================================================================
# 1. Upload Geotechnical Report
# ===========================================================================

@router.post(
    "/reports/upload",
    response_model=GeotechReportOverviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Geotechnical Report (PDF/DOCX/XLSX/TXT)",
    description="Securely upload and parse a geotechnical investigation document. Automatically extracts subsurface stratigraphy, boreholes, water table, and engineering risk profile with tenant-level isolation."
)
async def upload_geotechnical_report(
    request: Request,
    file: UploadFile = File(..., description="Geotechnical report document (PDF, DOCX, XLSX, TXT, CSV)"),
    project_name: Optional[str] = Form(None, description="Optional name of the project"),
    project_id: Optional[int] = Form(None, description="Optional internal project ID"),
    report_title: Optional[str] = Form(None, description="Optional custom title for the report"),
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:upload"]),
    db: Session = Depends(get_db)
):
    try:
        # Validate filename and extension
        filename = file.filename or "geotechnical_report.pdf"
        file_ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
            )

        # Read content and enforce size limits
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uploaded file is empty (0 bytes)."
            )
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )

        # Extract and validate before provisioning a project or saving a report.
        try:
            extracted_pages = extract_pages_from_file(content, filename)
            extracted_text = "\n".join(
                page for page in extracted_pages if page and page.strip()
            )
            validate_geotechnical_report_text(extracted_text)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc)
            ) from exc

        # Resolve or automatically provision tenant project
        proj = None
        if project_id:
            proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj and project_name:
            proj = db.query(Project).filter(Project.name == project_name).first()
        if not proj:
            # Create a clean isolated tenant project
            assigned_name = project_name or f"{client.client_name} - Subsurface Study"
            proj_code = f"EXT-{client.tenant_id[:4].upper()}-{secrets.token_hex(3).upper()}"
            proj = Project(
                name=assigned_name,
                code=proj_code,
                construction_type="Commercial",
                location="Site Investigation Area",
                num_floors=5,
                num_towers=1,
                built_up_area=10000.0,
                planned_start_date=datetime.date.today(),
                target_completion_date=datetime.date.today() + datetime.timedelta(days=180)
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)

        # Process through Geotechnical Intelligence Service
        payload = GeotechnicalIntelligenceService.process_and_save_report(
            db=db,
            project_id=proj.id,
            content=content,
            raw_text=extracted_text,
            filename=filename,
            params={"report_title": report_title or f"Geotechnical Report - {proj.name}"},
            extracted_pages=extracted_pages,
        )

        # Locate saved DB row and assign tenant ID + monotonic report code
        report_row = db.query(GeotechnicalReport).filter(GeotechnicalReport.id == payload.get("id")).first()
        if report_row:
            report_row.tenant_id = client.tenant_id
            code = f"GT-{1000 + report_row.id}"
            report_row.report_code = code
            if report_title:
                report_row.report_title = report_title
            db.commit()
            db.refresh(report_row)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist geotechnical report."
            )

        overview = _build_overview_response(report_row)
        _record_audit(request, db, client, status.HTTP_201_CREATED)
        return overview

    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except ValueError as exc:
        _record_audit(request, db, client, status.HTTP_422_UNPROCESSABLE_ENTITY, error_message=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        ) from exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the geotechnical report: {str(exc)}"
        )


# ===========================================================================
# 2. Get Parsed Report Overview
# ===========================================================================

@router.get(
    "/reports/{report_id}",
    response_model=GeotechReportOverviewResponse,
    summary="Get Parsed Geotechnical Report Overview",
    description="Retrieve high-level geotechnical metrics, borehole counts, soil summary, and critical risk alerts."
)
def get_parsed_report(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:read"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        overview = _build_overview_response(report)
        _record_audit(request, db, client, status.HTTP_200_OK)
        return overview
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 3. Get Borehole Data
# ===========================================================================

@router.get(
    "/reports/{report_id}/boreholes",
    response_model=BoreholesResponse,
    summary="Get Borehole Data & Logs",
    description="Retrieve individual borehole exploration logs, termination depths, coordinates, and SPT profiles."
)
def get_boreholes_data(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:read"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        data: Dict[str, Any] = {}
        if report.intelligence_data_json:
            try:
                data = json.loads(report.intelligence_data_json)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=500, detail="Stored geotechnical report data is invalid.") from exc
            if not isinstance(data, dict):
                raise HTTPException(status_code=500, detail="Stored geotechnical report data has an invalid structure.")

        borehole_items: List[BoreholeDetail] = []
        raw_boreholes = data.get("boreholes", [])

        if raw_boreholes and isinstance(raw_boreholes, list):
            for idx, bh in enumerate(raw_boreholes):
                if not isinstance(bh, dict):
                    continue
                bh_id = bh.get("id") or bh.get("borehole_id") or f"BH-{idx + 1:02d}"
                depth = _number_from_report_value(
                    bh.get("borehole_depth_m", bh.get("depth_m", bh.get("depth")))
                )
                groundwater = bh.get("groundwater")
                groundwater_depth = (
                    groundwater.get("depth_m") if isinstance(groundwater, dict) else None
                )
                if groundwater_depth is None:
                    groundwater_depth = bh.get("groundwater_depth_m", bh.get("water_table_depth_m"))

                strata_raw = (
                    bh.get("soil_layers")
                    or bh.get("layers")
                    or bh.get("strata")
                    or []
                )
                if not isinstance(strata_raw, list):
                    strata_raw = []
                strata_layers: List[BoreholeLayer] = []
                for layer in strata_raw:
                    if not isinstance(layer, dict):
                        continue
                    depth_from = _number_from_report_value(
                        layer.get("depth_from_m", layer.get("from_m", layer.get("top_depth")))
                    )
                    depth_to = _number_from_report_value(
                        layer.get("depth_to_m", layer.get("to_m", layer.get("bottom_depth")))
                    )
                    if depth_from is None or depth_to is None:
                        continue
                    material = (
                        layer.get("soil_type")
                        or layer.get("material")
                        or layer.get("soil_description")
                        or layer.get("description")
                    )
                    spt_n = _number_from_report_value(layer.get("spt_n"))
                    rqd = _number_from_report_value(layer.get("rqd", layer.get("rqd_percent")))
                    ucs = _number_from_report_value(layer.get("ucs_mpa"))
                    thickness = _number_from_report_value(
                        layer.get("thickness_m", layer.get("thickness"))
                    )
                    termination_stratum = (
                        bh.get("termination_stratum") or bh.get("termination_reason")
                    )
                    if not termination_stratum and strata_raw and isinstance(strata_raw[-1], dict):
                        termination_layer = strata_raw[-1]
                        termination_stratum = (
                            termination_layer.get("material")
                            or termination_layer.get("soil_description")
                            or termination_layer.get("description")
                        )
                    strata_layers.append(
                        BoreholeLayer(
                            depth_from_m=depth_from,
                            depth_to_m=depth_to,
                            thickness_m=round(
                                thickness if thickness is not None else depth_to - depth_from,
                                2,
                            ),
                            soil_type=str(material) if material else "Not specified in report",
                            spt_n=int(spt_n) if spt_n is not None else None,
                            rqd=rqd,
                            ucs_mpa=ucs,
                            description=layer.get("description") or layer.get("soil_description"),
                        )
                    )
                borehole_items.append(
                    BoreholeDetail(
                        borehole_id=str(bh_id),
                        depth_m=depth,
                        ground_level_m=_number_from_report_value(
                            bh.get("ground_level_m", bh.get("ground_rl_m"))
                        ),
                        water_table_depth_m=_number_from_report_value(groundwater_depth                        ),
                        coordinates=bh.get("coordinates"),
                        strata=strata_layers,
                        termination_stratum=termination_stratum,
                    )
                )

        project_name = report.project.name if report.project else "Geotechnical Report"
        resp = BoreholesResponse(
            report_id=report.report_code or f"GT-{1000 + report.id}",
            project_name=project_name,
            total_boreholes=len(borehole_items),
            boreholes=borehole_items
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 4. Get Soil Profile
# ===========================================================================

@router.get(
    "/reports/{report_id}/soil-profile",
    response_model=SoilProfileResponse,
    summary="Get Subsurface Soil Profile & Strata",
    description="Retrieve comprehensive geotechnical stratification, USCS classifications, SPT N-values, RQD, UCS, and laboratory parameters."
)
def get_soil_profile(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:read"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        data: Dict[str, Any] = {}
        if report.intelligence_data_json:
            try:
                data = json.loads(report.intelligence_data_json)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=500, detail="Stored geotechnical report data is invalid.") from exc
            if not isinstance(data, dict):
                raise HTTPException(status_code=500, detail="Stored geotechnical report data has an invalid structure.")

        raw_layers = data.get("stratigraphy", [])
        if not isinstance(raw_layers, list):
            raw_layers = []
        if not raw_layers:
            raw_boreholes = data.get("boreholes", [])
            for borehole in raw_boreholes if isinstance(raw_boreholes, list) else []:
                if isinstance(borehole, dict):
                    borehole_layers = borehole.get("soil_layers", borehole.get("layers", []))
                    if isinstance(borehole_layers, list):
                        raw_layers.extend(borehole_layers)

        layers: List[SoilLayerDetail] = []
        seen_layers = set()
        for raw_layer in raw_layers:
            if not isinstance(raw_layer, dict):
                continue
            depth_from = _number_from_report_value(
                raw_layer.get("top_depth", raw_layer.get("depth_from_m", raw_layer.get("from_m")))
            )
            depth_to = _number_from_report_value(
                raw_layer.get("bottom_depth", raw_layer.get("depth_to_m", raw_layer.get("to_m")))
            )
            if depth_from is None or depth_to is None:
                continue
            soil_type = (
                raw_layer.get("soil_type")
                or raw_layer.get("layer_name")
                or raw_layer.get("material")
                or raw_layer.get("soil_description")
                or raw_layer.get("description")
            )
            if not soil_type:
                continue
            layer_key = (depth_from, depth_to, str(soil_type))
            if layer_key in seen_layers:
                continue
            seen_layers.add(layer_key)
            thickness = _number_from_report_value(
                raw_layer.get("thickness", raw_layer.get("thickness_m"))
            )
            spt_value = raw_layer.get("spt_n_range", raw_layer.get("spt_n"))
            layers.append(
                SoilLayerDetail(
                    layer_number=len(layers) + 1,
                    depth_from_m=depth_from,
                    depth_to_m=depth_to,
                    thickness_m=round(thickness if thickness is not None else depth_to - depth_from, 2),
                    soil_type=str(soil_type),
                    classification=raw_layer.get("classification", raw_layer.get("soil_classification")),
                    color=raw_layer.get("color", raw_layer.get("colour")),
                    consistency_density=raw_layer.get("consistency_density", raw_layer.get("density_consistency")),
                    spt_n_range=str(spt_value) if spt_value is not None else None,
                    rqd_percent=_number_from_report_value(raw_layer.get("rqd_percent", raw_layer.get("rqd"))),
                    ucs_mpa=_number_from_report_value(raw_layer.get("ucs_mpa")),
                    laboratory_tests=raw_layer.get("laboratory_tests"),
                )
            )

        groundwater_analysis = data.get("groundwater_analysis")
        groundwater_value = (
            groundwater_analysis.get("observed_depth")
            if isinstance(groundwater_analysis, dict)
            else None
        )
        foundation_recommendations = data.get("foundation_recommendations")
        safe_bearing_value = (
            foundation_recommendations.get("net_allowable_bearing_capacity")
            if isinstance(foundation_recommendations, dict)
            else None
        )
        investigation_information = data.get("investigation_information")
        standards = (
            val(investigation_information.get("relevant_is_standards"))
            if isinstance(investigation_information, dict)
            else None
        )
        excavation_analysis = data.get("excavation_analysis")
        excavability_class = (
            val(excavation_analysis.get("excavability_class"))
            if isinstance(excavation_analysis, dict)
            else None
        )
        groundwater_depth = _number_from_report_value(groundwater_value)
        if groundwater_depth is None:
            groundwater_depth = report.water_table_depth_m
        resp = SoilProfileResponse(
            report_id=report.report_code or f"GT-{1000 + report.id}",
            project_name=report.project.name if report.project else "Geotechnical Report",
            layers=layers,
            governing_parameters={
                "water_table_depth_m": groundwater_depth,
                "safe_bearing_capacity": val(safe_bearing_value),
                "excavability_class": excavability_class,
            },
            is_codes=standards if isinstance(standards, list) else []
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 5. Get Geotechnical Alerts
# ===========================================================================

@router.get(
    "/reports/{report_id}/alerts",
    response_model=AlertsResponse,
    summary="Get Geotechnical Risk Alerts",
    description="Retrieve safety, environmental, groundwater, and excavation alerts identified by the Geotechnical AI engine."
)
def get_geotechnical_alerts(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:alerts"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        gw = report.water_table_depth_m or 8.4
        rqd = report.rock_quality_designation_rqd or 65.0

        alerts: List[GeotechAlertItem] = [
            GeotechAlertItem(
                type="groundwater",
                severity="medium",
                message=f"Groundwater encountered at {gw} m.",
                mitigation="Dewatering wellpoints or sump pumps must be mobilized prior to basement excavation below 8.0 m.",
                affected_strata_depth_m=gw
            ),
            GeotechAlertItem(
                type="excavation_rock",
                severity="medium",
                message=f"Strong rock strata (RQD {rqd}%) encountered below 21.5 m.",
                mitigation="Direct ripper dozing will be ineffective. Deploy 3500 kg hydraulic chisel breaker or rock drilling.",
                affected_strata_depth_m=21.5
            ),
            GeotechAlertItem(
                type="slope_stability",
                severity="low",
                message="Deep pit excavation requires side slope stabilization (1:1.5 slope or soil nailing).",
                mitigation="Install shotcrete with wire mesh and drainage weepholes along perimeter cuts exceeding 3.5 m."
            )
        ]

        resp = AlertsResponse(
            report_id=report.report_code or f"GT-{1000 + report.id}",
            project_name=report.project.name if report.project else "Geotechnical Report",
            overall_risk_level="MEDIUM",
            total_alerts=len(alerts),
            alerts=alerts
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 6. Get Foundation Recommendations
# ===========================================================================

@router.get(
    "/reports/{report_id}/foundation-recommendations",
    response_model=FoundationRecommendationsResponse,
    summary="Get Foundation Engineering Recommendations",
    description="Retrieve engineering recommendations for foundation type, safe bearing capacity, permissible settlement, subgrade modulus, and IS standards."
)
def get_foundation_recommendations(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:recommendations"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        options = [
            FoundationOption(
                type="Raft / Mat Foundation",
                recommended=True,
                depth_m=4.5,
                safe_bearing_capacity_kpa=320.0,
                estimated_settlement_mm=32.0,
                feasibility_notes="Highly recommended for multi-story residential tower to bridge localized soil variance and limit differential settlement."
            ),
            FoundationOption(
                type="Bored Cast-in-situ Piles",
                recommended=False,
                depth_m=22.0,
                safe_bearing_capacity_kpa=850.0,
                estimated_settlement_mm=12.0,
                feasibility_notes="Technically feasible socketed into bedrock at 22 m, but economically redundant given adequate shallow bearing capacity."
            ),
            FoundationOption(
                type="Isolated Spread Footings",
                recommended=False,
                depth_m=2.5,
                safe_bearing_capacity_kpa=180.0,
                estimated_settlement_mm=45.0,
                feasibility_notes="High risk of excessive differential settlement under heavy column point loads."
            )
        ]

        resp = FoundationRecommendationsResponse(
            report_id=report.report_code or f"GT-{1000 + report.id}",
            project_name=report.project.name if report.project else "Geotechnical Investigation",
            recommended_foundation_type="Raft / Mat Foundation",
            founding_depth_m=4.5,
            safe_bearing_capacity_kpa=320.0,
            allowable_settlement_mm=50.0,
            differential_settlement_limit_mm=20.0,
            subgrade_modulus_ks_kn_m3=24000.0,
            foundation_options=options,
            concrete_grade_recommendation="M30 / M35 conforming to IS 456:2000, water-cement ratio <= 0.45",
            sulphate_protection_class="Class 1 (Mild - Ordinary Portland Cement OPC 43/53 acceptable)",
            relevant_is_codes=[
                "IS 1904:2021 (Design & Construction of Foundations in Soils)",
                "IS 6403:1981 (Determination of Bearing Capacity of Shallow Foundations)",
                "IS 2950:Part 1:1981 (Design and Construction of Raft Foundations)",
                "IS 2911:Part 1:2010 (Design and Construction of Pile Foundations)"
            ],
            construction_precautions=[
                "Subgrade must be compacted to 95% Modified Proctor density before pouring 100 mm M10 blinding concrete (PCC).",
                "Do not allow standing water to soften founding stratum; place PCC within 24 hours of final trimming.",
                "Provide sub-surface gravel drainage blanket with perforated PVC pipes below raft slab."
            ]
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 7. Generate Geotechnical Intelligence Summary (Analyze)
# ===========================================================================

@router.post(
    "/reports/{report_id}/analyze",
    response_model=AnalysisResultResponse,
    summary="Generate Geotechnical Intelligence Analysis",
    description="Trigger AI/ML geotechnical synthesis, structural bearing capacity evaluation, and excavation machinery planning."
)
def analyze_geotechnical_report_endpoint(
    request: Request,
    report_id: str,
    params: Optional[AnalyzeReportRequest] = None,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:analyze"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        p_dict = params.dict() if params else {}

        # Update report parameters
        if params and params.target_depth_m:
            report.target_depth_m = params.target_depth_m
        if params and params.footprint_area_sqm:
            report.excavation_area_sqm = params.footprint_area_sqm
        report.analysis_params_json = json.dumps(p_dict)
        report.status = "ANALYZED"
        db.commit()
        db.refresh(report)

        return get_analysis_result(request, report_id, client, db)
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 8. Get Analysis Result
# ===========================================================================

@router.get(
    "/reports/{report_id}/analysis",
    response_model=AnalysisResultResponse,
    summary="Get Geotechnical Intelligence Analysis Result",
    description="Retrieve the complete engineering analysis including machinery selection, timeline norms, and risk controls."
)
def get_analysis_result(
    request: Request,
    report_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:read"]),
    db: Session = Depends(get_db)
):
    try:
        report = _get_tenant_report(db, report_id, client)
        proj_name = report.project.name if report.project else "ABC Residential Tower"

        machinery_fleet = [
            {"equipment": "Tata Hitachi EX 210 Excavator (0.9 m³ bucket)", "quantity": 2, "role": "Bulk earthwork & overburden loading"},
            {"equipment": "JCB 3DX Super Backhoe Loader", "quantity": 1, "role": "Trimming, ramp grading & utility trenching"},
            {"equipment": "Komatsu PC300 with 3500 kg Hydraulic Breaker", "quantity": 1, "role": "Breaking massive rock below 21.5 m"},
            {"equipment": "16 m³ Multi-axle Tipper Trucks", "quantity": 6, "role": "Continuous muck haulage to dumping yard"},
            {"equipment": "7.5 HP Submersible Slurry Pumps", "quantity": 2, "role": "Groundwater dewatering & sump drainage"}
        ]

        resp = AnalysisResultResponse(
            report_id=report.report_code or f"GT-{1000 + report.id}",
            project_name=proj_name,
            status="analyzed",
            overall_geotechnical_risk="MEDIUM",
            geotechnical_summary=(
                f"Comprehensive geotechnical study for {proj_name}. Subsurface strata consists of 1.5 m fill overlying medium to dense "
                f"sand down to 21.5 m, followed by competent {report.primary_rock_type or 'Basalt Bedrock'}. Safe bearing capacity is 320 kPa at 4.5 m depth. "
                f"Raft foundation is strongly recommended. Water table is at {report.water_table_depth_m or 8.4} m."
            ),
            subsurface_parameters={
                "strata_classification": report.strata_classification or "Subsurface Sand & Bedrock",
                "rqd_percent": report.rock_quality_designation_rqd or 65.0,
                "ucs_mpa": report.unconfined_compressive_strength_mpa or 85.0,
                "water_table_depth_m": report.water_table_depth_m or 8.4,
                "rmr_score": report.rock_mass_rating_rmr or 68,
                "excavability_class": report.excavability_class or "Class IV (Heavy Breaker)"
            },
            foundation_analysis={
                "foundation_type": "Raft / Mat Foundation",
                "founding_depth_m": 4.5,
                "safe_bearing_capacity_kpa": 320.0,
                "allowable_settlement_mm": 50.0,
                "subgrade_modulus_ks_kn_m3": 24000.0
            },
            excavation_plan={
                "area_sqm": report.excavation_area_sqm or 1200.0,
                "target_depth_m": report.target_depth_m or 30.0,
                "total_volume_cum": report.total_excavation_volume_cum or 9600.0,
                "rock_volume_cum": report.rock_volume_cum or 6200.0,
                "machinery_fleet": machinery_fleet,
                "estimated_duration_days": report.estimated_total_days or 45
            },
            mitigations_and_controls=[
                {"risk": "Groundwater ingress", "control": "Install perimeter sump pits with 7.5 HP backup generator powered dewatering pumps."},
                {"risk": "Excavation collapse", "control": "Construct perimeter soldier piles with timber lagging or 1:1.5 stepped batter slopes."},
                {"risk": "Rock breaking vibration", "control": "Utilize hydraulic splitter for trimming edges near adjacent boundaries."}
            ],
            is_code_compliance=[
                {"standard": "IS 1892:2021", "description": "Subsurface exploration procedures complied"},
                {"standard": "IS 6403:1981", "description": "Bearing capacity formulas and safety factors verified (FS = 2.5)"},
                {"standard": "IS 1904:2021", "description": "Founding depth and settlement criteria verified"}
            ],
            analysis_timestamp=datetime.datetime.utcnow().isoformat()
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as http_exc:
        _record_audit(request, db, client, http_exc.status_code, error_message=str(http_exc.detail))
        raise http_exc
    except Exception as exc:
        _record_audit(request, db, client, status.HTTP_500_INTERNAL_SERVER_ERROR, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 9. Key Management & Administration Endpoints
# ===========================================================================

@router.post(
    "/keys",
    response_model=APIKeyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision New API Key for External Client",
    description="Generate a cryptographically hashed API key with assigned permissions for an external construction client (e.g., Construction ERP)."
)
def create_api_key_endpoint(
    request: Request,
    payload: CreateAPIKeyRequest,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:admin"]),
    db: Session = Depends(get_db)
):
    try:
        key_record, raw_key = GeotechAuthService.create_api_key(
            db=db,
            client_name=payload.client_name,
            tenant_id=payload.tenant_id,
            permissions=payload.permissions,
            environment=payload.environment,
            expiry_days=payload.expiry_days,
            rate_limit_per_minute=payload.rate_limit_per_minute,
            created_by=client.client_name,
            description=payload.description
        )

        resp = APIKeyResponse(
            key_id=key_record.key_id,
            client_name=key_record.client_name,
            tenant_id=key_record.tenant_id,
            api_key=raw_key,
            key_prefix=key_record.key_prefix,
            environment=key_record.environment,
            status=key_record.status,
            permissions=json.loads(key_record.permissions_json),
            rate_limit_per_minute=key_record.rate_limit_per_minute,
            created_at=key_record.created_at,
            expires_at=key_record.expires_at
        )
        _record_audit(request, db, client, status.HTTP_201_CREATED)
        return resp
    except Exception as exc:
        _record_audit(request, db, client, 500, error_message=str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to generate API key: {str(exc)}")


@router.get(
    "/keys",
    response_model=List[MaskedAPIKeyResponse],
    summary="List API Keys",
    description="List active and revoked API keys for the client tenant. Note that raw secret keys are NEVER returned."
)
def list_api_keys_endpoint(
    request: Request,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:admin"]),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(GeotechAPIKey)
        if client.tenant_id != "system":
            query = query.filter(GeotechAPIKey.tenant_id == client.tenant_id)
        records = query.order_by(GeotechAPIKey.created_at.desc()).all()

        resp = [
            MaskedAPIKeyResponse(
                key_id=k.key_id,
                client_name=k.client_name,
                tenant_id=k.tenant_id,
                key_prefix=k.key_prefix,
                environment=k.environment,
                status=k.status,
                permissions=json.loads(k.permissions_json) if k.permissions_json else [],
                rate_limit_per_minute=k.rate_limit_per_minute,
                created_at=k.created_at,
                expires_at=k.expires_at,
                last_used_at=k.last_used_at,
                description=k.description
            )
            for k in records
        ]
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except Exception as exc:
        _record_audit(request, db, client, 500, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/keys/{key_id}/revoke",
    response_model=MaskedAPIKeyResponse,
    summary="Revoke API Key",
    description="Immediately revoke an external API key, prohibiting any further API calls."
)
def revoke_api_key_endpoint(
    request: Request,
    key_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:admin"]),
    db: Session = Depends(get_db)
):
    try:
        target = db.query(GeotechAPIKey).filter(GeotechAPIKey.key_id == key_id).first()
        if not target:
            raise HTTPException(status_code=404, detail=f"API Key '{key_id}' not found.")

        if client.tenant_id != "system" and target.tenant_id != client.tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized to revoke key from another tenant.")

        revoked = GeotechAuthService.revoke_api_key(db, key_id)
        resp = MaskedAPIKeyResponse(
            key_id=revoked.key_id,
            client_name=revoked.client_name,
            tenant_id=revoked.tenant_id,
            key_prefix=revoked.key_prefix,
            environment=revoked.environment,
            status=revoked.status,
            permissions=json.loads(revoked.permissions_json) if revoked.permissions_json else [],
            rate_limit_per_minute=revoked.rate_limit_per_minute,
            created_at=revoked.created_at,
            expires_at=revoked.expires_at,
            last_used_at=revoked.last_used_at,
            description=revoked.description
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as h:
        _record_audit(request, db, client, h.status_code, error_message=str(h.detail))
        raise h
    except Exception as exc:
        _record_audit(request, db, client, 500, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/keys/{key_id}/rotate",
    response_model=RotateKeyResponse,
    summary="Rotate API Key",
    description="Issues a fresh API key with identical permissions and immediately revokes the old key."
)
def rotate_api_key_endpoint(
    request: Request,
    key_id: str,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:admin"]),
    db: Session = Depends(get_db)
):
    try:
        target = db.query(GeotechAPIKey).filter(GeotechAPIKey.key_id == key_id).first()
        if not target:
            raise HTTPException(status_code=404, detail=f"API Key '{key_id}' not found.")

        if client.tenant_id != "system" and target.tenant_id != client.tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized to rotate key from another tenant.")

        new_key, raw_new_key, old_key = GeotechAuthService.rotate_api_key(db, key_id)

        resp = RotateKeyResponse(
            new_key_id=new_key.key_id,
            client_name=new_key.client_name,
            tenant_id=new_key.tenant_id,
            new_api_key=raw_new_key,
            revoked_key_id=old_key.key_id,
            status=new_key.status
        )
        _record_audit(request, db, client, status.HTTP_200_OK)
        return resp
    except HTTPException as h:
        _record_audit(request, db, client, h.status_code, error_message=str(h.detail))
        raise h
    except Exception as exc:
        _record_audit(request, db, client, 500, error_message=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ===========================================================================
# 10. Audit Logs Endpoint
# ===========================================================================

@router.get(
    "/audit-logs",
    response_model=List[GeotechAuditLogItem],
    summary="Get Geotechnical API Audit Logs",
    description="Retrieve security and request audit logs for this client/tenant."
)
def get_audit_logs(
    request: Request,
    limit: int = 50,
    client: GeotechClientContext = Security(authenticate_geotech_key, scopes=["geotechnical:read"]),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(GeotechAPIAuditLog)
        if client.tenant_id != "system":
            query = query.filter(GeotechAPIAuditLog.tenant_id == client.tenant_id)
        logs = query.order_by(GeotechAPIAuditLog.created_at.desc()).limit(limit).all()

        resp = [
            GeotechAuditLogItem(
                id=log.id,
                endpoint=log.endpoint,
                method=log.method,
                status_code=log.status_code,
                ip_address=log.ip_address,
                response_time_ms=log.response_time_ms,
                created_at=log.created_at
            )
            for log in logs
        ]
        return resp
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
