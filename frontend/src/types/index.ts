export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  code: string;
  construction_type: string;
  location: string;
  num_floors: number;
  num_towers: number;
  built_up_area: number;
  plot_area?: number;
  planned_start_date: string;
  target_completion_date: string;
  project_manager?: string;
  site_manager?: string;
  contractor?: string;
  description?: string;
  stage_engineers?: Record<string, string[]>;
  status: string;
  created_at: string;
  updated_at: string;
  total_activities?: number;
  completed_activities?: number;
  delayed_activities?: number;
  overall_progress?: number;
}

export interface Activity {
  id: number;
  project_id: number;
  name: string;
  code?: string;
  phase: string;
  work_package?: string;
  category?: string;
  subcategory?: string;
  building: string;
  tower: string;
  floor: number;
  zone: string;
  quantity: number;
  unit: string;
  planned_duration: number;
  actual_duration?: number;
  start_date: string;
  end_date: string;
  baseline_task_id?: number | null;
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  baseline_source_file?: string | null;
  actual_start_date?: string;
  actual_end_date?: string;
  required_labour: number;
  required_material?: string;
  required_equipment?: string;
  priority: string;
  is_critical: boolean;
  status: string;
  progress_percent: number;
  early_start: number;
  early_finish: number;
  late_start: number;
  late_finish: number;
  total_float: number;
  free_float: number;
  sort_order: number;
  delay_risk_score?: number;
  predicted_delay_days?: number;
  risk_level?: string;
  assigned_role?: 'Site Engineer' | 'Site Manager' | 'Admin' | 'Project Manager' | string;
  validation_status?: 'PENDING' | 'AWAITING_ADMIN_VERIFICATION' | 'AWAITING_PM_VERIFICATION' | 'APPROVED' | 'RECORDED' | 'REJECTED';
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  stage1_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  stage1_validated_by?: string;
  stage1_validated_at?: string;
  stage1_notes?: string;
  pm_verification_status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  pm_verified_by?: string;
  pm_verified_at?: string;
  pm_verification_notes?: string;
  final_recorded?: boolean;
}

export interface GovernanceRoleStats {
  role: string;
  total: number;
  pending_validation: number;
  awaiting_verification?: number;
  awaiting_pm_verification: number;
  awaiting_admin_verification?: number;
  final_recorded: number;
  rejected: number;
  recorded_percentage: number;
}

export interface GovernanceRecentItem {
  id: number;
  name: string;
  code?: string;
  floor?: number;
  tower?: string;
  phase?: string;
  assigned_role: string;
  stage1_status?: string;
  stage1_validated_by?: string;
  stage1_validated_at?: string;
  pm_verification_status?: string;
  pm_verified_by?: string;
  pm_verified_at?: string;
  final_recorded: boolean;
  validation_status: string;
  notes?: string;
}

export interface GovernanceSummary {
  project_id: number;
  project_name: string;
  total_activities: number;
  final_recorded_count: number;
  recorded_percentage: number;
  awaiting_verification_count?: number;
  awaiting_pm_count: number;
  awaiting_admin_count?: number;
  pending_stage1_count: number;
  rejected_count: number;
  roles: {
    'Site Engineer'?: GovernanceRoleStats;
    'Site Manager': GovernanceRoleStats;
    'Admin': GovernanceRoleStats;
    'Project Manager': GovernanceRoleStats;
    [key: string]: GovernanceRoleStats | undefined;
  };
  recent_verifications: GovernanceRecentItem[];
}

export interface ActivityDependency {
  id: number;
  project_id: number;
  predecessor_id: number;
  successor_id: number;
  dependency_type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  predecessor_name?: string;
  successor_name?: string;
}

export interface ResourceItem {
  id: number;
  project_id: number;
  category: string;
  type_name: string;
  unit: string;
  standard_rate: number;
  available_capacity: number;
  total_required: number;
  total_allocated: number;
  shortage: number;
  utilization_percent: number;
  notes?: string;
}

