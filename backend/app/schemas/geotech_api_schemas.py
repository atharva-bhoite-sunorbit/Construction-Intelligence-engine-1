from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==========================================
# API Key Management Schemas
# ==========================================

class CreateAPIKeyRequest(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=255, description="External system/client name, e.g. Construction ERP")
    tenant_id: str = Field(..., min_length=2, max_length=100, description="Tenant identifier for strict data isolation")
    permissions: List[str] = Field(
        default=[
            "geotechnical:upload",
            "geotechnical:read",
            "geotechnical:analyze",
            "geotechnical:alerts",
            "geotechnical:recommendations",
        ],
        description="Granular permission scopes granted to this client"
    )
    environment: str = Field(default="production", pattern="^(production|staging|development)$")
    expiry_days: Optional[int] = Field(default=365, ge=1, le=3650, description="Key validity in days (None for non-expiring)")
    rate_limit_per_minute: int = Field(default=60, ge=10, le=1000, description="Rate limit in requests per minute")
    description: Optional[str] = Field(default=None, max_length=500)


class APIKeyResponse(BaseModel):
    key_id: str = Field(..., description="Public identifier of the key")
    client_name: str
    tenant_id: str
    api_key: str = Field(..., description="Cryptographically secure API key. Copy this now; it will never be displayed again.")
    key_prefix: str
    environment: str
    status: str
    permissions: List[str]
    rate_limit_per_minute: int
    created_at: datetime.datetime
    expires_at: Optional[datetime.datetime] = None
    warning: str = "Make sure to copy your API key now. For security reasons, it cannot be recovered after this response."


class MaskedAPIKeyResponse(BaseModel):
    key_id: str
    client_name: str
    tenant_id: str
    key_prefix: str
    environment: str
    status: str
    permissions: List[str]
    rate_limit_per_minute: int
    created_at: datetime.datetime
    expires_at: Optional[datetime.datetime] = None
    last_used_at: Optional[datetime.datetime] = None
    description: Optional[str] = None


class RotateKeyResponse(BaseModel):
    new_key_id: str
    client_name: str
    tenant_id: str
    new_api_key: str = Field(..., description="Newly provisioned API key. Copy this now.")
    revoked_key_id: str
    status: str
    warning: str = "Old key has been revoked. Immediately update your external integration with this new key."


# ==========================================
# Geotechnical Intelligence Report Schemas
# ==========================================

class GeotechAlertItem(BaseModel):
    type: str = Field(..., description="Alert category (e.g. groundwater, liquefaction, low_sbc, rock_hardness)")
    severity: str = Field(..., description="low, medium, high, critical")
    message: str = Field(..., description="Clear explanation of the geotechnical risk")
    mitigation: Optional[str] = Field(default=None, description="Recommended engineering mitigation or site precaution")
    affected_strata_depth_m: Optional[float] = Field(default=None, description="Depth range affected in meters")


class SoilSummary(BaseModel):
    top_layer: str
    major_soil: str
    rock_depth_m: Optional[float] = None


class GeotechReportOverviewResponse(BaseModel):
    """
    Standard overview format required by external integration clients.
    """
    report_id: str = Field(..., description="Unique Geotechnical Report identifier, e.g. GT-1001")
    project_name: str = Field(..., description="Associated construction project name")
    status: str = Field(default="analyzed", description="Processing state: analyzed, pending, pushed_to_schedule")
    boreholes: int = Field(default=1, description="Number of investigated boreholes")
    maximum_depth_m: float = Field(..., description="Maximum exploration depth in meters")
    groundwater_level_m: Optional[float] = Field(default=None, description="Depth to groundwater table in meters")
    soil_summary: SoilSummary
    alerts: List[GeotechAlertItem] = Field(default_factory=list)
    analysis_available: bool = True
    tenant_id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None


class BoreholeLayer(BaseModel):
    depth_from_m: float
    depth_to_m: float
    thickness_m: float
    soil_type: str
    spt_n: Optional[int] = None
    rqd: Optional[float] = None
    ucs_mpa: Optional[float] = None
    description: Optional[str] = None


class BoreholeDetail(BaseModel):
    borehole_id: str
    depth_m: float
    ground_level_m: Optional[float] = None
    water_table_depth_m: Optional[float] = None
    coordinates: Optional[Dict[str, Any]] = None
    strata: List[BoreholeLayer] = Field(default_factory=list)
    termination_stratum: Optional[str] = None


class BoreholesResponse(BaseModel):
    report_id: str
    project_name: str
    total_boreholes: int
    boreholes: List[BoreholeDetail]


class SoilLayerDetail(BaseModel):
    layer_number: int
    depth_from_m: float
    depth_to_m: float
    thickness_m: float
    soil_type: str
    classification: str
    color: Optional[str] = None
    consistency_density: Optional[str] = None
    spt_n_range: Optional[str] = None
    rqd_percent: Optional[float] = None
    ucs_mpa: Optional[float] = None
    laboratory_tests: Optional[Dict[str, Any]] = None


class SoilProfileResponse(BaseModel):
    report_id: str
    project_name: str
    layers: List[SoilLayerDetail]
    governing_parameters: Dict[str, Any]
    is_codes: List[str]


class AlertsResponse(BaseModel):
    report_id: str
    project_name: str
    overall_risk_level: str
    total_alerts: int
    alerts: List[GeotechAlertItem]


class FoundationOption(BaseModel):
    type: str
    recommended: bool
    depth_m: Optional[float] = None
    safe_bearing_capacity_kpa: Optional[float] = None
    estimated_settlement_mm: Optional[float] = None
    feasibility_notes: str


class FoundationRecommendationsResponse(BaseModel):
    report_id: str
    project_name: str
    recommended_foundation_type: str
    founding_depth_m: float
    safe_bearing_capacity_kpa: float
    allowable_settlement_mm: float
    differential_settlement_limit_mm: float
    subgrade_modulus_ks_kn_m3: Optional[float] = None
    foundation_options: List[FoundationOption] = Field(default_factory=list)
    concrete_grade_recommendation: str
    sulphate_protection_class: str
    relevant_is_codes: List[str]
    construction_precautions: List[str]


class AnalyzeReportRequest(BaseModel):
    structural_load_kn: Optional[float] = Field(default=None, description="Total design structural column/building load in kN")
    footprint_area_sqm: Optional[float] = Field(default=None, description="Excavation/plinth footprint area in m²")
    target_depth_m: Optional[float] = Field(default=None, description="Target basement or excavation founding depth in meters")
    seismic_zone: Optional[str] = Field(default="Zone III", description="Seismic zone per IS 1893: Zone II, Zone III, Zone IV, Zone V")


class AnalysisResultResponse(BaseModel):
    report_id: str
    project_name: str
    status: str
    overall_geotechnical_risk: str
    geotechnical_summary: str
    subsurface_parameters: Dict[str, Any]
    foundation_analysis: Dict[str, Any]
    excavation_plan: Dict[str, Any]
    mitigations_and_controls: List[Dict[str, Any]]
    is_code_compliance: List[Dict[str, Any]]
    analysis_timestamp: str


class GeotechAuditLogItem(BaseModel):
    id: int
    endpoint: str
    method: str
    status_code: int
    ip_address: Optional[str] = None
    response_time_ms: Optional[float] = None
    created_at: datetime.datetime
