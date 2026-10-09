import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, Text, ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="Engineer") # Admin, Project Manager, Site Manager, Engineer, Supervisor, Viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    progress_reports = relationship("DailyProgress", back_populates="reported_by")
    blockers_reported = relationship("Blocker", back_populates="reported_by")
    audit_logs = relationship("AuditLog", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    construction_type = Column(String(100), nullable=False) # Residential, Commercial, High-Rise, Mall, Factory, Industrial, Hotel, Hospital, Warehouse, Infrastructure, Other
    location = Column(String(255), nullable=False)
    num_floors = Column(Integer, default=1)
    num_towers = Column(Integer, default=1)
    built_up_area = Column(Float, nullable=False) # sq.ft or sq.m
    plot_area = Column(Float, nullable=True)
    planned_start_date = Column(Date, nullable=False)
    target_completion_date = Column(Date, nullable=False)
    project_manager = Column(String(255), nullable=True)
    site_manager = Column(String(255), nullable=True)
    contractor = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    stage_engineers_json = Column(Text, nullable=True) # JSON dictionary of stage -> list of site engineers
    status = Column(String(50), default="PLANNING") # PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    activities = relationship("Activity", back_populates="project", cascade="all, delete-orphan")
    dependencies = relationship("ActivityDependency", back_populates="project", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="project", cascade="all, delete-orphan")
    daily_progresses = relationship("DailyProgress", back_populates="project", cascade="all, delete-orphan")
    blockers = relationship("Blocker", back_populates="project", cascade="all, delete-orphan")
    site_observations = relationship("SiteObservation", back_populates="project", cascade="all, delete-orphan")
    completion_forecasts = relationship("ProjectCompletionForecast", back_populates="project", cascade="all, delete-orphan")
    boq_items = relationship("BOQItem", back_populates="project", cascade="all, delete-orphan")
    ai_recommendations = relationship("AIRecommendation", back_populates="project", cascade="all, delete-orphan")
    ai_summaries = relationship("AIManagementSummary", back_populates="project", cascade="all, delete-orphan")
    environmental_logs = relationship("SiteEnvironmentalLog", back_populates="project", cascade="all, delete-orphan")
    site_validations = relationship("SiteValidationRecord", back_populates="project", cascade="all, delete-orphan")
    geotechnical_reports = relationship("GeotechnicalReport", back_populates="project", cascade="all, delete-orphan")


class BOQItem(Base):
    __tablename__ = "boq_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    item_code = Column(String(50), nullable=False, index=True)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(String(50), nullable=False)
    quantity = Column(Float, default=0.0)
    wastage_pct = Column(Float, default=0.0)
    final_quantity = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="boq_items")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=True) # e.g. ACT-T1-F04-SLAB
    phase = Column(String(100), nullable=False, default="Execution") # Pre-Construction, Substructure, Superstructure, MEP, Finishing, Handover
    work_package = Column(String(100), nullable=True) # e.g. Foundation, Structure, Masonry, MEP, Interior
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)
    building = Column(String(100), default="Main Building")
    tower = Column(String(100), default="Tower A")
    floor = Column(Integer, default=0) # 0 for Ground / Substructure
    zone = Column(String(100), default="Zone 1")
    quantity = Column(Float, default=1.0)
    unit = Column(String(50), default="units") # m3, sq.m, tons, units
    planned_duration = Column(Integer, default=1) # in days
    actual_duration = Column(Integer, nullable=True) # in days
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id", ondelete="SET NULL"), nullable=True)
    
    required_labour = Column(Integer, default=5)
    required_material = Column(String(255), nullable=True)
    required_equipment = Column(String(255), nullable=True)
    priority = Column(String(50), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    is_critical = Column(Boolean, default=False)
    status = Column(String(50), default="NOT_STARTED") # NOT_STARTED, IN_PROGRESS, COMPLETED, DELAYED, BLOCKED
    progress_percent = Column(Float, default=0.0)

    # CPM fields
    early_start = Column(Integer, default=0) # day offset from project start
    early_finish = Column(Integer, default=0)
    late_start = Column(Integer, default=0)
    late_finish = Column(Integer, default=0)
    total_float = Column(Integer, default=0)
    free_float = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)

    # Role Assignment & Multi-tier Governance
    assigned_role = Column(String(50), default="Site Manager") # Site Manager, Admin, Project Manager

    # Legacy & Aggregate Validation Status
    validation_status = Column(String(50), default="PENDING") # PENDING, AWAITING_PM_VERIFICATION, APPROVED, REJECTED
    validated_by = Column(String(255), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    validation_notes = Column(Text, nullable=True)

    # Stage 1 Validation (by Site Manager or Admin)
    stage1_status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED
    stage1_validated_by = Column(String(255), nullable=True)
    stage1_validated_at = Column(DateTime, nullable=True)
    stage1_notes = Column(Text, nullable=True)

    # Stage 2 PM Verification / Countersign
    pm_verification_status = Column(String(50), default="PENDING") # PENDING, VERIFIED, REJECTED
    pm_verified_by = Column(String(255), nullable=True)
    pm_verified_at = Column(DateTime, nullable=True)
    pm_verification_notes = Column(Text, nullable=True)

    # Mandatory Gate: True ONLY once Project Manager verifies Stage 1 work or approves PM-direct work
    final_recorded = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="activities")
    predecessors = relationship(
        "ActivityDependency",
        foreign_keys="ActivityDependency.successor_id",
        back_populates="successor",
        cascade="all, delete-orphan"
    )
    successors = relationship(
        "ActivityDependency",
        foreign_keys="ActivityDependency.predecessor_id",
        back_populates="predecessor",
        cascade="all, delete-orphan"
    )
    resource_allocations = relationship("ActivityResourcePlan", back_populates="activity", cascade="all, delete-orphan")
    daily_progresses = relationship("DailyProgress", back_populates="activity", cascade="all, delete-orphan")
    blockers = relationship("Blocker", back_populates="activity", cascade="all, delete-orphan")
    site_observations = relationship("SiteObservation", back_populates="activity", cascade="all, delete-orphan")
    delay_predictions = relationship("MLDelayPrediction", back_populates="activity", cascade="all, delete-orphan")
    duration_predictions = relationship("MLDurationPrediction", back_populates="activity", cascade="all, delete-orphan")
    productivity_predictions = relationship("MLProductivityPrediction", back_populates="activity", cascade="all, delete-orphan")
    labour_predictions = relationship("MLLabourPrediction", back_populates="activity", cascade="all, delete-orphan")
    recommendations = relationship("AIRecommendation", back_populates="activity", cascade="all, delete-orphan")