export interface ResourceSummary {
  project_id: number;
  totals: {
    Labour: { required: number; available: number; allocated: number; shortage: number };
    Materials: { required: number; available: number; allocated: number; shortage: number };
    Equipment: { required: number; available: number; allocated: number; shortage: number };
  };
  resources: {
    Labour: ResourceItem[];
    Materials: ResourceItem[];
    Equipment: ResourceItem[];
  };
}

export interface DailyProgress {
  id: number;
  project_id: number;
  activity_id: number;
  activity_name?: string;
  report_date: string;
  planned_quantity: number;
  actual_quantity: number;
  workers_available: number;
  workers_assigned: number;
  working_hours: number;
  material_availability_percent: number;
  equipment_availability_percent: number;
  daily_productivity: number;
  cumulative_productivity: number;
  planned_progress_percent: number;
  actual_progress_percent: number;
  progress_variance_percent: number;
  labour_shortage: number;
  material_shortage: number;
  equipment_shortage: number;
  issues?: string;
  remarks?: string;
  weather?: string;
  validation_status?: 'PENDING' | 'APPROVED' | 'CONDITIONAL' | 'REJECTED' | 'VALIDATED';
  validated_by?: string;
  validated_at?: string;
  validation_checklist_json?: string;
  validation_notes?: string;
  created_at: string;
}

export interface EnvironmentalAnalysis {
  id: number;
  project_id: number;
  recorded_date: string;
  temperature_c: number;
  wind_speed_kmh: number;
  weather_condition: string;
  humidity_percent: number;
  rainfall_mm: number;
  weather_report_filename?: string;
  soil_type: string;
  safe_bearing_capacity_kpa: number;
  moisture_content_percent: number;
  water_table_depth_m: number;
  compaction_percent: number;
  soil_report_filename?: string;
  overall_site_risk: 'SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CRITICAL_HALT';
  wind_risk_assessment?: string;
  temperature_risk_assessment?: string;
  soil_risk_assessment?: string;
  affected_activities: Array<{
    activity_id: number;
    activity_name: string;
    code?: string;
    floor: number;
    tower: string;
    status: string;
    impact_level: 'HALTED' | 'RESTRICTED' | 'CAUTION' | 'NORMAL';
    hazard_tag: string;
    action_required: string;
  }>;
  recommendations: string[];
  geotechnical_details?: any;
  manager_notes?: string;
  created_at: string;
}

export interface ValidationChecklistItem {
  category: string;
  item: string;
  status: 'PASS' | 'CONDITIONAL' | 'FAIL';
  comment?: string;
}

export interface ValidationSubmission {
  overall_decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  validated_by: string;
  validation_notes?: string;
  checklist_items: ValidationChecklistItem[];
  validation_type?: string;
  activity_id?: number;
}

export interface SiteValidationRecord {
  id: number;
  project_id: number;
  activity_id?: number;
  validation_type: string;
  overall_decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  validated_by: string;
  validation_notes?: string;
  checklist: ValidationChecklistItem[];
  created_at: string;
}

export interface Blocker {
  id: number;
  project_id: number;
  activity_id?: number;
  activity_name?: string;
  category: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  opened_date: string;
  expected_resolution?: string;
  resolved_date?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  mitigation_plan?: string;
  hindrance_state?: 'ACTIVE_HINDRANCE' | 'UNDER_REVIEW' | 'MITIGATION_IN_PROGRESS' | 'RESOLVED';
  delay_impact_days?: number;
  difficulty_cause?: string;
  created_at: string;
}

export interface HindranceSubmissionReceipt {
  id: number;
  project_id: number;
  status: string;
  created_at: string;
  message: string;
}

export interface SiteObservation {
  id: number;
  project_id: number;
  activity_id?: number;
  activity_name?: string;
  date: string;
  photo_url: string;
  photo_caption?: string;
  category: string;
  description?: string;
  verification_status: string;
  created_at: string;
}

export interface MLPredictionItem {
  activity_id: number;
  activity_name: string;
  code?: string;
  floor: number;
  tower: string;
  status: string;
  is_critical: boolean;
  delay_probability: number;
  risk_level: string;
  predicted_delay_days: number;
  planned_duration: number;
  predicted_duration: number;
  duration_interval: [number, number];
  predicted_productivity: number;
  predicted_workers: number;
  prediction_mode: string;
}

