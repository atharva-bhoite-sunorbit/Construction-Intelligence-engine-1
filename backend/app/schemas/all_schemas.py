from typing import List, Optional, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field

# User / Auth
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "Engineer"

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Project
class ProjectBase(BaseModel):
    name: str
    code: str
    construction_type: str # Residential, Commercial, High-Rise, Mall, Factory, etc.
    location: str
    num_floors: int = 1
    num_towers: int = 1
    built_up_area: float
    plot_area: Optional[float] = None
    planned_start_date: date
    target_completion_date: date
    project_manager: Optional[str] = None
    site_manager: Optional[str] = None
    contractor: Optional[str] = None
    description: Optional[str] = None
    stage_engineers: Optional[Dict[str, List[str]]] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    construction_type: Optional[str] = None
    location: Optional[str] = None
    num_floors: Optional[int] = None
    num_towers: Optional[int] = None
    built_up_area: Optional[float] = None
    plot_area: Optional[float] = None
    planned_start_date: Optional[date] = None
    target_completion_date: Optional[date] = None
    project_manager: Optional[str] = None
    site_manager: Optional[str] = None
    contractor: Optional[str] = None
    description: Optional[str] = None
    stage_engineers: Optional[Dict[str, List[str]]] = None
    status: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    total_activities: Optional[int] = 0
    completed_activities: Optional[int] = 0
    delayed_activities: Optional[int] = 0
    overall_progress: Optional[float] = 0.0

    class Config:
        from_attributes = True


# Activity
class ActivityBase(BaseModel):
    name: str
    code: Optional[str] = None
    phase: str = "Execution"
    work_package: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    building: str = "Main Building"
    tower: str = "Tower A"
    floor: int = 0
    zone: str = "Zone 1"
    quantity: float = 1.0
    unit: str = "units"
    planned_duration: int = 1
    start_date: date
    end_date: date
    required_labour: int = 5
    required_material: Optional[str] = None
    required_equipment: Optional[str] = None
    priority: str = "MEDIUM" # LOW, MEDIUM, HIGH, CRITICAL
    validation_status: str = "PENDING" # PENDING, APPROVED, REJECTED
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    validation_notes: Optional[str] = None

class ActivityCreate(ActivityBase):
    project_id: int

class ActivityValidationRequest(BaseModel):
    validation_status: str # APPROVED, REJECTED, PENDING
    validation_notes: Optional[str] = None
    validated_by: Optional[str] = "Project Manager"

class BatchActivityValidationRequest(BaseModel):
    activity_ids: List[int]
    validation_status: str # APPROVED, REJECTED, PENDING
    validation_notes: Optional[str] = None
    validated_by: Optional[str] = "Project Manager"

class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    phase: Optional[str] = None
    work_package: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    building: Optional[str] = None
    tower: Optional[str] = None
    floor: Optional[int] = None
    zone: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    planned_duration: Optional[int] = None
    actual_duration: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    required_labour: Optional[int] = None
    required_material: Optional[str] = None
    required_equipment: Optional[str] = None
    priority: Optional[str] = None
    is_critical: Optional[bool] = None
    status: Optional[str] = None
    progress_percent: Optional[float] = None
    validation_status: Optional[str] = None
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    validation_notes: Optional[str] = None

class ActivityResponse(ActivityBase):
    id: int
    project_id: int
    actual_duration: Optional[int] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_critical: bool = False
    status: str = "NOT_STARTED"
    progress_percent: float = 0.0
    early_start: int = 0
    early_finish: int = 0
    late_start: int = 0
    late_finish: int = 0
    total_float: int = 0
    free_float: int = 0
    sort_order: int = 0
    delay_risk_score: Optional[float] = None
    predicted_delay_days: Optional[float] = None
    risk_level: Optional[str] = None

    class Config:
        from_attributes = True


# Dependency
class DependencyCreate(BaseModel):
    predecessor_id: int
    successor_id: int
    dependency_type: str = "FS" # FS, SS, FF, SF
    lag_days: int = 0

class DependencyResponse(BaseModel):
    id: int
    project_id: int
    predecessor_id: int
    successor_id: int
    dependency_type: str
    lag_days: int
    predecessor_name: Optional[str] = None
    successor_name: Optional[str] = None

    class Config:
        from_attributes = True


# Resource
class ResourceBase(BaseModel):
    category: str # Labour, Material, Equipment
    type_name: str
    unit: str = "units"
    standard_rate: float = 0.0
    available_capacity: float = 0.0
    notes: Optional[str] = None

class ResourceCreate(ResourceBase):
    project_id: int

class ResourceUpdate(BaseModel):
    category: Optional[str] = None
    type_name: Optional[str] = None
    unit: Optional[str] = None
    standard_rate: Optional[float] = None
    available_capacity: Optional[float] = None
    notes: Optional[str] = None

class ResourceResponse(ResourceBase):
    id: int
    project_id: int
    total_required: Optional[float] = 0.0
    total_allocated: Optional[float] = 0.0
    shortage: Optional[float] = 0.0
    utilization_percent: Optional[float] = 0.0

    class Config:
        from_attributes = True