class ActivityDependency(Base):
    __tablename__ = "activity_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    predecessor_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    successor_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_type = Column(String(10), default="FS") # FS (Finish to Start), SS (Start to Start), FF (Finish to Finish), SF (Start to Finish)
    lag_days = Column(Integer, default=0)

    project = relationship("Project", back_populates="dependencies")
    predecessor = relationship("Activity", foreign_keys=[predecessor_id], back_populates="successors")
    successor = relationship("Activity", foreign_keys=[successor_id], back_populates="predecessors")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False) # Labour, Material, Equipment
    type_name = Column(String(100), nullable=False) # e.g. Mason, Carpenter, Cement, Steel, Crane, Excavator
    unit = Column(String(50), default="units") # workers, bags, tons, hours, units
    standard_rate = Column(Float, default=0.0) # unit cost / wage
    available_capacity = Column(Float, default=0.0) # total on-site available per day or in stock
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="resources")
    activity_plans = relationship("ActivityResourcePlan", back_populates="resource", cascade="all, delete-orphan")


class ActivityResourcePlan(Base):
    __tablename__ = "activity_resource_plan"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    required_qty = Column(Float, default=0.0)
    allocated_qty = Column(Float, default=0.0)
    notes = Column(String(255), nullable=True)

    activity = relationship("Activity", back_populates="resource_allocations")
    resource = relationship("Resource", back_populates="activity_plans")