export interface RiskItem {
  prediction_id: number;
  activity_id: number;
  activity_name: string;
  floor: number;
  tower: string;
  delay_probability: number;
  risk_level: string;
  predicted_delay_days: number;
  is_critical_path: boolean;
  total_float: number;
  status: string;
  reason: string;
  potential_impact: string;
  recommended_investigation: string;
}

export interface ImpactAnalysisResponse {
  source_activity_id: number;
  source_activity_name: string;
  source_activity_code?: string | null;
  source_baseline_task_id?: number | null;
  source_phase?: string | null;
  source_work_package?: string | null;
  source_baseline_start_date?: string | null;
  source_baseline_end_date?: string | null;
  source_live_start_date?: string | null;
  source_live_end_date?: string | null;
  baseline_completion_date?: string | null;
  projected_completion_date?: string | null;
  delay_days: number;
  affected_activities: Array<{
    affected_activity_id: number;
    affected_activity_name: string;
    activity_code?: string | null;
    baseline_task_id?: number | null;
    phase?: string | null;
    work_package?: string | null;
    tower?: string | null;
    floor?: number | null;
    baseline_start_date?: string | null;
    baseline_end_date?: string | null;
    live_start_date?: string | null;
    live_end_date?: string | null;
    impacted_start_date?: string | null;
    impacted_end_date?: string | null;
    date_basis?: string | null;
    impact_days: number;
    impact_level: string;
    path_depth: number;
    reason: string;
    cascade_chain: string[];
  }>;
  project_completion_slippage_days: number;
  critical_path_affected: boolean;
}

export interface CompletionForecast {
  project_id: number;
  forecast_date: string;
  baseline_completion_date: string;
  predicted_completion_date: string;
  slippage_days: number;
  schedule_health_score: number;
  critical_path_length_days: number;
  confidence_interval_days: number;
  methodology_notes: string;
  prediction_mode?: string;
  accuracy_metrics?: {
    model_accuracy: number;
    roc_auc: number;
    r_squared: number;
    mae_days: number;
    confidence_score: number;
    validation_samples: number;
    cross_val_score: number;
    model_type: string;
  };
  duration_metrics?: {
    total_planned_months: number;
    elapsed_months: number;
    remaining_months: number;
    forecast_total_months: number;
    variance_months: number;
    total_planned_days: number;
    elapsed_days: number;
    remaining_days: number;
    forecast_total_days: number;
    progress_time_percent: number;
  };
  driving_activities?: Array<{
    id: number;
    name: string;
    code?: string;
    tower?: string;
    floor?: number;
    work_package?: string;
    baseline_finish: string;
    is_critical: boolean;
    predicted_delay_days: number;
    delay_probability: number;
  }>;
  history?: Array<{
    date: string;
    slippage_days: number;
    health_score: number;
  }>;
}

export interface BriefRequirements {
  work_scope: string;
  technical_specifications: string;
  material_requirements: string;
  equipment_requirements: string;
  safety_and_quality: string;
}

export interface LabourRequirement {
  total_headcount: number;
  trades: {
    masons?: number;
    bar_benders?: number;
    carpenters?: number;
    helpers?: number;
    operators?: number;
    supervisors?: number;
    electricians?: number;
    [key: string]: number | undefined;
  };
  shift: string;
  muster_status: string;
}

export interface DailyTaskActivity {
  id: number;
  name: string;
  code?: string;
  phase: string;
  work_package?: string;
  tower: string;
  floor: number;
  zone: string;
  start_date: string;
  end_date: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  status: string;
  progress_percent: number;
  planned_progress_percent: number;
  priority: string;
  is_critical: boolean;
  total_float: number;
  delay_risk_score: number;
  predicted_delay_days: number;
  risk_level: string;
  category: 'IN_CONTROL' | 'RISKY' | 'DELAYED';
  risk_factors: string[];
  blockers_count: number;
  blockers: Array<{
    id: number;
    title: string;
    category: string;
    severity: string;
    status: string;
  }>;
  brief_requirements: BriefRequirements;
  labour_requirement: LabourRequirement;
  assigned_role?: string;
  stage1_status?: string;
  pm_verification_status?: string;
  final_recorded?: boolean;
}