class ActivityResourcePlanCreate(BaseModel):
    activity_id: int
    resource_id: int
    required_qty: float
    allocated_qty: float = 0.0
    notes: Optional[str] = None

class ActivityResourcePlanResponse(BaseModel):
    id: int
    activity_id: int
    resource_id: int
    resource_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    required_qty: float
    allocated_qty: float
    shortage: Optional[float] = 0.0
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# Daily Progress
class DailyProgressCreate(BaseModel):
    activity_id: int
    report_date: date
    planned_quantity: float
    actual_quantity: float
    workers_available: int
    workers_assigned: int
    working_hours: float = 8.0
    material_availability_percent: float = 100.0
    equipment_availability_percent: float = 100.0
    issues: Optional[str] = None
    remarks: Optional[str] = None
    weather: Optional[str] = "Clear"

class DailyProgressResponse(BaseModel):
    id: int
    project_id: int
    activity_id: int
    activity_name: Optional[str] = None
    report_date: date
    planned_quantity: float
    actual_quantity: float
    workers_available: int
    workers_assigned: int
    working_hours: float
    material_availability_percent: float
    equipment_availability_percent: float
    daily_productivity: float
    cumulative_productivity: float
    planned_progress_percent: float
    actual_progress_percent: float
    progress_variance_percent: float
    labour_shortage: int
    material_shortage: float
    equipment_shortage: float
    issues: Optional[str] = None
    remarks: Optional[str] = None
    weather: Optional[str] = None
    validation_status: Optional[str] = "PENDING"
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    validation_checklist_json: Optional[str] = None
    validation_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Weather & Soil Environmental Analysis
class EnvironmentalAnalysisCreate(BaseModel):
    temperature_c: float = 28.0
    wind_speed_kmh: float = 15.0
    weather_condition: str = "Clear"
    humidity_percent: float = 55.0
    rainfall_mm: float = 0.0
    soil_type: Optional[str] = "Sandy Loam"
    safe_bearing_capacity_kpa: Optional[float] = 200.0
    moisture_content_percent: Optional[float] = 14.0
    water_table_depth_m: Optional[float] = 3.2
    compaction_percent: Optional[float] = 95.0
    soil_report_filename: Optional[str] = None
    soil_report_raw_text: Optional[str] = None
    geotechnical_details: Optional[Dict[str, Any]] = None
    manager_notes: Optional[str] = None

class EnvironmentalAnalysisResponse(BaseModel):
    id: int
    project_id: int
    recorded_date: date
    temperature_c: float
    wind_speed_kmh: float
    weather_condition: str
    humidity_percent: float
    rainfall_mm: float
    soil_type: str
    safe_bearing_capacity_kpa: float
    moisture_content_percent: float
    water_table_depth_m: float
    compaction_percent: float
    soil_report_filename: Optional[str] = None
    overall_site_risk: str
    wind_risk_assessment: Optional[str] = None
    temperature_risk_assessment: Optional[str] = None
    soil_risk_assessment: Optional[str] = None
    affected_activities: List[Any] = []
    recommendations: List[str] = []
    geotechnical_details: Optional[Dict[str, Any]] = None
    manager_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Validation Checklist
class ChecklistItemSubmission(BaseModel):
    category: str
    item: str
    status: str # PASS, CONDITIONAL, FAIL
    comment: Optional[str] = None

class ValidationChecklistSubmission(BaseModel):
    overall_decision: str = "APPROVED" # APPROVED, CONDITIONAL, REJECTED
    validated_by: str
    validation_notes: Optional[str] = None
    checklist_items: List[ChecklistItemSubmission]
    validation_type: Optional[str] = "DAILY_PROGRESS"
    activity_id: Optional[int] = None


# Blockers
class BlockerCreate(BaseModel):
    activity_id: Optional[int] = None
    category: str # Material Delay, Labour Shortage, Equipment Failure, Weather, etc.
    description: str
    severity: str = "MEDIUM" # LOW, MEDIUM, HIGH, CRITICAL
    opened_date: date
    expected_resolution: Optional[date] = None
    mitigation_plan: Optional[str] = None

class BlockerUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    expected_resolution: Optional[date] = None
    resolved_date: Optional[date] = None
    status: Optional[str] = None
    mitigation_plan: Optional[str] = None

class BlockerResponse(BaseModel):
    id: int
    project_id: int
    activity_id: Optional[int] = None
    activity_name: Optional[str] = None
    category: str
    description: str
    severity: str
    opened_date: date
    expected_resolution: Optional[date] = None
    resolved_date: Optional[date] = None
    status: str
    mitigation_plan: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Site Observation
class SiteObservationCreate(BaseModel):
    activity_id: Optional[int] = None
    date: date
    photo_url: str
    photo_caption: Optional[str] = None
    category: str = "Progress"
    description: Optional[str] = None

class SiteObservationResponse(BaseModel):
    id: int
    project_id: int
    activity_id: Optional[int] = None
    activity_name: Optional[str] = None
    date: date
    photo_url: str
    photo_caption: Optional[str] = None
    category: str
    description: Optional[str] = None
    verification_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# Auto Plan Request
