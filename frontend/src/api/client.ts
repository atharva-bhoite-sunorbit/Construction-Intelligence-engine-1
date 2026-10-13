import axios from 'axios';
import {
  User, Project, Activity, ActivityDependency, ResourceSummary,
  DailyProgress, Blocker, HindranceSubmissionReceipt, SiteObservation, MLPredictionItem,
  RiskItem, ImpactAnalysisResponse, CompletionForecast,
  AIRecommendation, AIManagementSummary, DashboardStats,
  EnvironmentalAnalysis, ValidationSubmission, SiteValidationRecord,
  GeotechnicalReport, SampleGeotechReport, GovernanceSummary,
  Task, TaskCheck, TaskActionName, Lookahead, DailyChecklist, NewTaskInput, Problem, NewProblemInput, DelaySummary,
  SequenceItem, PortfolioProject, NotificationList, AppNotification, AttentionItem, ActivityDetail, Digest, BuildingData
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const savedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

export const setAuthToken = (token?: string) => {
  if (token) {
    localStorage.setItem('auth_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
  }
};

// A 401 on any call except the login endpoints means the session is gone: drop the token and tell the app.
export const AUTH_EXPIRED_EVENT = 'auth:expired';
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? '';
    const isLoginCall = url.includes('/api/auth/login') || url.includes('/api/auth/token');
    if (error?.response?.status === 401 && !isLoginCall) {
      setAuthToken(undefined);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Authentication & Session
  login: async (email: string, password: string): Promise<{ access_token: string; token_type: string; user: User }> => {
    const res = await api.post('/api/auth/login', { email, password });
    if (res.data?.access_token) {
      setAuthToken(res.data.access_token);
    }
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get('/api/auth/me');
    return res.data;
  },

  getDemoRoles: async (): Promise<{ key: string; label: string; description: string }[]> => {
    try {
      const res = await api.get('/api/auth/demo-roles');
      return res.data;
    } catch {
      return [];
    }
  },

  demoLogin: async (key: string): Promise<{ access_token: string; token_type: string; user: User }> => {
    const res = await api.post('/api/auth/demo-login', { key });
    if (res.data?.access_token) {
      setAuthToken(res.data.access_token);
    }
    return res.data;
  },

  logout: () => {
    setAuthToken(undefined);
  },

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

  getActivitiesByDate: async (projectId: number, targetDate?: string): Promise<any> => {
    const res = await api.get(`/api/projects/${projectId}/activities/by-date`, {
      params: targetDate ? { target_date: targetDate } : {},
    });
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
    data: {
      validation_status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'VERIFIED' | string;
      validation_notes?: string;
      validated_by?: string;
      validator_role?: string;
      action_type?: string;
    }
  ): Promise<Activity> => {
    const res = await api.post(`/api/activities/${id}/validate`, data);
    return res.data;
  },

  bulkValidateActivities: async (
    projectId: number,
    data: {
      activity_ids: number[];
      validation_status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'VERIFIED' | string;
      validation_notes?: string;
      validated_by?: string;
      validator_role?: string;
      action_type?: string;
    }
  ): Promise<{ success: boolean; updated_count: number; validation_status: string; validated_by: string; errors?: string[] }> => {
    const res = await api.post(`/api/projects/${projectId}/activities/bulk-validate`, data);
    return res.data;
  },

  getGovernanceSummary: async (projectId: number): Promise<GovernanceSummary> => {
    const res = await api.get(`/api/projects/${projectId}/activities/governance-summary`);
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

  createBlocker: async (projectId: number, data: any): Promise<HindranceSubmissionReceipt> => {
    const res = await api.post(`/api/projects/${projectId}/blockers`, data);
    return res.data;
  },

  createHindrance: async (projectId: number, data: any): Promise<HindranceSubmissionReceipt> => {
    const res = await api.post(`/api/projects/${projectId}/blockers`, data);
    return res.data;
  },

  updateBlocker: async (id: number, data: any): Promise<Blocker> => {
    const res = await api.put(`/api/blockers/${id}`, data);
    return res.data;
  },

  updateHindrance: async (id: number, data: any): Promise<Blocker> => {
    const res = await api.put(`/api/blockers/${id}`, data);
    return res.data;
  },

  sendGeotechnicalPlanToManager: async (projectId: number): Promise<any> => {
    const res = await api.post(`/api/projects/${projectId}/geotechnical/send-plan-to-manager`);
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

  parseSoilReport: async (input: string | File, filename?: string): Promise<any> => {
    if (input instanceof File) {
      const formData = new FormData();
      formData.append('file', input);
      if (filename) formData.append('filename', filename);
      const res = await api.post('/api/environmental-analysis/parse-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    }
    const res = await api.post('/api/environmental-analysis/parse-report', { raw_text: input, filename });
    return res.data;
  },

  parseWeatherReport: async (file: File): Promise<{
    temperature_c: number | null;
    wind_speed_kmh: number | null;
    weather_condition: string | null;
    humidity_percent: number | null;
    rainfall_mm: number | null;
    weather_report_filename: string;
    extracted_fields: string[];
    warnings: string[];
    summary: string;
    raw_text: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/api/environmental-analysis/parse-weather-report', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
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
  },

  // Geotechnical Intelligence Master REST Endpoints
  uploadGeotechIntelligence: async (formData: FormData): Promise<any> => {
    const res = await api.post('/api/geotechnical/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  getAllGeotechReports: async (projectId?: number): Promise<any[]> => {
    const res = await api.get('/api/geotechnical/reports', { params: { project_id: projectId } });
    return res.data;
  },

  getGeotechIntelligence: async (reportId: string | number): Promise<any> => {
    const res = await api.get(`/api/geotechnical/${reportId}`);
    return res.data;
  },

  exportGeotechPDF: async (reportId: string | number): Promise<Blob> => {
    const res = await api.post(`/api/geotechnical/${reportId}/export/pdf`, {}, {
      responseType: 'blob'
    });
    return res.data;
  },

  exportGeotechExcel: async (reportId: string | number): Promise<Blob> => {
    const res = await api.post(`/api/geotechnical/${reportId}/export/excel`, {}, {
      responseType: 'blob'
    });
    return res.data;
  },

  compareGeotechReports: async (reportA: string, reportB: string): Promise<any> => {
    const res = await api.get('/api/geotechnical/compare', {
      params: { report_a: reportA, report_b: reportB }
    });
    return res.data;
  },

  getGeotechFiveLayers: async (reportId: string | number): Promise<any> => {
    const res = await api.get(`/api/geotechnical/${reportId}/five-layers`);
    return res.data;
  },

  getGeotechSixteenParameters: async (reportId: string | number): Promise<any> => {
    const res = await api.get(`/api/geotechnical/${reportId}/sixteen-parameters`);
    return res.data;
  },

  getGeotechStandardJson: async (reportId: string | number): Promise<any> => {
    const res = await api.get(`/api/geotechnical/${reportId}/standard-json`);
    return res.data;
  },

  getGeotechPipeline: async (reportId: string | number): Promise<any> => {
    const res = await api.get(`/api/geotechnical/${reportId}/pipeline`);
    return res.data;
  },

  syncGeotechToBOQ: async (reportId: string | number): Promise<any> => {
    const res = await api.post(`/api/geotechnical/${reportId}/sync-boq`);
    return res.data;
  },

  // Tasks
  getTasks: async (projectId: number, params?: { status?: string; tower?: string }): Promise<Task[]> => {
    const res = await api.get(`/api/projects/${projectId}/tasks`, { params });
    return res.data;
  },

  createTask: async (projectId: number, input: NewTaskInput): Promise<Task> => {
    const res = await api.post(`/api/projects/${projectId}/tasks`, input);
    return res.data;
  },

  taskAction: async (taskId: number, action: TaskActionName, body?: { reason?: string; on_date?: string }): Promise<Task> => {
    const res = await api.post(`/api/tasks/${taskId}/${action}`, body ?? {});
    return res.data;
  },

  setTaskProgress: async (taskId: number, percent: number): Promise<Task> => {
    const res = await api.post(`/api/tasks/${taskId}/progress`, { percent });
    return res.data;
  },

  getTaskChecks: async (taskId: number): Promise<TaskCheck[]> => {
    const res = await api.get(`/api/tasks/${taskId}/checks`);
    return res.data;
  },

  setTaskCheck: async (taskId: number, checkId: number, passed: boolean): Promise<Task> => {
    const res = await api.post(`/api/tasks/${taskId}/checks/${checkId}`, { passed });
    return res.data;
  },

  waiveTaskCheck: async (taskId: number, checkId: number, reason: string): Promise<Task> => {
    const res = await api.post(`/api/tasks/${taskId}/checks/${checkId}/waive`, { reason });
    return res.data;
  },

  // Today: look-ahead with Plan B, and the daily checklist
  getLookahead: async (projectId: number, days = 5): Promise<Lookahead> => {
    const res = await api.get(`/api/projects/${projectId}/lookahead`, { params: { days } });
    return res.data;
  },

  getDailyChecklist: async (projectId: number): Promise<DailyChecklist> => {
    const res = await api.get(`/api/projects/${projectId}/daily-checklist`);
    return res.data;
  },

  setDailyStep: async (projectId: number, itemId: number, done: boolean): Promise<DailyChecklist> => {
    const res = await api.post(`/api/projects/${projectId}/daily-checklist/${itemId}`, { done });
    return res.data;
  },

  getTask: async (taskId: number): Promise<Task> => {
    const res = await api.get(`/api/tasks/${taskId}`);
    return res.data;
  },

  // Problems
  getProblems: async (projectId: number): Promise<Problem[]> => {
    const res = await api.get(`/api/projects/${projectId}/problems`);
    return res.data;
  },

  getProblemCategories: async (): Promise<string[]> => {
    const res = await api.get('/api/problem-categories');
    return res.data;
  },

  reportProblem: async (projectId: number, input: NewProblemInput): Promise<Problem> => {
    const res = await api.post(`/api/projects/${projectId}/problems`, input);
    return res.data;
  },

  resolveProblem: async (problemId: number, note?: string): Promise<Problem> => {
    const res = await api.post(`/api/problems/${problemId}/resolve`, { note });
    return res.data;
  },

  decideProblemImpact: async (
    problemId: number,
    body: { decision: 'CONFIRM' | 'NO_IMPACT'; days?: number; project_days?: number; note?: string }
  ): Promise<Problem> => {
    const res = await api.post(`/api/problems/${problemId}/impact`, body);
    return res.data;
  },

  getDelaySummary: async (projectId: number): Promise<DelaySummary> => {
    const res = await api.get(`/api/projects/${projectId}/delay-summary`);
    return res.data;
  },

  // Plan sequence and portfolio
  getSequence: async (projectId: number): Promise<SequenceItem[]> => {
    const res = await api.get(`/api/projects/${projectId}/sequence`);
    return res.data;
  },

  getPortfolio: async (): Promise<PortfolioProject[]> => {
    const res = await api.get('/api/portfolio');
    return res.data;
  },

  // Notifications, attention inbox, activity detail, digest
  getNotifications: async (limit = 20): Promise<NotificationList> => {
    const res = await api.get('/api/notifications', { params: { limit } });
    return res.data;
  },

  markNotificationRead: async (id: number): Promise<AppNotification> => {
    const res = await api.post(`/api/notifications/${id}/read`);
    return res.data;
  },

  markAllNotificationsRead: async (): Promise<NotificationList> => {
    const res = await api.post('/api/notifications/read-all');
    return res.data;
  },

  getAttention: async (projectId: number): Promise<AttentionItem[]> => {
    const res = await api.get(`/api/projects/${projectId}/attention`);
    return res.data;
  },

  getDigest: async (projectId: number, days = 7): Promise<Digest> => {
    const res = await api.get(`/api/projects/${projectId}/digest`, { params: { days } });
    return res.data;
  },

  getActivityDetail: async (activityId: number): Promise<ActivityDetail> => {
    const res = await api.get(`/api/activities/${activityId}/detail`);
    return res.data;
  },

  getBuilding: async (projectId: number): Promise<BuildingData> => {
    const res = await api.get(`/api/projects/${projectId}/building`);
    return res.data;
  }
};
