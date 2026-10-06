import axios from 'axios';
import {
  Project, Activity, ActivityDependency, ResourceSummary,
  DailyProgress, Blocker, SiteObservation, MLPredictionItem,
  RiskItem, ImpactAnalysisResponse, CompletionForecast,
  AIRecommendation, AIManagementSummary, DashboardStats,
  EnvironmentalAnalysis, ValidationSubmission, SiteValidationRecord,
  GeotechnicalReport, SampleGeotechReport
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/api/dashboard/stats');
    return res.data;
  },

  // Projects
  getProjects: async (): Promise<Project[]> => {
    const res = await api.get('/api/projects');
    return res.data;
  },

  getProject: async (id: number): Promise<Project> => {
    const res = await api.get(`/api/projects/${id}`);
    return res.data;
  },

  createProject: async (data: Partial<Project>): Promise<Project> => {
    const res = await api.post('/api/projects', data);
    return res.data;
  },

  updateProject: async (id: number, data: Partial<Project>): Promise<Project> => {
    const res = await api.put(`/api/projects/${id}`, data);
    return res.data;
  },

  deleteProject: async (id: number): Promise<void> => {
    await api.delete(`/api/projects/${id}`);
  },

  // Activities & Auto Plan
  getActivities: async (projectId: number, params?: any): Promise<Activity[]> => {
    const res = await api.get(`/api/projects/${projectId}/activities`, { params });
    return res.data;
  },

  createActivity: async (projectId: number, data: any): Promise<Activity> => {
    const res = await api.post(`/api/projects/${projectId}/activities`, data);
    return res.data;
  },

  updateActivity: async (id: number, data: any): Promise<Activity> => {
    const res = await api.put(`/api/activities/${id}`, data);
    return res.data;
  },

  deleteActivity: async (id: number): Promise<void> => {
    await api.delete(`/api/activities/${id}`);
  },

  validateActivity: async (
    id: number,
    data: { validation_status: 'APPROVED' | 'REJECTED' | 'PENDING'; validation_notes?: string; validated_by?: string }
  ): Promise<Activity> => {
    const res = await api.post(`/api/activities/${id}/validate`, data);
    return res.data;
  },

  bulkValidateActivities: async (
    projectId: number,
    data: { activity_ids: number[]; validation_status: 'APPROVED' | 'REJECTED' | 'PENDING'; validation_notes?: string; validated_by?: string }
  ): Promise<{ success: boolean; updated_count: number; validation_status: string; validated_by: string }> => {
    const res = await api.post(`/api/projects/${projectId}/activities/bulk-validate`, data);
    return res.data;
  },

  generateAutoPlan: async (projectId: number, data: any): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/activities/generate`, data);
    return res.data;
  },

  // Dependencies
  getDependencies: async (projectId: number): Promise<ActivityDependency[]> => {
    const res = await api.get(`/api/projects/${projectId}/dependencies`);
    return res.data;
  },

  createDependency: async (projectId: number, data: any): Promise<ActivityDependency> => {
    const res = await api.post(`/api/projects/${projectId}/dependencies`, data);
    return res.data;
  },

  deleteDependency: async (id: number): Promise<void> => {
    await api.delete(`/api/dependencies/${id}`);
  },

  // Schedule & Gantt
  getSchedule: async (projectId: number): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/schedule`);
    return res.data;
  },

  generateSchedule: async (projectId: number): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/schedule/generate`);
    return res.data;
  },

  getCriticalPath: async (projectId: number): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/critical-path`);
    return res.data;
  },

  // Resources
  getResources: async (projectId: number): Promise<ResourceSummary> => {
    const res = await api.get(`/api/projects/${projectId}/resources`);
    return res.data;
  },

  createResource: async (projectId: number, data: any): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/resources`, data);
    return res.data;
  },

  // Progress & Monitoring
  getDailyProgress: async (projectId: number): Promise<DailyProgress[]> => {
    const res = await api.get(`/api/projects/${projectId}/progress`);
    return res.data;
  },

  submitProgress: async (data: any): Promise<DailyProgress> => {
    const res = await api.post('/api/progress', data);
    return res.data;
  },

  getTodaySiteActivities: async (projectId: number): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/today-site-control`);
    return res.data;
  },

  getBlockers: async (projectId: number): Promise<Blocker[]> => {
    const res = await api.get(`/api/projects/${projectId}/blockers`);
    return res.data;
  },

  createBlocker: async (projectId: number, data: any): Promise<Blocker> => {
    const res = await api.post(`/api/projects/${projectId}/blockers`, data);
    return res.data;
  },

  updateBlocker: async (id: number, data: any): Promise<Blocker> => {
    const res = await api.put(`/api/blockers/${id}`, data);
    return res.data;
  },

  getSitePhotos: async (projectId: number): Promise<SiteObservation[]> => {
    const res = await api.get(`/api/projects/${projectId}/photos`);
    return res.data;
  },

  uploadSitePhoto: async (projectId: number, data: any): Promise<SiteObservation> => {
    const res = await api.post(`/api/projects/${projectId}/photos`, data);
    return res.data;
  },

  // ML Predictions
  runPredictions: async (projectId: number): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/predictions/run`);
    return res.data;
  },

  getPredictions: async (projectId: number): Promise<{ project_id: number; items: MLPredictionItem[] }> => {
    const res = await api.get(`/api/projects/${projectId}/predictions`);
    return res.data;
  },

  getRiskCenter: async (projectId: number): Promise<{
    project_id: number;
    risk_counts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    critical_risks: RiskItem[];
    high_risks: RiskItem[];
    medium_risks: RiskItem[];
    low_risks: RiskItem[];
  }> => {
    const res = await api.get(`/api/projects/${projectId}/risks`);
    return res.data;
  },

  // Impact Analysis
  getImpactAnalysis: async (projectId: number, activityId?: number, delayDays?: number): Promise<ImpactAnalysisResponse> => {
    const res = await api.get(`/api/projects/${projectId}/impact-analysis`, {
      params: { activity_id: activityId, delay_days: delayDays }
    });
    return res.data;
  },

  // Completion Forecast
  getCompletionForecast: async (projectId: number): Promise<CompletionForecast> => {
    const res = await api.get(`/api/projects/${projectId}/completion-forecast`);
    return res.data;
  },

  recalculateForecast: async (projectId: number): Promise<CompletionForecast> => {
    const res = await api.post(`/api/projects/${projectId}/completion-forecast/recalculate`);
    return res.data;
  },

  // AI Recommendations & Chat
  getAIRecommendations: async (projectId: number): Promise<AIRecommendation[]> => {
    const res = await api.get(`/api/projects/${projectId}/ai/recommendations`);
    return res.data;
  },

  actOnRecommendation: async (id: number, status: string, notes?: string): Promise<AIRecommendation> => {
    const res = await api.post(`/api/ai/recommendations/${id}/action`, {
      status,
      manager_notes: notes
    });
    return res.data;
  },

  getManagementSummary: async (projectId: number): Promise<AIManagementSummary> => {
    const res = await api.get(`/api/projects/${projectId}/ai/summary`);
    return res.data;
  },

  generateManagementSummary: async (projectId: number): Promise<AIManagementSummary> => {
    const res = await api.post(`/api/projects/${projectId}/ai/summary`);
    return res.data;
  },

  askAIChat: async (query: string, projectId?: number): Promise<{ query: string; response: string; suggested_questions?: string[] }> => {
    const res = await api.post('/api/ai/chat', { query, project_id: projectId });
    return res.data;
  },

  // Reports
  exportExcelUrl: (projectId: number) => `${API_BASE_URL}/api/projects/${projectId}/reports/export/excel`,

  getDailyReport: async (projectId: number, dateStr?: string): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/reports/daily`, { params: { report_date: dateStr } });
    return res.data;
  },

  getDelayReport: async (projectId: number): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/reports/delay`);
    return res.data;
  },

  // Audit Logs
  getAuditLogs: async (limit: number = 50): Promise<any[]> => {
    const res = await api.get('/api/audit-logs', { params: { limit } });
    return res.data;
  },

  // Environmental Weather & Soil Analysis
  submitEnvironmentalAnalysis: async (projectId: number, data: any): Promise<EnvironmentalAnalysis> => {
    const res = await api.post(`/api/projects/${projectId}/environmental-analysis`, data);
    return res.data;
  },

  getLatestEnvironmentalAnalysis: async (projectId: number): Promise<EnvironmentalAnalysis> => {
    const res = await api.get(`/api/projects/${projectId}/environmental-analysis/latest`);
    return res.data;
  },

  getEnvironmentalHistory: async (projectId: number): Promise<EnvironmentalAnalysis[]> => {
    const res = await api.get(`/api/projects/${projectId}/environmental-analysis/history`);
    return res.data;
  },

  parseSoilReport: async (rawText: string, filename?: string): Promise<any> => {
    const res = await api.post('/api/environmental-analysis/parse-report', { raw_text: rawText, filename });
    return res.data;
  },

  // Validation Checklists
  validateDailyProgress: async (progressId: number, data: ValidationSubmission): Promise<DailyProgress> => {
    const res = await api.post(`/api/progress/${progressId}/validate`, data);
    return res.data;
  },

  submitSiteValidation: async (projectId: number, data: ValidationSubmission): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/validations`, data);
    return res.data;
  },

  getSiteValidations: async (projectId: number): Promise<SiteValidationRecord[]> => {
    const res = await api.get(`/api/projects/${projectId}/validations`);
    return res.data;
  },

  // Geotechnical & Rock Excavation Intelligence
  uploadGeotechnicalReport: async (projectId: number, formData: FormData): Promise<GeotechnicalReport> => {
    const res = await api.post(`/api/projects/${projectId}/geotechnical/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  analyzeGeotechnicalText: async (projectId: number, data: any): Promise<GeotechnicalReport> => {
    const res = await api.post(`/api/projects/${projectId}/geotechnical/analyze-text`, data);
    return res.data;
  },

  getGeotechnicalReports: async (projectId: number): Promise<GeotechnicalReport[]> => {
    const res = await api.get(`/api/projects/${projectId}/geotechnical/reports`);
    return res.data;
  },

  getGeotechnicalReport: async (projectId: number, reportId: number): Promise<GeotechnicalReport> => {
    const res = await api.get(`/api/projects/${projectId}/geotechnical/reports/${reportId}`);
    return res.data;
  },

  deleteGeotechnicalReport: async (projectId: number, reportId: number): Promise<any> => {
    const res = await api.delete(`/api/projects/${projectId}/geotechnical/reports/${reportId}`);
    return res.data;
  },

  pushGeotechnicalToSchedule: async (projectId: number, reportId: number, options?: { replace_existing?: boolean; cost_multiplier?: number }): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/geotechnical/reports/${reportId}/push-to-schedule`, options || {});
    return res.data;
  },

  getGeotechnicalSampleReports: async (projectId: number): Promise<SampleGeotechReport[]> => {
    const res = await api.get(`/api/projects/${projectId}/geotechnical/sample-reports`);
    return res.data;
  }
};