export interface DailyTasksResponse {
  project_id: number;
  project_name: string;
  project_code: string;
  target_date: string;
  total_activities: number;
  total_labour_required: number;
  total_equipment_deployed: number;
  in_control_count: number;
  risky_count: number;
  delayed_count: number;
  is_upcoming_view?: boolean;
  notice_message?: string | null;
  is_project_completed?: boolean;
  completion_date?: string | null;
  activities: DailyTaskActivity[];
}

export interface AIRecommendation {
  id: number;
  project_id: number;
  activity_id?: number;
  activity_name?: string;
  baseline_task_id?: number | null;
  phase?: string | null;
  work_package?: string | null;
  tower?: string | null;
  floor?: number | null;
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  live_start_date?: string | null;
  live_end_date?: string | null;
  baseline_variance_days?: number | null;
  risk_level: string;
  issue_summary: string;
  contributing_factors: string[];
  ai_explanation: string;
  recommended_actions: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
  manager_notes?: string;
  created_at: string;
}

export interface AIManagementSummary {
  id: number;
  project_id: number;
  summary_date: string;
  overall_progress: number;
  activities_completed: number;
  activities_delayed: number;
  high_risk_activities: number;
  labour_shortage_count: number;
  material_risk_count: number;
  potential_slippage_days: number;
  key_issues: string[];
  risk_explanation: string;
  recommended_actions: string[];
  next_day_priorities: string[];
  created_at: string;
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  overall_progress: number;
  delayed_activities: number;
  high_risk_activities: number;
  total_labour_available: number;
  critical_path_activities: number;
  total_blockers_open: number;
}

export interface StrataLayer {
  material_key: string;
  material: string;
  category: string;
  is_rock: boolean;
  description: string;
  report_description?: string;
  color: string;
  top_m: number;
  bottom_m: number;
  thickness_m: number;
  ucs_mpa?: number;
  ucs_source?: string;
  rqd_pct?: number;
  rqd_source?: string;
  core_recovery_pct?: number;
  spt_n?: number;
  weathering_grade?: string;
  bulking_factor: number;
  excavability_class_num: number;
  excavability_class: string;
  excavation_method: string;
  bank_volume_cum?: number;
  loose_volume_cum?: number;
  below_water_table?: boolean;
  recommended_machinery?: string[];
}

export interface MachineryRecommendation {
  name: string;
  models: string;
  spec: string;
  role: string;
  key: string;
  count: number;
  first_day: number;
  last_day: number;
  machine_hours: number;
  activities: string[];
  deployment_days: number;
  why: string;
}

export interface PlannedActivity {
  code: string;
  name: string;
  phase: string;
  duration_days: number;
  start_day: number;
  end_day: number;
  start_date: string;
  end_date: string;
  quantity: number;
  unit: string;
  daily_output: string | number;
  method: string;
  equipment: Array<{ key: string; name: string; models: string; count: number }>;
  crew: Array<{ role: string; count: number }>;
  predecessors: any[];
  is_critical: boolean;
  total_float: number;
  machine_hours: number;
  man_days: number;
}

export interface HazardControl {
  hazard: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  control: string;
}

export interface GeotechnicalSummary {
  total_working_days: number;
  calendar_days: number;
  start_date: string;
  finish_date: string;
  excavation_window_days: number;
  total_bank_volume_cum: number;
  rock_bank_volume_cum: number;
  soil_bank_volume_cum: number;
  total_loose_volume_cum: number;
  rock_share_pct: number;
  tipper_trips: number;
  governing_class: string;
  governing_class_num: number;
  governing_material: string;
  blasting_required: boolean;
  dewatering_required: boolean;
  rmr?: number;
  rmr_class?: string;
  critical_path: string[];
  phases: Array<{ phase: string; start_day: number; end_day: number; activities: number }>;
  total_machine_hours: number;
  total_man_days: number;
  peak_fleet_size: number;
  assumptions: string[];
}