class DailyProgress(Base):
    __tablename__ = "daily_progress"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    report_date = Column(Date, nullable=False, index=True)
    planned_quantity = Column(Float, default=0.0)
    actual_quantity = Column(Float, default=0.0)
    workers_available = Column(Integer, default=0)
    workers_assigned = Column(Integer, default=0)
    working_hours = Column(Float, default=8.0)
    material_availability_percent = Column(Float, default=100.0)
    equipment_availability_percent = Column(Float, default=100.0)
    
    # Computed metrics
    daily_productivity = Column(Float, default=0.0)
    cumulative_productivity = Column(Float, default=0.0)
    planned_progress_percent = Column(Float, default=0.0)
    actual_progress_percent = Column(Float, default=0.0)
    progress_variance_percent = Column(Float, default=0.0)
    labour_shortage = Column(Integer, default=0)
    material_shortage = Column(Float, default=0.0)
    equipment_shortage = Column(Float, default=0.0)

    issues = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    weather = Column(String(100), default="Clear") # Clear, Rain, Extreme Heat, Storm
    validation_status = Column(String(50), default="PENDING") # PENDING, VALIDATED, REJECTED, CONDITIONAL
    validated_by = Column(String(255), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    validation_checklist_json = Column(Text, nullable=True)
    validation_notes = Column(Text, nullable=True)
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="daily_progresses")
    activity = relationship("Activity", back_populates="daily_progresses")
    reported_by = relationship("User", back_populates="progress_reports")


class SiteObservation(Base):
    __tablename__ = "site_observations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=True, index=True)
    date = Column(Date, nullable=False)
    photo_url = Column(String(500), nullable=False)
    photo_caption = Column(String(255), nullable=True)
    category = Column(String(100), default="Progress") # Site photos, Activity photos, Progress photos, Safety photos, Material photos
    description = Column(Text, nullable=True)
    verification_status = Column(String(50), default="PENDING_REVIEW") # PENDING_REVIEW, VERIFIED, REJECTED
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="site_observations")
    activity = relationship("Activity", back_populates="site_observations")


class Blocker(Base):
    __tablename__ = "blockers"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=True, index=True)
    category = Column(String(100), nullable=False) # Material Delay, Labour Shortage, Equipment Failure, Weather, Design Issue, Approval Delay, Safety Issue, Access Problem, Vendor Delay, Other
    description = Column(Text, nullable=False)
    severity = Column(String(50), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    opened_date = Column(Date, nullable=False)
    expected_resolution = Column(Date, nullable=True)
    resolved_date = Column(Date, nullable=True)
    status = Column(String(50), default="OPEN") # OPEN, IN_PROGRESS, RESOLVED
    mitigation_plan = Column(Text, nullable=True)
    hindrance_state = Column(String(50), default="ACTIVE_HINDRANCE") # ACTIVE_HINDRANCE, UNDER_REVIEW, MITIGATION_IN_PROGRESS, RESOLVED
    delay_impact_days = Column(Float, default=0.0)
    difficulty_cause = Column(String(255), nullable=True)
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="blockers")
    activity = relationship("Activity", back_populates="blockers")
    reported_by = relationship("User", back_populates="blockers_reported")


class MLActivityFeatures(Base):
    __tablename__ = "ml_activity_features"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    calculation_date = Column(Date, nullable=False)
    features_json = Column(Text, nullable=False) # JSON encoded key-values of all 22+ engineered features
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class MLDelayPrediction(Base):
    __tablename__ = "ml_delay_predictions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    delay_probability = Column(Float, nullable=False) # 0.0 to 1.0
    risk_level = Column(String(50), nullable=False) # LOW, MEDIUM, HIGH, CRITICAL
    predicted_delay_days = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.85)
    model_version = Column(String(50), default="v1.0")
    prediction_mode = Column(String(50), default="BASELINE") # BASELINE or ML
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    activity = relationship("Activity", back_populates="delay_predictions")


