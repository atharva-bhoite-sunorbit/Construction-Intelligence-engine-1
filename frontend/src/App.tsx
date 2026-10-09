import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CreateProjectModal } from './components/CreateProjectModal';
import { AddActivityModal } from './components/AddActivityModal';
import { AutoPlanModal } from './components/AutoPlanModal';
import { LogProgressModal } from './components/LogProgressModal';
import { WeatherSoilModal } from './components/WeatherSoilModal';
import { ManagerValidationModal } from './components/ManagerValidationModal';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { ManagerLoginModal } from './components/ManagerLoginModal';
import { LogHindranceModal } from './components/LogHindranceModal';
import { ManagerGeotechValidationModal } from './components/ManagerGeotechValidationModal';

import { Dashboard } from './pages/Dashboard';
import { ProjectsPage } from './pages/Projects';
import { PlanningPage } from './pages/Planning';
import { ResourcesPage } from './pages/Resources';
import { MonitoringPage } from './pages/Monitoring';
import { AIRiskCenter } from './pages/AIRiskCenter';
import { MLPredictionsPage } from './pages/MLPredictions';
import { ImpactAnalysisPage } from './pages/ImpactAnalysis';
import { CompletionForecastPage } from './pages/CompletionForecast';
import { AIRecommendationsPage } from './pages/AIRecommendations';
import { ReportsPage } from './pages/Reports';
import { AuditLogPage } from './pages/AuditLogPage';
import { GeotechnicalReportPage } from './pages/GeotechnicalReportPage';