export interface GeotechnicalReport {
  id: number;
  project_id: number;
  report_title: string;
  filename?: string;
  primary_rock_type: string;
  strata_classification: string;
  rock_quality_designation_rqd?: number;
  unconfined_compressive_strength_mpa?: number;
  weathering_grade?: string;
  rock_mass_rating_rmr?: number;
  excavability_class: string;
  water_table_depth_m?: number;
  excavation_area_sqm: number;
  target_depth_m: number;
  total_excavation_volume_cum: number;
  rock_volume_cum: number;
  overburden_volume_cum: number;
  estimated_total_days: number;
  strata_layers: StrataLayer[];
  rock_types: StrataLayer[];
  recommended_machinery: MachineryRecommendation[];
  planned_activities: PlannedActivity[];
  hazard_controls: HazardControl[];
  summary: GeotechnicalSummary;
  status: 'ANALYZED' | 'PUSHED_TO_SCHEDULE';
  created_at: string;
}

export interface SampleGeotechReport {
  id: string;
  title: string;
  description: string;
  default_depth: number;
  default_area: number;
  water_table: number;
  text: string;
}

export interface SourceGroundedField {
  value: any;
  display: string;
  unit?: string;
  status: 'FOUND' | 'MISSING' | 'REQUIRES_DATA';
  source_type?: 'REPORT' | 'CALCULATED' | 'AI_INTERPRETATION' | 'AI_RECOMMENDATION' | 'USER_ENTERED' | 'REQUIRES_DATA' | null;
  source_page?: number | null;
  source_section?: string | null;
  source_text?: string | null;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  method?: string;
  note?: string;
  formula?: string;
}

export interface BoreholeRecord {
  borehole_id: string;
  ground_level: number;
  cwr_depth: number;
  hard_rock_depth: number;
  termination_depth: number;
  groundwater_depth: string;
  layer_sequence: string[];
  layers: Array<{
    layer_index: number;
    layer_name: string;
    top_depth: number;
    bottom_depth: number;
    thickness: number;
    description?: string;
    material_type: string;
    spt_n?: string;
    core_recovery?: string;
    rqd?: string;
    ucs?: string;
    color?: string;
    is_rock: boolean;
  }>;
  source_reference: string;
  confidence: string;
}

export interface GeotechnicalRiskRecord {
  risk_title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  reason: string;
  source: string;
  source_type: string;
  recommended_action: string;
  flag?: string;
  potential_impact?: string;
  affected_activities?: string[];
  schedule_impact?: string;
  cost_impact?: string;
}

export interface GeotechnicalAuditRecord {
  audit_id: string;
  section: string;
  parameter: string;
  extracted_value: string;
  source_type: string;
  source_page?: number | null;
  source_section?: string | null;
  source_text_snippet?: string | null;
  confidence: string;
  extraction_method: string;
  timestamp: string;
}

export interface GeotechnicalPipelineData {
  foundation_validation?: {
    proposed_floors: number;
    building_type: string;
    estimated_contact_pressure_kpa: number;
    allowable_bearing_pressure_kpa: number;
    validation_verdict: string;
    is_bearing_adequate: boolean;
    recommended_foundation_system: string;
    rock_socket_depth_m?: number | null;
    applicable_code?: string;
  };
  geotechnical_boq_items?: Array<{
    item_code: string;
    category: string;
    description: string;
    unit: string;
    quantity: number;
    engineering_rationale: string;
  }>;
  construction_sequence?: Array<{
    step: number;
    activity_name: string;
    phase: string;
    duration_days: number;
    predecessor: string;
    affected_layer: string;
    critical_note: string;
  }>;
  delay_prediction?: {
    delay_risk_level: string;
    recommended_schedule_buffer_days: number;
    delay_risk_factors: string[];
    mitigation_plan: string;
  };
  labour_material_estimation?: {
    total_excavation_volume_cum?: number;
    soil_volume_cum?: number;
    rock_volume_cum?: number;
    material_takeoff?: {
      pcc_m15_blinding_cum?: number;
      raft_m25_m30_concrete_cum?: number;
      tmt_rebar_steel_metric_tonnes?: number;
      waterproofing_membrane_sqm?: number;
      select_granular_backfill_cum?: number;
    };
    machinery_fleet?: Array<{
      equipment_name: string;
      quantity: number;
      capacity?: string;
      shifts_required?: number;
      role?: string;
    }>;
    labour_crew_breakdown?: Array<{
      trade: string;
      mandays: number;
      crew_size?: number;
    }>;
    estimated_diesel_litres?: number;
  };
}

