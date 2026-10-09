import React from 'react';
import {
  Building2,
  AlertTriangle,
  Flame,
  Users,
  CheckCircle2,
  TrendingDown,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Clock,
  Sparkles,
  Pickaxe,
  Rotate3d,
  FileCheck
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { ManagerPlansWidget } from '../components/ManagerPlansWidget';
import { Project, Activity, CompletionForecast, RiskItem, Blocker, User } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardProps {
  projects: Project[];
  activeProject?: Project;
  activities: Activity[];
  forecast?: CompletionForecast | null;
  risks?: RiskItem[];
  blockers?: Blocker[];
  currentUser?: User | null;
  onNavigateTab: (tab: string) => void;
  onOpenCreateProject: () => void;
  onOpenAutoPlan: () => void;
  onOpenGeotechReview?: () => void;
  onOpenLogHindrance?: (activityId?: number) => void;
  onOpenLoginModal?: () => void;
  onRefreshData?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  activeProject,
  activities,
  forecast,
  risks = [],
  blockers = [],
  currentUser,
  onNavigateTab,
  onOpenCreateProject,
  onOpenAutoPlan,
  onOpenGeotechReview,
  onOpenLogHindrance,
  onOpenLoginModal,
  onRefreshData,
}) => {
  const totalActs = activities.length;
  const completedActs = activities.filter((a) => a.status === 'COMPLETED').length;
  const delayedActs = activities.filter((a) => a.status === 'DELAYED').length;
  const criticalActs = activities.filter((a) => a.is_critical).length;
  const highRisks = risks.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL');

  // Chart data: Progress by Floor
  const floorProgressData = [
    { floor: 'Found.', progress: 100, baseline: 100 },
    { floor: 'Floor 1', progress: 95, baseline: 100 },
    { floor: 'Floor 2', progress: 65, baseline: 85 },
    { floor: 'Floor 3', progress: 30, baseline: 45 },
    { floor: 'Floor 4', progress: 10, baseline: 15 },
    { floor: 'Floor 5', progress: 0, baseline: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Project Spotlight */}
      <div className="relative overflow-hidden rounded-xl bg-white p-6 border border-slate-200 shadow-xs">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-brand-50 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                {activeProject?.construction_type || 'Construction'}
              </span>
              <span className="text-xs text-slate-500 font-mono">Code: {activeProject?.code}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{activeProject?.name}</h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              {activeProject?.description || 'Enterprise construction facility under active scheduling, monitoring and ML predictions.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                const el = document.getElementById('manager-plans-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4 text-brand-600" />
              Manager Plans (8)
            </button>
            <button
              onClick={() => onNavigateTab('geotechnical')}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
            >
              <Rotate3d className="w-4 h-4 text-slate-950" />
              3D Stratum & Road Cutaway
            </button>
            <button
              onClick={onOpenAutoPlan}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            >
              Re-generate Auto Plan
            </button>
            <button
              onClick={() => onNavigateTab('monitoring')}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Site Control Center
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Overall Progress"
          value={`${activeProject?.overall_progress || 0}%`}
          subtitle={`${completedActs} of ${totalActs} activities completed`}
          icon={Building2}
          color="brand"
        />
        <KPICard
          title="Delayed Activities"
          value={delayedActs}
          subtitle="Lagging behind baseline milestone"
          icon={AlertTriangle}
          color={delayedActs > 0 ? 'rose' : 'emerald'}
        />
        <KPICard
          title="High-Risk Activities"
          value={highRisks.length}
          subtitle="ML delay probability > 50%"
          icon={Flame}
          color={highRisks.length > 0 ? 'amber' : 'emerald'}
        />
        <KPICard
          title="Predicted Slippage"
          value={`${forecast?.slippage_days || 0} Days`}
          subtitle={`Forecast finish: ${forecast?.predicted_completion_date ? new Date(forecast.predicted_completion_date).toLocaleDateString() : 'N/A'}`}
          icon={TrendingDown}
          color={forecast && forecast.slippage_days > 5 ? 'rose' : 'purple'}
        />
      </div>

      {/* Charts & Key Intel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Across Floors */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Floor-Wise Construction Progress</h3>
              <p className="text-xs text-slate-500">Actual vs Baseline Planned Completion %</p>
            </div>
            <button
              onClick={() => onNavigateTab('gantt')}
              className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-semibold"
            >
              View Gantt <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="floor" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="baseline" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Planned %" />
                <Bar dataKey="progress" fill="#0284c7" radius={[4, 4, 0, 0]} name="Actual %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Schedule Health & Critical Path Indicator */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Schedule Health Index</h3>
              <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                {forecast?.schedule_health_score || 85} / 100
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {forecast?.methodology_notes || 'Schedule health calculated from CPM float distribution and ML delay models.'}
            </p>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Critical Path Activities:</span>
                <span className="font-mono font-bold text-rose-600">{criticalActs} activities</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Baseline Finish Date:</span>
                <span className="font-mono text-slate-800 font-medium">
                  {activeProject?.target_completion_date ? new Date(activeProject.target_completion_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">ML Predicted Finish:</span>
                <span className="font-mono font-bold text-amber-600">
                  {forecast?.predicted_completion_date ? new Date(forecast.predicted_completion_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('forecast')}
              className="w-full py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              Explore Dynamic Forecast Engine <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manager Action Plans & Governance Engine */}
      {activeProject && (
        <div id="manager-plans-section">
          <ManagerPlansWidget
            project={activeProject}
            activities={activities}
            forecast={forecast}
            risks={risks}
            blockers={blockers}
            currentUser={currentUser}
            onNavigateTab={onNavigateTab}
            onOpenGeotechReview={onOpenGeotechReview}
            onOpenLogHindrance={onOpenLogHindrance}
            onOpenLoginModal={onOpenLoginModal}
            onRefreshData={onRefreshData}
          />
        </div>
      )}

      {/* Immediate Attention: Delay Risk Items */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Critical Attention Work-Fronts (ML Risk Engine)</h3>
              <p className="text-xs text-slate-500">Activities with elevated delay risk requiring supervisor intervention</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('risks')}
            className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
          >
            Open AI Risk Center <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Activity</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Delay Probability</th>
                <th className="py-2.5 px-3">Predicted Delay</th>
                <th className="py-2.5 px-3">Critical Path</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {risks.slice(0, 4).map((r) => (
                <tr key={r.activity_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-900">{r.activity_name}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {r.tower} • Floor {r.floor}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'DELAYED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-brand-50 text-brand-700 border border-brand-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${r.delay_probability * 100}%` }}
                          className={`h-full ${
                            r.delay_probability > 0.7
                              ? 'bg-rose-500'
                              : r.delay_probability > 0.4
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-700">{Math.round(r.delay_probability * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-amber-700 font-bold">
                    +{r.predicted_delay_days} days
                  </td>
                  <td className="py-3 px-3">
                    {r.is_critical_path ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        CRITICAL (0d Float)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Float: {r.total_float}d</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onNavigateTab('impact')}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                    >
                      Impact Analysis
                    </button>
                  </td>
                </tr>
              ))}
              {risks.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No high-risk activities detected. Operations proceeding nominally.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
