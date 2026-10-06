import React, { useState } from 'react';
import {
  Layers,
  CalendarDays,
  Network,
  Plus,
  Wand2,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  HardHat,
  CheckCheck
} from 'lucide-react';
import { GanttChart } from '../components/GanttChart';
import { PMActivitySectionValidation } from '../components/PMActivitySectionValidation';
import { Activity, ActivityDependency, Project } from '../types';
import { apiClient } from '../api/client';

interface PlanningPageProps {
  project: Project;
  activities: Activity[];
  dependencies: ActivityDependency[];
  onOpenAddActivity: () => void;
  onOpenAutoPlan: () => void;
  onRefreshData: () => void;
  initialSubTab?: 'activities' | 'gantt' | 'dependencies' | 'critical' | 'validation';
}

export const PlanningPage: React.FC<PlanningPageProps> = ({
  project,
  activities,
  dependencies,
  onOpenAddActivity,
  onOpenAutoPlan,
  onRefreshData,
  initialSubTab = 'activities',
}) => {
  const [subTab, setSubTab] = useState<'activities' | 'gantt' | 'dependencies' | 'critical' | 'validation'>(
    initialSubTab
  );
  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // New dependency form
  const [showAddDep, setShowAddDep] = useState(false);
  const [predId, setPredId] = useState<number>(activities[0]?.id || 0);
  const [succId, setSuccId] = useState<number>(activities[1]?.id || 0);
  const [depType, setDepType] = useState<string>('FS');
  const [lagDays, setLagDays] = useState<number>(0);

  const handleRecalculateCPM = async () => {
    setIsRescheduling(true);
    try {
      await apiClient.generateSchedule(project.id);
      onRefreshData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to recalculate CPM schedule.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleCreateDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createDependency(project.id, {
        predecessor_id: Number(predId),
        successor_id: Number(succId),
        dependency_type: depType,
        lag_days: Number(lagDays),
      });
      setShowAddDep(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add dependency.');
    }
  };

  const handleDeleteDependency = async (id: number) => {
    if (confirm('Delete this dependency link? The schedule will automatically recalculate.')) {
      await apiClient.deleteDependency(id);
      onRefreshData();
    }
  };

  const filteredActivities = activities.filter((a) => {
    if (selectedFloor !== 'all' && a.floor !== parseInt(selectedFloor)) return false;
    if (selectedPhase !== 'all' && a.phase !== selectedPhase) return false;
    if (criticalOnly && !a.is_critical) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const ganttTasks = activities.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    phase: a.phase,
    tower: a.tower,
    floor: a.floor,
    start: a.start_date,
    end: a.end_date,
    duration: a.planned_duration,
    progress: a.progress_percent,
    status: a.status,
    is_critical: a.is_critical,
    total_float: a.total_float,
    free_float: a.free_float,
    required_labour: a.required_labour,
  }));

  const ganttLinks = dependencies.map((d) => ({
    id: d.id,
    source: d.predecessor_id,
    target: d.successor_id,
    type: d.dependency_type,
    lag: d.lag_days,
    source_name: d.predecessor_name || '',
    target_name: d.successor_name || '',
  }));

  const floors = Array.from(new Set(activities.map((a) => a.floor))).sort((a, b) => a - b);
  const phases = Array.from(new Set(activities.map((a) => a.phase))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Action & Sub-Tabs Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">PLANNING & SCHEDULING ENGINE</h1>
          <p className="text-xs text-slate-500">
            Activity Work-Breakdown, CPM Critical Path Forward/Backward Pass & Interactive Gantt
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSubTab('validation')}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              subTab === 'validation'
                ? 'bg-brand-600 text-white border-brand-500 shadow-brand-500/20'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>PM Section Validation</span>
            {activities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length > 0 && (
              <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-400">
                {activities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={onOpenAutoPlan}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all"
          >
            <Wand2 className="w-4 h-4" />
            <span>Auto Plan Engine</span>
          </button>

          <button
            onClick={onOpenAddActivity}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-brand-400" />
            <span>Add Activity</span>
          </button>

          <button
            onClick={handleRecalculateCPM}
            disabled={isRescheduling}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isRescheduling ? 'animate-spin' : ''}`} />
            <span>Run CPM Schedule</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'activities', label: 'Activities Hierarchy', icon: Layers, count: activities.length },
          {
            id: 'validation',
            label: 'PM Section Validation (YES/NO)',
            icon: ShieldCheck,
            count: activities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length,
          },
          { id: 'gantt', label: 'Interactive Gantt Chart', icon: CalendarDays },
          { id: 'dependencies', label: 'Dependency Graph & Logic', icon: Network, count: dependencies.length },
          {
            id: 'critical',
            label: 'Critical Path Analysis',
            icon: AlertTriangle,
            count: activities.filter((a) => a.is_critical).length,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-brand-500 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Activities Table */}
      {subTab === 'activities' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search activities or package..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-500 w-64"
                />
              </div>

              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none"
              >
                <option value="all">All Floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? 'Ground / Substructure' : `Floor ${f}`}
                  </option>
                ))}
              </select>

              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none"
              >
                <option value="all">All Phases</option>
                {phases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCriticalOnly(!criticalOnly)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  criticalOnly
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-200'
                }`}
              >
                Zero Float (Critical Only)
              </button>
            </div>

            <div className="text-slate-500 font-mono text-[11px]">
              Showing {filteredActivities.length} of {activities.length} activities
            </div>
          </div>

          {/* Stage Site Engineers Overview Strip */}
          {project.stage_engineers && Object.keys(project.stage_engineers).length > 0 && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
                  <HardHat className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-800">
                    {selectedPhase !== 'all' ? `${selectedPhase} Site Engineers:` : 'Project Stage Site Engineers:'}
                  </span>
                  <span className="text-slate-600 ml-1.5">
                    {selectedPhase !== 'all'
                      ? (project.stage_engineers[selectedPhase]?.length
                          ? project.stage_engineers[selectedPhase].join(' • ')
                          : 'No engineers assigned for this stage')
                      : `${Object.values(project.stage_engineers).reduce((sum, list) => sum + (list?.length || 0), 0)} engineers assigned across stages`}
                  </span>
                </div>
              </div>

              {selectedPhase === 'all' && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(project.stage_engineers).map(([stg, list]) => (
                    <span
                      key={stg}
                      onClick={() => setSelectedPhase(stg)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-all border font-medium ${
                        list.length > 0
                          ? 'bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-800 border-slate-200 hover:border-brand-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                      }`}
                    >
                      {stg}: <span className="font-bold">{list.length}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activities Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Code / ID</th>
                    <th className="py-3 px-4">Activity Name</th>
                    <th className="py-3 px-3">Phase / Package</th>
                    <th className="py-3 px-3">Tower / Floor</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Dates (CPM)</th>
                    <th className="py-3 px-3">Progress</th>
                    <th className="py-3 px-3">Float (TF/FF)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Delay Risk</th>
                    <th className="py-3 px-3 text-center">PM Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredActivities.map((a) => (
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        a.is_critical ? 'bg-rose-500/[0.02]' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{a.code || `ACT-${a.id}`}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {a.is_critical && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                          )}
                          {a.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Qty: {a.quantity} {a.unit} • Labour: {a.required_labour} workers
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 text-[10px]">
                          {a.phase}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {a.tower} • {a.floor === 0 ? 'Ground' : `Floor ${a.floor}`}
                      </td>
                      <td className="py-3 px-3 font-mono">{a.planned_duration}d</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        <div>{new Date(a.start_date).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">to {new Date(a.end_date).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-20">
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
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {a.is_critical ? (
                          <span className="text-rose-400 font-bold">0d (Crit)</span>
                        ) : (
                          <span className="text-slate-500">
                            {a.total_float}d / {a.free_float}d
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : a.status === 'DELAYED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : a.status === 'IN_PROGRESS'
                              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                              : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {a.delay_risk_score !== undefined ? (
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              a.delay_risk_score > 0.6
                                ? 'text-rose-400'
                                : a.delay_risk_score > 0.3
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {Math.round(a.delay_risk_score * 100)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Normal</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {a.validation_status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            YES (Approved)
                          </span>
                        ) : a.validation_status === 'REJECTED' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                            title={a.validation_notes || 'Rejected by PM'}
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            NO (Rejected)
                          </span>
                        ) : (
                          <button
                            onClick={() => setSubTab('validation')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Open PM Section Validation to review"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredActivities.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        No activities found matching criteria. Use 'Auto Plan Engine' or '+ Add Activity'.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Interactive Gantt */}
      {subTab === 'gantt' && (
        <GanttChart tasks={ganttTasks} links={ganttLinks} />
      )}

      {/* Sub-tab 3: Dependencies */}
      {subTab === 'dependencies' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Activity Dependency Graph & Logic</h3>
              <p className="text-xs text-slate-500">
                Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF) links
              </p>
            </div>
            <button
              onClick={() => setShowAddDep(true)}
              className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dependency Link</span>
            </button>
          </div>

          {/* New Dependency Form Modal/Panel */}
          {showAddDep && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Link Predecessor and Successor
                </span>
                <button onClick={() => setShowAddDep(false)} className="text-slate-500 hover:text-white text-xs">
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateDependency} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Predecessor (Prerequisite)</label>
                  <select
                    value={predId}
                    onChange={(e) => setPredId(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.tower} F{a.floor}] {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Successor (Dependent)</label>
                  <select
                    value={succId}
                    onChange={(e) => setSuccId(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.tower} F{a.floor}] {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Dependency Type</label>
                  <select
                    value={depType}
                    onChange={(e) => setDepType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                  >
                    <option value="FS">FS - Finish to Start (Standard)</option>
                    <option value="SS">SS - Start to Start (Parallel Start)</option>
                    <option value="FF">FF - Finish to Finish (Joint Finish)</option>
                    <option value="SF">SF - Start to Finish</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Lag (Days)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={lagDays}
                      onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Dependencies List */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-4">Predecessor</th>
                  <th className="py-3 px-3 text-center">Logic Type</th>
                  <th className="py-3 px-4">Successor</th>
                  <th className="py-3 px-3">Lag Days</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {dependencies.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">{d.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.predecessor_name}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[10px]">
                        {d.dependency_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.successor_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">+{d.lag_days}d lag</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDeleteDependency(d.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Critical Path */}
      {subTab === 'critical' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Critical Path Sequence (Zero Total Float)</h3>
                <p className="text-xs text-rose-300/80">
                  Every activity on this chain dictates the earliest possible project completion date. Any delay directly delays the project handover.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-rose-950 px-3 py-1 rounded-lg border border-rose-500/40 text-rose-300">
              {activities.filter((a) => a.is_critical).length} Critical Activities
            </span>
          </div>

          <div className="space-y-3">
            {activities
              .filter((a) => a.is_critical)
              .map((a, idx) => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl bg-white border border-rose-500/30 shadow-lg flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500 text-rose-400 flex items-center justify-center font-mono font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{a.name}</div>
                      <div className="text-slate-500 text-[11px]">
                        {a.tower} • Floor {a.floor} • {a.phase} • Duration: {a.planned_duration}d
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-slate-800">
                        {new Date(a.start_date).toLocaleDateString()} - {new Date(a.end_date).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-500">Total Float: 0 days (Strict)</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        a.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : a.status === 'DELAYED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-brand-500/20 text-brand-400'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sub-tab 5: PM Section Validation */}
      {subTab === 'validation' && (
        <PMActivitySectionValidation
          project={project}
          activities={activities}
          onRefreshData={onRefreshData}
        />
      )}
    </div>
  );
};