class MLDurationPrediction(Base):
    __tablename__ = "ml_duration_predictions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    predicted_duration = Column(Float, nullable=False)
    interval_lower = Column(Float, nullable=True)
    interval_upper = Column(Float, nullable=True)
    confidence_score = Column(Float, default=0.85)
    model_version = Column(String(50), default="v1.0")
    prediction_mode = Column(String(50), default="BASELINE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    activity = relationship("Activity", back_populates="duration_predictions")


class MLProductivityPrediction(Base):
    __tablename__ = "ml_productivity_predictions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    predicted_daily_productivity = Column(Float, nullable=False)
    unit = Column(String(50), default="units/day")
    confidence_score = Column(Float, default=0.85)
    model_version = Column(String(50), default="v1.0")
    prediction_mode = Column(String(50), default="BASELINE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    activity = relationship("Activity", back_populates="productivity_predictions")


class MLLabourPrediction(Base):
    __tablename__ = "ml_labour_predictions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    predicted_workers_required = Column(Integer, nullable=False)
    confidence_score = Column(Float, default=0.85)
    model_version = Column(String(50), default="v1.0")
    prediction_mode = Column(String(50), default="BASELINE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    activity = relationship("Activity", back_populates="labour_predictions")


class MLMaterialPrediction(Base):
    __tablename__ = "ml_material_predictions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=True, index=True)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id", ondelete="CASCADE"), nullable=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=True, index=True)
    prediction_date = Column(Date, nullable=False)
    forecast_horizon_days = Column(Integer, default=7)
    expected_consumption = Column(Float, nullable=False)
    current_stock = Column(Float, nullable=False)
    predicted_shortage = Column(Float, default=0.0)
    shortage_probability = Column(Float, default=0.0)
    model_version = Column(String(50), default="v1.0")
    prediction_mode = Column(String(50), default="BASELINE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ImpactAnalysis(Base):
    __tablename__ = "impact_analysis"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    source_activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    affected_activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    impact_days = Column(Float, default=0.0)
    impact_level = Column(String(50), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    path_depth = Column(Integer, default=1)
    reason = Column(Text, nullable=True)
    cascade_chain_json = Column(Text, nullable=True) # List of activity IDs / names in chain
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ProjectCompletionForecast(Base):
    __tablename__ = "project_completion_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)
    baseline_completion_date = Column(Date, nullable=False)
    predicted_completion_date = Column(Date, nullable=False)
    slippage_days = Column(Integer, default=0)
    schedule_health_score = Column(Float, default=100.0) # 0 to 100
    critical_path_length_days = Column(Integer, default=0)
    confidence_interval_days = Column(Integer, default=5)
    methodology_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="completion_forecasts")


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), nullable=True, index=True)
    risk_level = Column(String(50), default="HIGH") # LOW, MEDIUM, HIGH, CRITICAL
    issue_summary = Column(String(255), nullable=False)
    contributing_factors_json = Column(Text, nullable=True) # e.g. ["Labour shortage", "Low productivity"]
    ai_explanation = Column(Text, nullable=False)
    recommended_actions_json = Column(Text, nullable=False) # e.g. ["Review labour allocation", "Verify material"]
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, MODIFIED
    manager_notes = Column(Text, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="ai_recommendations")
    activity = relationship("Activity", back_populates="recommendations")


class AIManagementSummary(Base):
    __tablename__ = "ai_management_summaries"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_date = Column(Date, nullable=False)
    overall_progress = Column(Float, default=0.0)
    activities_completed = Column(Integer, default=0)
    activities_delayed = Column(Integer, default=0)
    high_risk_activities = Column(Integer, default=0)
    labour_shortage_count = Column(Integer, default=0)
    material_risk_count = Column(Integer, default=0)
    potential_slippage_days = Column(Integer, default=0)
    key_issues_json = Column(Text, nullable=True)
    risk_explanation = Column(Text, nullable=True)
    recommended_actions_json = Column(Text, nullable=True)
    next_day_priorities_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="ai_summaries")


