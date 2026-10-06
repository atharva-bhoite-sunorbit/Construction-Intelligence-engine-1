import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ClipboardCheck,
  AlertOctagon,
  Camera,
  Plus,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
  Wind,
  Thermometer,
  Layers,
  Compass,
  FileCheck
} from 'lucide-react';
import { Project, Activity, DailyProgress, Blocker, SiteObservation, EnvironmentalAnalysis } from '../types';
import { apiClient } from '../api/client';

interface MonitoringPageProps {
  project: Project;
  activities: Activity[];
  onOpenLogProgress: (activityId?: number) => void;
  onRefreshData: () => void;
  onOpenWeatherSoil?: () => void;
  onOpenValidation?: (progress?: DailyProgress, activityName?: string) => void;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = ({
  project,
  activities,
  onOpenLogProgress,
  onRefreshData,
  onOpenWeatherSoil,
  onOpenValidation,
}) => {
  const [subTab, setSubTab] = useState<'today' | 'history' | 'blockers' | 'photos'>('today');
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [progressLogs, setProgressLogs] = useState<DailyProgress[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [photos, setPhotos] = useState<SiteObservation[]>([]);
  const [envData, setEnvData] = useState<EnvironmentalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  // New Blocker modal state
  const [showAddBlocker, setShowAddBlocker] = useState(false);
  const [blockerForm, setBlockerForm] = useState({
    activity_id: activities[0]?.id || undefined,
    category: 'Labour Shortage',
    description: '',
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    opened_date: new Date().toISOString().split('T')[0],
    mitigation_plan: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todayRes, progRes, blockRes, photoRes, envRes] = await Promise.all([
        apiClient.getTodaySiteActivities(project.id),
        apiClient.getDailyProgress(project.id),
        apiClient.getBlockers(project.id),
        apiClient.getSitePhotos(project.id),
        apiClient.getLatestEnvironmentalAnalysis(project.id).catch(() => null),
      ]);
      setTodayActivities(todayRes.activities || []);
      setProgressLogs(progRes || []);
      setBlockers(blockRes || []);
      setPhotos(photoRes || []);
      setEnvData(envRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [project.id]);

  const handleCreateBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createBlocker(project.id, blockerForm);
      setShowAddBlocker(false);
      setBlockerForm({
        activity_id: activities[0]?.id || undefined,
        category: 'Labour Shortage',
        description: '',
        severity: 'MEDIUM',
        opened_date: new Date().toISOString().split('T')[0],
        mitigation_plan: '',
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to report blocker.');
    }
  };

  const handleResolveBlocker = async (id: number) => {
    try {
      await apiClient.updateBlocker(id, {
        status: 'RESOLVED',
        resolved_date: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">DAILY SITE MONITORING & CONTROL</h1>
          <p className="text-xs text-slate-500">
            Real-time site muster, work-front execution, daily productivity calculations, blockers, and photographic audits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenWeatherSoil && (
            <button
              onClick={onOpenWeatherSoil}
              className="px-3.5 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Wind className="w-4 h-4 text-cyan-600" />
              <span>Weather & Soil Intel</span>
            </button>
          )}

          {onOpenValidation && (
            <button
              onClick={() => onOpenValidation()}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <FileCheck className="w-4 h-4 text-brand-600" />
              <span>Manager Validation Protocol</span>
            </button>
          )}

          <button
            onClick={() => onOpenLogProgress()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 transition-all"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Log Daily Site Progress</span>
          </button>
        </div>
      </div>

      {/* Site Environmental & Soil Intel Banner */}
      {envData && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 ${
              envData.overall_site_risk === 'CRITICAL_HALT'
                ? 'bg-rose-600'
                : envData.overall_site_risk === 'HIGH_RISK'
                ? 'bg-amber-600'
                : 'bg-emerald-600'
            }`}>
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  SITE WEATHER & GEOTECHNICAL INTEL
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  envData.overall_site_risk === 'CRITICAL_HALT'
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                    : envData.overall_site_risk === 'HIGH_RISK'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                    : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                }`}>
                  {envData.overall_site_risk.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-200">
                <span className="flex items-center gap-1 font-mono">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  Wind: <strong className={envData.wind_speed_kmh >= 38 ? 'text-rose-400' : 'text-white'}>{envData.wind_speed_kmh} km/h</strong>
                  {envData.wind_speed_kmh >= 38 && <span className="text-[10px] text-rose-300">(Crane Restricted)</span>}
                </span>
                <span className="text-slate-500">•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  Temp: <strong>{envData.temperature_c}°C</strong> ({envData.weather_condition})
                </span>
                <span className="text-slate-500">•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Soil: <strong>{envData.soil_type}</strong> (SBC: <strong>{envData.safe_bearing_capacity_kpa} kPa</strong>, Compaction: <strong className={envData.compaction_percent < 95 ? 'text-amber-400' : 'text-white'}>{envData.compaction_percent}%</strong>)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenWeatherSoil && (
              <button
                onClick={onOpenWeatherSoil}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Wind className="w-3.5 h-3.5" />
                <span>Update Weather / Soil Report</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'today', label: "Today's Active Work-Fronts", icon: ShieldCheck, count: todayActivities.length },
          { id: 'history', label: 'Daily Progress Audit Logs', icon: Clock, count: progressLogs.length },
          {
            id: 'blockers',
            label: 'Site Blockers & Roadblocks',
            icon: AlertOctagon,
            count: blockers.filter((b) => b.status !== 'RESOLVED').length,
          },
          { id: 'photos', label: 'Photo Observations', icon: Camera, count: photos.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-brand-500 text-white bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.2 rounded-full border border-slate-200">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Today's Site Control Center */}
      {subTab === 'today' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">TODAY'S SITE CONTROL & WORK-FRONT MONITOR</h3>
            <span className="text-xs text-slate-500 font-mono">Date: {new Date().toLocaleDateString()}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Activity</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Current Progress</th>
                  <th className="py-3 px-3">Workers On-Site</th>
                  <th className="py-3 px-3">Daily Output</th>
                  <th className="py-3 px-3">Variance</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {todayActivities.map((a) => (
                  <tr key={a.activity_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{a.activity_name}</div>
                      <div className="text-[10px] text-slate-500">{a.phase} • {a.code}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {a.tower} • Floor {a.floor}
                    </td>
                    <td className="py-3 px-3">
                      <div className="w-24">
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                          <span>{a.progress_percent}%</span>
                        </div>
                        <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${a.progress_percent}%` }}
                            className={`h-full ${
                              a.progress_percent === 100
                                ? 'bg-emerald-500'
                                : a.status === 'DELAYED'
                                ? 'bg-rose-500'
                                : 'bg-brand-500'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span className="font-semibold text-white">{a.latest_workers_assigned}</span> / {a.required_labour} req
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {a.latest_daily_productivity > 0 ? (
                        <span>{a.latest_daily_productivity} {a.unit}/hr</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {a.latest_variance_pct < -5 ? (
                        <span className="text-rose-400 font-bold">{a.latest_variance_pct}%</span>
                      ) : a.latest_variance_pct > 0 ? (
                        <span className="text-emerald-400">+{a.latest_variance_pct}%</span>
                      ) : (
                        <span className="text-slate-500">0%</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'DELAYED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : a.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenLogProgress(a.activity_id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition-all shadow-xs"
                        >
                          Update Progress
                        </button>
                        {onOpenValidation && (
                          <button
                            onClick={() => onOpenValidation(undefined, a.activity_name)}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-brand-700 border border-slate-200 text-[11px] font-semibold transition-all flex items-center gap-1 shadow-xs"
                          >
                            <ShieldCheck className="w-3 h-3 text-brand-600" />
                            <span>Validate</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Progress History & Validation Audits */}
      {subTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-3">Planned Qty</th>
                <th className="py-3 px-3">Actual Achieved</th>
                <th className="py-3 px-3">Workers</th>
                <th className="py-3 px-3">Productivity</th>
                <th className="py-3 px-3">Variance</th>
                <th className="py-3 px-3">Validation Status</th>
                <th className="py-3 px-3 text-right">Manager Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {progressLogs.map((p) => {
                const isValidated = p.validation_status === 'APPROVED' || p.validation_status === 'VALIDATED';
                const isConditional = p.validation_status === 'CONDITIONAL';
                const isRejected = p.validation_status === 'REJECTED';

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">{new Date(p.report_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.activity_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{p.planned_quantity}</td>
                    <td className="py-3 px-3 font-mono text-slate-900 font-bold">{p.actual_quantity}</td>
                    <td className="py-3 px-3 font-mono">
                      {p.workers_assigned} <span className="text-slate-500">({p.working_hours}h)</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-brand-600">{p.daily_productivity} /hr</td>
                    <td className="py-3 px-3 font-mono font-bold">
                      <span className={p.progress_variance_percent < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {p.progress_variance_percent}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isValidated ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Validated {p.validated_by ? `(${p.validated_by.split(' ')[0]})` : ''}
                        </span>
                      ) : isConditional ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Conditional
                        </span>
                      ) : isRejected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 w-fit">
                          Rejected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onOpenValidation && onOpenValidation(p, p.activity_name)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 ml-auto shadow-xs ${
                          isValidated
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                        }`}
                      >
                        <ClipboardCheck className="w-3 h-3" />
                        <span>{isValidated ? 'View Checklist' : 'Validate Checklist'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-tab 3: Blockers */}
      {subTab === 'blockers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Site Roadblocks & Blockers</h3>
              <p className="text-xs text-slate-500">
                Track material delays, trade labour shortages, equipment downtime, and design approvals
              </p>
            </div>
            <button
              onClick={() => setShowAddBlocker(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-rose-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Report Blocker</span>
            </button>
          </div>

          {showAddBlocker && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Report New Site Blocker</span>
                <button onClick={() => setShowAddBlocker(false)} className="text-slate-500 hover:text-white text-xs">
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateBlocker} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Category</label>
                  <select
                    value={blockerForm.category}
                    onChange={(e) => setBlockerForm({ ...blockerForm, category: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    <option value="Labour Shortage">Labour Shortage</option>
                    <option value="Material Delay">Material Delay</option>
                    <option value="Equipment Failure">Equipment Failure</option>
                    <option value="Weather">Weather</option>
                    <option value="Design Issue">Design Issue</option>
                    <option value="Approval Delay">Approval Delay</option>
                    <option value="Access Problem">Access Problem</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Severity</label>
                  <select
                    value={blockerForm.severity}
                    onChange={(e) => setBlockerForm({ ...blockerForm, severity: e.target.value as any })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Associated Activity</label>
                  <select
                    value={blockerForm.activity_id}
                    onChange={(e) => setBlockerForm({ ...blockerForm, activity_id: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-500 mb-1">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="Provide specific roadblock details..."
                    value={blockerForm.description}
                    onChange={(e) => setBlockerForm({ ...blockerForm, description: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Mitigation Plan</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Action to resolve..."
                      value={blockerForm.mitigation_plan}
                      onChange={(e) => setBlockerForm({ ...blockerForm, mitigation_plan: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-3 relative overflow-hidden text-xs"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    b.severity === 'CRITICAL'
                      ? 'bg-rose-500'
                      : b.severity === 'HIGH'
                      ? 'bg-amber-500'
                      : 'bg-brand-500'
                  }`}
                />

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{b.category}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      b.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : b.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {b.severity}
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed">{b.description}</p>

                {b.mitigation_plan && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500 text-[11px]">
                    <span className="text-white font-semibold">Mitigation:</span> {b.mitigation_plan}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Opened: {new Date(b.opened_date).toLocaleDateString()}</span>
                  {b.status === 'RESOLVED' ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveBlocker(b.id)}
                      className="px-2.5 py-1 rounded bg-slate-50 hover:bg-emerald-600/20 hover:text-emerald-400 text-slate-700 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 4: Photos */}
      {subTab === 'photos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {photos.map((obs) => (
            <div
              key={obs.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs border border-slate-200 text-xs group"
            >
              <div className="h-48 overflow-hidden relative bg-slate-50">
                <img
                  src={obs.photo_url}
                  alt={obs.photo_caption || 'Site Photo'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white backdrop-blur text-[10px] font-bold text-emerald-400 border border-slate-200">
                  {obs.verification_status}
                </div>
              </div>
              <div className="p-4 space-y-1.5">
                <div className="font-bold text-slate-900">{obs.photo_caption || 'Site Progress Observation'}</div>
                <div className="text-[11px] text-slate-500">{obs.description}</div>
                <div className="pt-2 text-[10px] text-slate-500 font-mono">
                  {new Date(obs.date).toLocaleDateString()} • {obs.activity_name || 'General Site'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
