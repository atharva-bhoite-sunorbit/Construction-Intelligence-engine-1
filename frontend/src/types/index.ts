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
  validation_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
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
  created_at: string;
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
  delay_days: number;
  affected_activities: Array<{
    affected_activity_id: number;
    affected_activity_name: string;
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
  history?: Array<{
    date: string;
    slippage_days: number;
    health_score: number;
  }>;
}

export interface AIRecommendation {
  id: number;
  project_id: number;
  activity_id?: number;
  activity_name?: string;
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