export interface GeotechnicalIntelligenceDoc {
  report_id: string;
  filename: string;
  created_at: string;
  project_id: number;
  project_information: Record<string, SourceGroundedField>;
  investigation_information: Record<string, SourceGroundedField>;
  boreholes: BoreholeRecord[];
  stratigraphy: Array<{
    layer_title: string;
    layer_name: string;
    top_depth: number;
    bottom_depth: number;
    thickness: number;
    description: string;
    material_type: string;
    source_page: number;
    source_text: string;
    confidence: string;
  }>;
  soil_analysis: Record<string, SourceGroundedField>;
  rock_analysis: Record<string, SourceGroundedField>;
  groundwater_analysis: Record<string, SourceGroundedField>;
  foundation_recommendations: Record<string, SourceGroundedField>;
  excavation_analysis: Record<string, SourceGroundedField>;
  concrete_protection: Record<string, SourceGroundedField>;
  laboratory_results: Array<{
    test_category: string;
    sample_id: string;
    depth_m: string;
    parameters: Array<{ name: string; value: string; unit: string; limit: string }>;
    source_page: number;
    confidence: string;
  }>;
  report_calculations: Array<{
    calculation_name: string;
    formula: string;
    input_parameters: Record<string, string>;
    result: string;
    source_page: number;
    source_section: string;
    confidence: string;
  }>;
  validation: {
    is_valid: boolean;
    status: string;
    passed_checks: string[];
    warnings: Array<{ check: string; detail: string }>;
    missing_items: Array<{ field: string; reason: string }>;
    validation_timestamp: string;
  };
  risks: GeotechnicalRiskRecord[];
  missing_data: Array<{
    parameter: string;
    category: string;
    status: string;
    why_needed: string;
    recommended_source: string;
    action_type: string;
  }>;
  audit_trail: GeotechnicalAuditRecord[];
  // Enhanced 16 Parameter Categories & 5 Layers
  sixteen_parameters?: Record<string, any>;
  five_intelligence_layers?: Record<string, any>;
  spt_data?: Array<{
    borehole: string;
    borehole_id?: string;
    depth_m: number;
    sample_id: string;
    raw_blows: string;
    seating_blows: number;
    test_interval: string;
    spt_n: number;
    corrected_n?: number;
    n60?: number;
    soil_layer: string;
    relative_density: string;
  }>;
  soil_classification?: Record<string, SourceGroundedField>;
  engineering_properties?: Record<string, SourceGroundedField>;
  bearing_capacity?: Record<string, any>;
  settlement_parameters?: Record<string, SourceGroundedField>;
  seismic_parameters?: Record<string, any>;
  liquefaction_assessment?: Record<string, any>;
  chemical_tests?: Record<string, SourceGroundedField>;
  construction_recommendations?: Record<string, SourceGroundedField>;
  standard_json?: any;
  pipeline_intelligence?: GeotechnicalPipelineData;
  strata_layers?: StrataLayer[];
  recommended_machinery?: MachineryRecommendation[];
  planned_activities?: PlannedActivity[];
  summary?: GeotechnicalSummary;
  rock_types?: any[];
}

// ---- Execution tasks (simple workflow) ----
export type TaskStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export type TaskActionName = 'submit' | 'approve' | 'reject' | 'start' | 'block' | 'unblock' | 'complete';