class AutoPlanRequest(BaseModel):
    template_type: Optional[str] = None # defaults to project construction_type
    num_floors: Optional[int] = None
    num_towers: Optional[int] = None
    zones_per_floor: int = 1
    include_mep_finishes: bool = True


# ML Predictions
class MLDelayPredictionResponse(BaseModel):
    id: int
    activity_id: int
    activity_name: str
    prediction_date: date
    delay_probability: float
    risk_level: str
    predicted_delay_days: float
    confidence_score: float
    model_version: str
    prediction_mode: str

class MLDurationPredictionResponse(BaseModel):
    id: int
    activity_id: int
    activity_name: str
    prediction_date: date
    predicted_duration: float
    interval_lower: Optional[float] = None
    interval_upper: Optional[float] = None
    confidence_score: float
    model_version: str
    prediction_mode: str

class MLProductivityPredictionResponse(BaseModel):
    id: int
    activity_id: int
    activity_name: str
    prediction_date: date
    predicted_daily_productivity: float
    unit: str
    confidence_score: float
    model_version: str
    prediction_mode: str

class MLLabourPredictionResponse(BaseModel):
    id: int
    activity_id: int
    activity_name: str
    prediction_date: date
    predicted_workers_required: int
    confidence_score: float
    model_version: str
    prediction_mode: str

class MLMaterialPredictionResponse(BaseModel):
    id: int
    resource_id: int
    resource_name: str
    prediction_date: date
    expected_consumption: float
    current_stock: float
    predicted_shortage: float
    shortage_probability: float
    model_version: str
    prediction_mode: str


# Impact Analysis
class ImpactItem(BaseModel):
    affected_activity_id: int
    affected_activity_name: str
    impact_days: float
    impact_level: str
    path_depth: int
    reason: str
    cascade_chain: List[str]

class ImpactAnalysisResponse(BaseModel):
    source_activity_id: int
    source_activity_name: str
    delay_days: float
    affected_activities: List[ImpactItem]
    project_completion_slippage_days: float
    critical_path_affected: bool


# Completion Forecast
class CompletionForecastResponse(BaseModel):
    project_id: int
    forecast_date: date
    baseline_completion_date: date
    predicted_completion_date: date
    slippage_days: int
    schedule_health_score: float
    critical_path_length_days: int
    confidence_interval_days: int
    methodology_notes: str
    prediction_mode: str


# AI Recommendations & Chat
class AIRecommendationResponse(BaseModel):
    id: int
    project_id: int
    activity_id: Optional[int] = None
    activity_name: Optional[str] = None
    risk_level: str
    issue_summary: str
    contributing_factors: List[str]
    ai_explanation: str
    recommended_actions: List[str]
    status: str
    manager_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RecommendationActionRequest(BaseModel):
    status: str # APPROVED, REJECTED, MODIFIED
    manager_notes: Optional[str] = None

class AIManagementSummaryResponse(BaseModel):
    id: int
    project_id: int
    summary_date: date
    overall_progress: float
    activities_completed: int
    activities_delayed: int
    high_risk_activities: int
    labour_shortage_count: int
    material_risk_count: int
    potential_slippage_days: int
    key_issues: List[str]
    risk_explanation: str
    recommended_actions: List[str]
    next_day_priorities: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AIChatRequest(BaseModel):
    project_id: Optional[int] = None
    query: str

class AIChatResponse(BaseModel):
    query: str
    response: str
    data_context: Optional[Dict[str, Any]] = None
    suggested_questions: Optional[List[str]] = None


# Geotechnical Report & Excavation AI
class GeotechnicalAnalysisRequest(BaseModel):
    raw_text: Optional[str] = None
    filename: Optional[str] = None
    target_depth_m: Optional[float] = 6.0
    excavation_area_sqm: Optional[float] = 1200.0
    water_table_depth_m: Optional[float] = None
    blasting_permitted: Optional[bool] = False
    near_existing_structures: Optional[bool] = True
    shifts_per_day: Optional[int] = 1
    hours_per_shift: Optional[float] = 8.0
    start_date: Optional[str] = None

class PushToScheduleRequest(BaseModel):
    replace_existing: Optional[bool] = False
    cost_multiplier: Optional[float] = 1.0

class GeotechnicalReportResponse(BaseModel):
    id: int
    project_id: int
    report_title: str
    filename: Optional[str] = None
    primary_rock_type: str
    strata_classification: str
    rock_quality_designation_rqd: Optional[float] = None
    unconfined_compressive_strength_mpa: Optional[float] = None
    weathering_grade: Optional[str] = None
    rock_mass_rating_rmr: Optional[int] = None
    excavability_class: str
    water_table_depth_m: Optional[float] = None
    excavation_area_sqm: float
    target_depth_m: float
    total_excavation_volume_cum: float
    rock_volume_cum: float
    overburden_volume_cum: float
    estimated_total_days: int
    strata_layers: List[Dict[str, Any]] = []
    rock_types: List[Dict[str, Any]] = []
    recommended_machinery: List[Dict[str, Any]] = []
    planned_activities: List[Dict[str, Any]] = []
    hazard_controls: List[Dict[str, Any]] = []
    summary: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