class ActivityTemplate(Base):
    __tablename__ = "activity_templates"

    id = Column(Integer, primary_key=True, index=True)
    construction_type = Column(String(100), nullable=False, index=True)
    template_name = Column(String(255), nullable=False)
    phase = Column(String(100), nullable=False)
    work_package = Column(String(100), nullable=False)
    activity_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    sequence_order = Column(Integer, default=1)
    default_duration_days = Column(Integer, default=5)
    default_unit = Column(String(50), default="sq.m")
    default_labour_per_unit = Column(Float, default=0.1)
    is_repeatable_per_floor = Column(Boolean, default=False)
    default_predecessors_json = Column(Text, nullable=True) # names of predecessor activities in same template


class ConstructionRule(Base):
    __tablename__ = "construction_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(100), unique=True, nullable=False)
    construction_type = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    rule_description = Column(Text, nullable=False)
    parameters_json = Column(Text, nullable=False)


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False) # delay_model, duration_model, etc.
    version = Column(String(50), nullable=False)
    model_type = Column(String(100), nullable=False) # RandomForestClassifier, GradientBoostingRegressor, etc.
    file_path = Column(String(255), nullable=False)
    training_date = Column(DateTime, default=datetime.datetime.utcnow)
    metrics_json = Column(Text, nullable=False) # Accuracy, F1, ROC-AUC / MAE, RMSE, R2
    features_list_json = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False) # CREATE, UPDATE, DELETE, APPROVE, REJECT, SCHEDULE_RUN
    entity_name = Column(String(100), nullable=False) # Activity, Dependency, Schedule, Recommendation, etc.
    entity_id = Column(String(100), nullable=True)
    old_values_json = Column(Text, nullable=True)
    new_values_json = Column(Text, nullable=True)
    ip_address = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


class SiteEnvironmentalLog(Base):
    __tablename__ = "site_environmental_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_date = Column(Date, nullable=False, index=True)
    temperature_c = Column(Float, nullable=False, default=28.0)
    wind_speed_kmh = Column(Float, nullable=False, default=15.0)
    weather_condition = Column(String(100), default="Clear") # Clear, Cloudy, Rain, High Wind, Extreme Heat, Storm
    humidity_percent = Column(Float, default=55.0)
    rainfall_mm = Column(Float, default=0.0)

    # Soil report fields
    soil_type = Column(String(100), default="Sandy Loam")
    safe_bearing_capacity_kpa = Column(Float, default=200.0)
    moisture_content_percent = Column(Float, default=14.0)
    water_table_depth_m = Column(Float, default=3.2)
    compaction_percent = Column(Float, default=95.0)
    soil_report_filename = Column(String(255), nullable=True)
    soil_report_raw_text = Column(Text, nullable=True)

    # System Engineering Analysis
    overall_site_risk = Column(String(50), default="SAFE") # SAFE, MODERATE_RISK, HIGH_RISK, CRITICAL_HALT
    wind_risk_assessment = Column(Text, nullable=True)
    temperature_risk_assessment = Column(Text, nullable=True)
    soil_risk_assessment = Column(Text, nullable=True)
    affected_activities_json = Column(Text, nullable=True) # JSON of activities impacted
    recommendations_json = Column(Text, nullable=True) # JSON list of actionable guidelines
    geotechnical_details_json = Column(Text, nullable=True) # Full 25-section structured geotechnical extraction
    manager_notes = Column(Text, nullable=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="environmental_logs")


class SiteValidationRecord(Base):
    __tablename__ = "site_validations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)
    progress_id = Column(Integer, ForeignKey("daily_progress.id", ondelete="SET NULL"), nullable=True, index=True)
    validation_type = Column(String(100), default="DAILY_PROGRESS") # DAILY_PROGRESS, STAGE_MILESTONE, PRE_POUR, SOIL_CLEARANCE, SAFETY_WEATHER
    overall_decision = Column(String(50), default="APPROVED") # APPROVED, CONDITIONAL, REJECTED
    validated_by = Column(String(255), nullable=False) # Manager name / ID
    validation_notes = Column(Text, nullable=True)
    checklist_json = Column(Text, nullable=False) # Detailed checklist items JSON
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="site_validations")