export interface Task {
  id: number;
  project_id: number;
  activity_id: number | null;
  activity_code: string | null;
  activity_name: string | null;
  tower: string;
  title: string;
  description: string | null;
  is_unplanned: boolean;
  unplanned_reason: string | null;
  status: TaskStatus;
  planned_days: number;
  progress_percent: number;
  assigned_to: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  rejection_reason: string | null;
  blocked_note: string | null;
  created_at: string | null;
  allowed_actions: TaskActionName[];
  activity_progress_percent: number | null;
  work_type: string | null;
  checks_total: number;
  checks_done: number;
  unmet_checks: string[];
  sequence_step: number | null;
  waiting_on: string[];
}

export interface TaskCheck {
  id: number;
  name: string;
  description: string | null;
  mandatory: boolean;
  passed: boolean;
  waived: boolean;
  waiver_reason: string | null;
  note: string | null;
  step: number;
  locked: boolean;
  locked_by: string | null;
}

export interface DailyChecklistStep {
  id: number;
  step: number;
  name: string;
  description: string | null;
  done: boolean;
  done_at: string | null;
  locked: boolean;
  locked_by: string | null;
}

export interface DailyChecklist {
  role: string | null;
  day: string;
  editable: boolean;
  done: number;
  total: number;
  items: DailyChecklistStep[];
}

export interface LookaheadStop { kind: 'problem' | 'on_hold' | 'waiting'; text: string; problem_id?: number; task_id?: number }

export interface LookaheadItem {
  activity_id: number;
  name: string;
  tower: string | null;
  state: 'IN_PROGRESS' | 'READY' | 'WAITING';
  progress_percent: number;
  start_date: string | null;
  end_date: string | null;
  work_type: string | null;
  late: boolean;
  starts: boolean;
  finishes: boolean;
  tasks: { id: number; title: string; status: string }[];
  stopped_by: LookaheadStop[];
  notes: string[];
}

export interface PlanBOption {
  kind: 'boost' | 'pull_forward';
  activity_id: number;
  name: string;
  tower: string | null;
  work_type: string | null;
  start_date: string | null;
  end_date: string | null;
  days_early: number;
  open_task_id: number | null;
  why: string;
}

export interface Lookahead {
  today: string;
  days: { date: string; is_today: boolean; items: LookaheadItem[] }[];
  stopped: number;
  plan_b: PlanBOption[];
  summary: { today_items: number; late: number; running: number };
}

export interface NewTaskInput {
  title: string;
  planned_days: number;
  assigned_to?: string;
  activity_id?: number;
  is_unplanned?: boolean;
  unplanned_reason?: string;
  tower?: string;
}

// ---- Problems (blockers with PM-confirmed delay) ----
export type ImpactStatus = 'NOT_ASSESSED' | 'PROPOSED' | 'CONFIRMED' | 'NO_IMPACT';

export interface Problem {
  id: number;
  project_id: number;
  task_id: number | null;
  task_title: string | null;
  activity_id: number | null;
  activity_name: string | null;
  tower: string | null;
  category: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  owner: string | null;
  opened_date: string;
  expected_resolution: string | null;
  resolved_date: string | null;
  status: 'OPEN' | 'RESOLVED' | string;
  days_open: number;
  resolution_note: string | null;
  reported_by_name: string | null;
  impact_status: ImpactStatus;
  needs_review: boolean;
  proposed_delay_days: number | null;
  proposed_project_delay_days: number | null;
  proposed_on_critical_path: boolean | null;
  proposal_note: string | null;
  confirmed_delay_days: number | null;
  confirmed_project_delay_days: number | null;
  impact_note: string | null;
  impact_decided_by_name: string | null;
  impact_decided_at: string | null;
  estimate_changed: boolean;
}

export interface NewProblemInput {
  category: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  owner?: string;
  expected_resolution?: string;
  task_id?: number;
  activity_id?: number;
}

export interface DelaySummary {
  open_problems: number;
  waiting_for_review: number;
  confirmed_problems: number;
  confirmed_activity_delay_days: number;
  largest_confirmed_project_delay_days: number;
  unconfirmed: { id: number; category: string; proposed_project_delay_days: number | null }[];
  by_category: { category: string; problems: number; open: number; confirmed_delay_days: number }[];
}