import { apiClient } from './api/client';
import { User, Project, Activity, ActivityDependency, CompletionForecast, RiskItem, AIRecommendation, Blocker, DailyProgress } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | undefined>(undefined);

  // Active Project Data
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dependencies, setDependencies] = useState<ActivityDependency[]>([]);
  const [forecast, setForecast] = useState<CompletionForecast | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);

  // Modals state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isAutoPlanOpen, setIsAutoPlanOpen] = useState(false);
  const [isLogProgressOpen, setIsLogProgressOpen] = useState(false);
  const [logProgressActivityId, setLogProgressActivityId] = useState<number | undefined>(undefined);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isWeatherSoilOpen, setIsWeatherSoilOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationTargetProgress, setValidationTargetProgress] = useState<DailyProgress | null>(null);
  const [validationTargetActivityName, setValidationTargetActivityName] = useState<string | undefined>(undefined);

  // Manager Authentication & Review Modals State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLogHindranceOpen, setIsLogHindranceOpen] = useState(false);
  const [hindranceActivityId, setHindranceActivityId] = useState<number | undefined>(undefined);
  const [isGeotechReviewOpen, setIsGeotechReviewOpen] = useState(false);

  // Initial load: Fetch session & projects
  useEffect(() => {
    apiClient.getMe()
      .then((user) => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // When activeProjectId changes, fetch all associated project data
  const fetchActiveProjectData = async () => {
    if (!activeProjectId) return;
    try {
      const [acts, deps, fc, rk, recs, blk] = await Promise.all([
        apiClient.getActivities(activeProjectId),
        apiClient.getDependencies(activeProjectId),
        apiClient.getCompletionForecast(activeProjectId).catch(() => null),
        apiClient.getRiskCenter(activeProjectId).catch(() => ({ critical_risks: [], high_risks: [], medium_risks: [], low_risks: [] })),
        apiClient.getAIRecommendations(activeProjectId).catch(() => []),
        apiClient.getBlockers(activeProjectId).catch(() => []),
      ]);

      setActivities(acts);
      setDependencies(deps);
      setForecast(fc);
      const combinedRisks = [
        ...(rk.critical_risks || []),
        ...(rk.high_risks || []),
        ...(rk.medium_risks || []),
        ...(rk.low_risks || []),
      ];
      setRisks(combinedRisks);
      setRecommendations(recs);
      setBlockers(blk);
    } catch (err) {
      console.error('Error loading project details:', err);
    }
  };

  useEffect(() => {
    fetchActiveProjectData();
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleOpenLogProgressWithActivity = (actId?: number) => {
    setLogProgressActivityId(actId);
    setIsLogProgressOpen(true);
  };

  const handleNavigateToImpact = (actId: number) => {
    setCurrentTab('impact');
  };

  const pendingRecsCount = recommendations.filter((r) => r.status === 'PENDING').length;
  const openBlockersCount = blockers.filter((b) => b.status !== 'RESOLVED').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        projects={projects}
        activeProjectId={activeProjectId}
        currentUser={currentUser}
        onSelectProject={(id) => setActiveProjectId(id)}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onOpenLogProgress={() => handleOpenLogProgressWithActivity()}
        onToggleAIAssistant={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
        onOpenWeatherSoil={() => setIsWeatherSoilOpen(true)}
        onOpenValidation={() => {
          setValidationTargetProgress(null);
          setValidationTargetActivityName(undefined);
          setIsValidationOpen(true);
        }}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={() => {
          apiClient.logout();
          setCurrentUser(null);
        }}
        onOpenGeotechReview={() => setIsGeotechReviewOpen(true)}
        onOpenLogHindrance={() => {
          setHindranceActivityId(undefined);
          setIsLogHindranceOpen(true);
        }}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          pendingRecsCount={pendingRecsCount}
          openBlockersCount={openBlockersCount}
        />

        {/* Dynamic Content Region */}
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-4rem)] bg-slate-50/60">
          {activeProject ? (
            <>
              {currentTab === 'dashboard' && (
                <Dashboard
                  projects={projects}
                  activeProject={activeProject}
                  activities={activities}
                  forecast={forecast}
                  risks={risks}
                  blockers={blockers}
                  currentUser={currentUser}
                  onNavigateTab={(t) => setCurrentTab(t)}
                  onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                  onOpenAutoPlan={() => setIsAutoPlanOpen(true)}
                  onOpenGeotechReview={() => setIsGeotechReviewOpen(true)}
                  onOpenLogHindrance={(actId) => {
                    setHindranceActivityId(actId);
                    setIsLogHindranceOpen(true);
                  }}
                  onOpenLoginModal={() => setIsLoginModalOpen(true)}
                  onRefreshData={fetchActiveProjectData}
                />
              )}

              {currentTab === 'projects' && (
                <ProjectsPage
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSelectProject={(id) => {
                    setActiveProjectId(id);
                    setCurrentTab('dashboard');
                  }}
                  onOpenCreateModal={() => setIsCreateProjectOpen(true)}
                  onProjectUpdated={(updatedPrj) => {
                    setProjects((prev) =>
                      prev.map((p) => (p.id === updatedPrj.id ? updatedPrj : p))
                    );
                  }}
                />
              )}

              {(currentTab === 'activities' || currentTab === 'gantt' || currentTab === 'dependencies' || currentTab === 'pm-validation') && (
                <PlanningPage
                  project={activeProject}
                  activities={activities}
                  dependencies={dependencies}
                  currentUser={currentUser}
                  onOpenAddActivity={() => setIsAddActivityOpen(true)}
                  onOpenAutoPlan={() => setIsAutoPlanOpen(true)}
                  onRefreshData={fetchActiveProjectData}
                  initialSubTab={currentTab === 'pm-validation' ? 'validation' : (currentTab as any)}
                />
              )}

              {currentTab === 'geotechnical' && (
                <GeotechnicalReportPage
                  project={activeProject}
                  onNavigateToSchedule={() => setCurrentTab('gantt')}
                  onRefreshData={fetchActiveProjectData}
                />
              )}

              {currentTab === 'resources' && (
                <ResourcesPage project={activeProject} />
              )}

              {(currentTab === 'monitoring' || currentTab === 'blockers') && (
                <MonitoringPage
                  project={activeProject}
                  activities={activities}
                  onOpenLogProgress={handleOpenLogProgressWithActivity}
                  onRefreshData={fetchActiveProjectData}
                  onOpenWeatherSoil={() => setIsWeatherSoilOpen(true)}
                  onOpenValidation={(prog, actName) => {
                    setValidationTargetProgress(prog || null);
                    setValidationTargetActivityName(actName);
                    setIsValidationOpen(true);
                  }}
                />
              )}

              {currentTab === 'risks' && (
                <AIRiskCenter
                  project={activeProject}
                  onNavigateToImpact={handleNavigateToImpact}
                />
              )}

              {currentTab === 'predictions' && (
                <MLPredictionsPage
                  project={activeProject}
                  onRefreshData={fetchActiveProjectData}
                />
              )}

              {currentTab === 'impact' && (
                <ImpactAnalysisPage
                  project={activeProject}
                  activities={activities}
                />
              )}

              {currentTab === 'forecast' && (
                <CompletionForecastPage project={activeProject} />
              )}

              {currentTab === 'recommendations' && (
                <AIRecommendationsPage
                  project={activeProject}
                  onRefreshData={fetchActiveProjectData}
                />
              )}

              {currentTab === 'reports' && (
                <ReportsPage project={activeProject} />
              )}

              {currentTab === 'audit' && <AuditLogPage />}
            </>
          ) : (
            <div className="py-24 text-center space-y-4">
              <h2 className="text-xl font-bold text-slate-800">No Construction Projects Initialized</h2>
              <p className="text-xs text-slate-500">Create your first construction project to begin.</p>
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm"
              >
                + Create Project
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modals & AI Drawer */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onProjectCreated={(newPrj) => {
          setProjects((prev) => [newPrj, ...prev.filter((p) => p.id !== newPrj.id)]);
          setActiveProjectId(newPrj.id);
          setCurrentTab('dashboard');
          fetchProjects();
        }}
      />

      {activeProject && (
        <>
          <AddActivityModal
            isOpen={isAddActivityOpen}
            onClose={() => setIsAddActivityOpen(false)}
            projectId={activeProject.id}
            onActivityAdded={() => fetchActiveProjectData()}
          />

          <AutoPlanModal
            isOpen={isAutoPlanOpen}
            onClose={() => setIsAutoPlanOpen(false)}
            projectId={activeProject.id}
            projectType={activeProject.construction_type}
            defaultFloors={activeProject.num_floors}
            defaultTowers={activeProject.num_towers}
            onPlanGenerated={() => fetchActiveProjectData()}
          />

          <LogProgressModal
            isOpen={isLogProgressOpen}
            onClose={() => setIsLogProgressOpen(false)}
            activities={activities}
            defaultActivityId={logProgressActivityId}
            onProgressLogged={() => fetchActiveProjectData()}
          />

          <WeatherSoilModal
            isOpen={isWeatherSoilOpen}
            onClose={() => setIsWeatherSoilOpen(false)}
            projectId={activeProject.id}
            onAnalysisUpdated={() => fetchActiveProjectData()}
          />

          <ManagerValidationModal
            isOpen={isValidationOpen}
            onClose={() => setIsValidationOpen(false)}
            projectId={activeProject.id}
            progressRecord={validationTargetProgress}
            activityName={validationTargetActivityName}
            onValidationComplete={() => fetchActiveProjectData()}
          />

          {/* Manager Login Modal */}
          <ManagerLoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            currentUser={currentUser}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              fetchActiveProjectData();
            }}
          />

          {/* Log Project Hindrance & Difficulty Modal */}
          <LogHindranceModal
            isOpen={isLogHindranceOpen}
            onClose={() => setIsLogHindranceOpen(false)}
            project={activeProject}
            activities={activities}
            defaultActivityId={hindranceActivityId}
            onHindranceCreated={() => fetchActiveProjectData()}
          />

          {/* Geotechnical Activities Plan Review & Manager Decision Gate Modal */}
          <ManagerGeotechValidationModal
            isOpen={isGeotechReviewOpen}
            onClose={() => setIsGeotechReviewOpen(false)}
            project={activeProject}
            activities={activities}
            blockers={blockers}
            currentUser={currentUser}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenLogHindranceModal={(actId) => {
              setHindranceActivityId(actId);
              setIsLogHindranceOpen(true);
            }}
            onRefreshData={() => fetchActiveProjectData()}
          />
        </>
      )}

      <AIAssistantDrawer
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        projectId={activeProjectId}
      />
    </div>
  );
}

export default App;