class GeotechnicalReport(Base):
    """
    Uploaded geotechnical / borelog report with derived rock & soil strata,
    excavability classification, machinery selection and a detailed,
    time-phased excavation activity plan.
    """
    __tablename__ = "geotechnical_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    report_title = Column(String(255), default="Geotechnical Subsurface Investigation Report")
    filename = Column(String(255), nullable=True)
    raw_text = Column(Text, nullable=True)

    # Governing strata parameters
    primary_rock_type = Column(String(100), default="Hard Basalt")
    strata_classification = Column(String(100), default="Hard Rock / Bedrock")
    rock_quality_designation_rqd = Column(Float, default=65.0)
    unconfined_compressive_strength_mpa = Column(Float, default=85.0)
    weathering_grade = Column(String(50), default="W2 (Slightly Weathered)")
    rock_mass_rating_rmr = Column(Integer, default=68)
    excavability_class = Column(String(50), default="Class IV (Heavy Breaker / Drilling)")
    water_table_depth_m = Column(Float, default=3.5)

    # Excavation geometry & quantities
    excavation_area_sqm = Column(Float, default=1200.0)
    target_depth_m = Column(Float, default=8.0)
    total_excavation_volume_cum = Column(Float, default=9600.0)
    rock_volume_cum = Column(Float, default=6200.0)
    overburden_volume_cum = Column(Float, default=3400.0)
    estimated_total_days = Column(Integer, default=45)

    report_code = Column(String(100), nullable=True, index=True) # e.g. "GT-1001", "GT-2026-0001"
    tenant_id = Column(String(100), default="default", index=True) # Multi-tenant isolation

    # Structured analysis payloads
    strata_layers_json = Column(Text, nullable=True)
    recommended_machinery_json = Column(Text, nullable=True)
    planned_activities_json = Column(Text, nullable=True)
    hazard_controls_json = Column(Text, nullable=True)
    analysis_params_json = Column(Text, nullable=True)
    summary_json = Column(Text, nullable=True)
    intelligence_data_json = Column(Text, nullable=True)  # Complete source-grounded Geotechnical Intelligence payload

    status = Column(String(50), default="ANALYZED")  # ANALYZED, PUSHED_TO_SCHEDULE
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="geotechnical_reports")


class GeotechAPIKey(Base):
    """
    Cryptographically hashed API Key registry for external construction systems
    accessing the Geotechnical Intelligence Platform.
    """
    __tablename__ = "geotech_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(String(100), unique=True, nullable=False, index=True)  # Public identifier (e.g. key_a1b2c3d4)
    client_name = Column(String(255), nullable=False)                     # e.g. "Construction ERP"
    tenant_id = Column(String(100), nullable=False, index=True)           # Multi-tenant boundary
    key_prefix = Column(String(50), nullable=False)                       # e.g. "geo_live_a1b2...****"
    key_hash = Column(String(255), unique=True, nullable=False, index=True) # SHA-256 digest of plaintext key
    environment = Column(String(50), default="production")                # production, staging, development
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="active", index=True)             # active, revoked, expired
    permissions_json = Column(Text, nullable=False, default="[]")         # JSON list of scopes
    rate_limit_per_minute = Column(Integer, default=60)
    last_used_at = Column(DateTime, nullable=True)
    created_by = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    audit_logs = relationship("GeotechAPIAuditLog", back_populates="api_key_rel", cascade="all, delete-orphan")


class GeotechAPIAuditLog(Base):
    """
    Granular audit log of all external Geotechnical Intelligence API invocations.
    """
    __tablename__ = "geotech_api_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("geotech_api_keys.id", ondelete="CASCADE"), nullable=True, index=True)
    client_name = Column(String(255), nullable=True)
    tenant_id = Column(String(100), nullable=True, index=True)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(20), nullable=False)
    status_code = Column(Integer, nullable=False)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(255), nullable=True)
    response_time_ms = Column(Float, nullable=True)
    request_id = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    api_key_rel = relationship("GeotechAPIKey", back_populates="audit_logs")