// ---- Plan sequence and portfolio ----
export type SequenceState = 'DONE' | 'IN_PROGRESS' | 'READY' | 'WAITING';

export interface SequenceItem {
  activity_id: number;
  step: number;
  name: string;
  tower: string | null;
  state: SequenceState;
  waiting_on: string[];
  predecessors: { id: number; name: string; type: string; lag_days: number; done: boolean }[];
  status: string;
  progress_percent: number;
  start_date: string | null;
  end_date: string | null;
  planned_duration: number | null;
}

export interface PortfolioProject {
  id: number;
  name: string;
  code: string;
  location: string | null;
  status: string;
  planned_start_date: string | null;
  target_completion_date: string | null;
  activities: number;
  progress_percent: number;
  late_activities: number;
  open_problems: number;
  problems_waiting_for_review: number;
  largest_confirmed_project_delay_days: number;
  pending_approvals: number;
  cover_image_url: string | null;
  current_work: { name: string; towers: string[] }[];
  expected_finish: string | null;
}

// ---- Notifications, attention inbox, activity detail, digest ----
export interface AppNotification {
  id: number;
  project_id: number | null;
  project_name?: string | null;
  kind: string;
  title: string;
  body: string | null;
  entity_type: 'task' | 'problem' | 'activity' | null;
  entity_id: number | null;
  created_at: string;
  read: boolean;
}

export interface NotificationList {
  unread_count: number;
  items: AppNotification[];
}

export interface AttentionItem {
  kind: 'APPROVAL' | 'PROBLEM_REVIEW' | 'BLOCKED_TASK' | 'LATE_ACTIVITY' | 'SHOULD_HAVE_STARTED';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  days: number;
  tab: string;
  entity_type: 'task' | 'problem' | 'activity';
  entity_id: number;
  tower: string | null;
}

export interface FocusTarget {
  type: 'task' | 'problem' | 'activity';
  id: number;
  nonce: number;
}

export interface ActivityDetail {
  id: number;
  name: string;
  tower: string | null;
  phase: string | null;
  work_package: string | null;
  status: string;
  progress_percent: number;
  planned_duration: number | null;
  start_date: string | null;
  end_date: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  finish_variance_days: number | null;
  is_critical: boolean;
  total_float: number | null;
  step: number;
  state: SequenceState;
  waiting_on: string[];
  predecessors: { id: number; name: string; type: string; lag_days: number; done: boolean }[];
  successors: { id: number; name: string; type: string; lag_days: number; state: SequenceState; tower: string | null }[];
  task_days_planned: number;
  tasks: { id: number; title: string; status: string; progress_percent: number; planned_days: number; is_unplanned: boolean }[];
  problems: {
    id: number; category: string; status: string; impact_status: string; description: string; opened_date: string;
    resolved_date: string | null; confirmed_delay_days: number | null; confirmed_project_delay_days: number | null; proposed_delay_days: number | null;
  }[];
}

export interface Digest {
  days: number;
  since: string;
  until: string;
  tasks_finished: number;
  tasks_started: number;
  activities_finished: number;
  approvals_decided: number;
  problems_reported: number;
  problems_resolved: number;
  delay_confirmed_this_period_days: number;
  recent_finished: { title: string; tower: string; date: string }[];
  planned_finish: string | null;
  expected_finish: string | null;
  confirmed_project_delay_days: number;
}

// ---- 3D building view and portfolio cards ----
export interface BuildingLevel {
  index: number;
  kind: 'foundation' | 'stilt' | 'podium' | 'floor' | 'terrace' | 'above';
  label: string;
  progress_percent: number;
  state: 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED';
  late: boolean;
  activity_ids: number[];
  start_date: string;
  end_date: string;
}

export interface BuildingWing {
  name: string;
  footprint: [number, number][];
  podium_footprint: [number, number][];
  floor_height: number;
  levels: BuildingLevel[];
  summary: { levels: number; done: number; running: number; progress_percent: number };
}

export interface BuildingData {
  source: 'drawing' | 'placeholder' | 'none';
  unit: string;
  note?: string;
  wings: BuildingWing[];
}
