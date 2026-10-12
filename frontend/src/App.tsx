import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
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
import { ProjectStructureLifecycleHub } from './components/ProjectStructureLifecycleHub';

import { apiClient } from './api/client';
import { User, Project, Activity, ActivityDependency, CompletionForecast, RiskItem, AIRecommendation, Blocker, DailyProgress, HindranceSubmissionReceipt } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('structure-lifecycle');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | undefined>(undefined);
  const [lastProjectSync, setLastProjectSync] = useState<Date | null>(null);
  const [projectSyncError, setProjectSyncError] = useState(false);
  const [isProjectSyncing, setIsProjectSyncing] = useState(false);
  const projectSyncInFlight = useRef(false);

  // Active Project Data
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dependencies, setDependencies] = useState<ActivityDependency[]>([]);
  const [forecast, setForecast] = useState<CompletionForecast | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [hindranceNotice, setHindranceNotice] = useState<{ title: string; description: string } | null>(null);
  const knownBlockerIds = useRef<Set<number> | null>(null);

  // Modals state
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

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await apiClient.getProjects();
      const featuredProject = data.filter((project) => project.code === 'PRJ-41ZOY');
      setProjects(featuredProject);
      setActiveProjectId((selectedId) =>
        featuredProject.some((project) => project.id === selectedId)
          ? selectedId
          : featuredProject[0]?.id
      );
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjectsError('Could not load the 41 ZOY project. Check your connection and try again.');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // When activeProjectId changes, fetch all associated project data
  const fetchActiveProjectData = useCallback(async () => {
    if (!activeProjectId || projectSyncInFlight.current) return;
    projectSyncInFlight.current = true;
    setIsProjectSyncing(true);
    try {
      const [acts, deps, fc, rk, recs, blk] = await Promise.all([
        apiClient.getActivities(activeProjectId),
        apiClient.getDependencies(activeProjectId),
        apiClient.getCompletionForecast(activeProjectId).catch(() => null),
        apiClient.getRiskCenter(activeProjectId).catch(() => ({ critical_risks: [], high_risks: [], medium_risks: [], low_risks: [] })),
        apiClient.getAIRecommendations(activeProjectId).catch(() => []),
        currentUser?.role === 'Admin' ? apiClient.getBlockers(activeProjectId) : Promise.resolve([]),
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
      if (currentUser?.role === 'Admin') {
        const newBlockers = knownBlockerIds.current
          ? blk.filter((blocker) => !knownBlockerIds.current?.has(blocker.id))
          : [];
        if (newBlockers.length > 0) {
          const latestBlocker = newBlockers.sort(
            (left, right) => right.created_at.localeCompare(left.created_at)
          )[0];
          setHindranceNotice({
            title: 'New hindrance reported',
            description: `${latestBlocker.category} · ${latestBlocker.activity_name || 'Project-wide'} has been saved to the 41 ZOY hindrance register.`,
          });
        }
        knownBlockerIds.current = new Set(blk.map((blocker) => blocker.id));
      } else {
        knownBlockerIds.current = null;
      }
      setBlockers(blk);
      setLastProjectSync(new Date());
      setProjectSyncError(false);
    } catch (err) {
      console.error('Error loading project details:', err);
      setProjectSyncError(true);
    } finally {
      projectSyncInFlight.current = false;
      setIsProjectSyncing(false);
    }
  }, [activeProjectId, currentUser?.role]);

  useEffect(() => {
    void fetchActiveProjectData();
    const refreshTimer = window.setInterval(() => {
      void fetchActiveProjectData();
    }, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchActiveProjectData]);

  useEffect(() => {
    if (!hindranceNotice) return;
    const timeout = window.setTimeout(() => setHindranceNotice(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [hindranceNotice]);

  useEffect(() => {
    if (currentTab === 'blockers' && currentUser?.role !== 'Admin') {
      setCurrentTab('monitoring');
    }
  }, [currentTab, currentUser?.role]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleOpenLogProgressWithActivity = (actId?: number) => {
    setLogProgressActivityId(actId);
    setIsLogProgressOpen(true);
  };

  const handleNavigateToImpact = (actId: number) => {
    setCurrentTab('impact');
  };

  const handleHindranceCreated = (receipt: HindranceSubmissionReceipt) => {
    knownBlockerIds.current?.add(receipt.id);
    setHindranceNotice({
      title: 'Hindrance report submitted',
      description: currentUser?.role === 'Admin'
        ? 'The report is saved and available in the Admin hindrance register.'
        : 'The report has been saved for Admin review.',
    });
    void fetchActiveProjectData();
  };

  const pendingRecsCount = recommendations.filter((r) => r.status === 'PENDING').length;
  const openBlockersCount = blockers.filter((b) => b.status !== 'RESOLVED').length;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 flex flex-col font-sans selection:bg-amber-200 selection:text-slate-900">
      {/* Top Navbar */}
      <Navbar
        projects={projects}
        activeProjectId={activeProjectId}
        currentUser={currentUser}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setCurrentTab('structure-lifecycle');
        }}
        onToggleNavigation={() => setMobileNavOpen((open) => !open)}
        mobileNavOpen={mobileNavOpen}
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
          setBlockers([]);
          knownBlockerIds.current = null;
        }}
        onOpenGeotechReview={() => setIsGeotechReviewOpen(true)}
        onOpenLogHindrance={() => {
          setHindranceActivityId(undefined);
          setIsLogHindranceOpen(true);
        }}
        hindranceCount={openBlockersCount}
        onOpenHindranceRegister={() => setCurrentTab('blockers')}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-x-0 bottom-0 top-16 z-30 bg-slate-950/35 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setMobileNavOpen(false);
          }}
          isAdmin={currentUser?.role === 'Admin'}
          pendingRecsCount={pendingRecsCount}
          openBlockersCount={openBlockersCount}
          mobileOpen={mobileNavOpen}
          isSyncing={isProjectSyncing}
          isSyncError={projectSyncError}
          lastSyncAt={lastProjectSync}
        />

        {/* Dynamic Content Region */}
        <main className="flex-1 overflow-y-auto bg-transparent p-4 lg:p-7 max-h-[calc(100vh-4rem)]">
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
                  lastUpdatedAt={lastProjectSync}
                  isRefreshError={projectSyncError}
                  onRefreshData={fetchActiveProjectData}
                  onNavigateTab={(t) => setCurrentTab(t)}
                  onOpenAutoPlan={() => setIsAutoPlanOpen(true)}
                  onOpenGeotechReview={() => setIsGeotechReviewOpen(true)}
                  onOpenLogHindrance={(actId) => {
                    setHindranceActivityId(actId);
                    setIsLogHindranceOpen(true);
                  }}
                  onOpenLoginModal={() => setIsLoginModalOpen(true)}
                />
              )}

              {currentTab === 'projects' && (
                <ProjectsPage
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSelectProject={(id) => {
                    setActiveProjectId(id);
                    setCurrentTab('structure-lifecycle');
                  }}
                  onProjectUpdated={(updatedPrj) => {
                    if (updatedPrj.code === 'PRJ-41ZOY') {
                      setProjects((prev) =>
                        prev.map((p) => (p.id === updatedPrj.id ? updatedPrj : p))
                      );
                    }
                  }}
                />
              )}

              {currentTab === 'structure-lifecycle' && (
                <ProjectStructureLifecycleHub
                  project={activeProject}
                  activities={activities}
                  dependencies={dependencies}
                  forecast={forecast}
                  currentUser={currentUser}
                  onOpenLogProgress={handleOpenLogProgressWithActivity}
                  onOpenLogHindrance={(actId) => {
                    setHindranceActivityId(actId);
                    setIsLogHindranceOpen(true);
                  }}
                  onRefreshData={fetchActiveProjectData}
                  lastUpdatedAt={lastProjectSync}
                  isRefreshError={projectSyncError}
                  isRefreshing={isProjectSyncing}
                />
              )}

              {(currentTab === 'activities' || currentTab === 'gantt' || currentTab === 'dependencies' || currentTab === 'pm-validation') && (
                <PlanningPage
                  project={activeProject}
                  activities={activities.filter((a) => a.project_id === activeProject.id)}
                  dependencies={dependencies.filter((d) => d.project_id === activeProject.id)}
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
                  key={currentTab}
                  project={activeProject}
                  activities={activities}
                  initialSubTab={currentTab === 'blockers' ? 'blockers' : 'today'}
                  onOpenLogProgress={handleOpenLogProgressWithActivity}
                  onRefreshData={fetchActiveProjectData}
                  currentUser={currentUser}
                  onHindranceCreated={handleHindranceCreated}
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
                <ReportsPage project={activeProject} currentUser={currentUser} />
              )}

              {currentTab === 'audit' && <AuditLogPage />}
            </>
          ) : (
            <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
              {projectsLoading ? (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-amber-600" />
                  <h2 className="mt-4 text-base font-semibold text-slate-800">Loading 41 ZOY</h2>
                  <p className="mt-1 text-sm text-slate-500">Connecting to the project schedule and site data…</p>
                </>
              ) : projectsError ? (
                <>
                  <h2 className="text-base font-semibold text-slate-800">Project data could not be loaded</h2>
                  <p className="mt-1 text-sm text-slate-500">{projectsError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchProjects()}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-slate-800">41 ZOY project data is unavailable</h2>
                  <p className="mt-1 text-sm text-slate-500">Project PRJ-41ZOY is not present in the project service.</p>
                  <button
                    type="button"
                    onClick={() => void fetchProjects()}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Refresh projects
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals & AI Drawer */}
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
            onHindranceCreated={handleHindranceCreated}
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

      {hindranceNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[70] flex w-[min(26rem,calc(100vw-2.5rem))] items-start gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-xl"
        >
          <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-800">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900">{hindranceNotice.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{hindranceNotice.description}</p>
            {currentUser?.role === 'Admin' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('blockers');
                  setHindranceNotice(null);
                }}
                className="mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2"
              >
                Open Admin hindrance register
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss hindrance notification"
            onClick={() => setHindranceNotice(null)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
