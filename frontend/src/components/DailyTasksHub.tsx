import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Users,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Truck,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  Building2,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Wrench,
  Sparkles,
  ClipboardList,
  CheckCheck,
  FileText,
  Ruler,
  Boxes,
  Award
} from 'lucide-react';
import { Project, DailyTasksResponse, DailyTaskActivity } from '../types';
import { apiClient } from '../api/client';

interface DailyTasksHubProps {
  project: Project;
  onOpenLogProgress: (activityId?: number) => void;
  onOpenLogHindrance?: (activityId?: number) => void;
  onRefreshData?: () => void;
}

export const DailyTasksHub: React.FC<DailyTasksHubProps> = ({
  project,
  onOpenLogProgress,
  onOpenLogHindrance,
  onRefreshData,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Defaults to today's date formatted as YYYY-MM-DD
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyTasksResponse | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTower, setSelectedTower] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<number, boolean>>({});

  const fetchDailyTasks = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await apiClient.getActivitiesByDate(project.id, targetDate);
      setData(res);
      // Auto expand the top 5 activities
      if (res.activities && res.activities.length > 0) {
        const initialExpanded: Record<number, boolean> = {};
        res.activities.slice(0, 4).forEach((a: DailyTaskActivity) => {
          initialExpanded[a.id] = true;
        });
        setExpandedActivityIds(initialExpanded);
      }
    } catch (err) {
      console.error('Failed to fetch daily tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyTasks(selectedDate);
  }, [project.id, selectedDate]);

  const toggleExpand = (id: number) => {
    setExpandedActivityIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDateOffset = (offsetDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    const newDateStr = current.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
  };

  const setDateToToday = () => {
    const now = new Date();
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  const setDateToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  };

  // Completion date determination
  const projectCompletionDate = useMemo(() => {
    if (data?.completion_date) {
      return data.completion_date.split('T')[0];
    }
    if (project.target_completion_date) {
      return project.target_completion_date.split('T')[0];
    }
    return '2028-11-29';
  }, [project, data]);

  // Check if selected date is after completion date of project
  const isSelectedDateAfterCompletion = useMemo(() => {
    if (data?.is_project_completed === true) return true;
    if (!selectedDate || !projectCompletionDate) return false;
    if (selectedDate > projectCompletionDate) return true;
    if (project.status === 'COMPLETED' && selectedDate >= projectCompletionDate) return true;
    if ((project.overall_progress || 0) >= 100 && selectedDate >= projectCompletionDate) return true;
    return false;
  }, [selectedDate, projectCompletionDate, data, project.status, project.overall_progress]);

  // Filter activities based on user selections
  const filteredActivities = (data?.activities || []).filter((act) => {
    if (selectedTower !== 'all' && act.tower !== selectedTower) return false;
    if (selectedCategory !== 'all' && act.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = act.name.toLowerCase().includes(q);
      const matchCode = (act.code || '').toLowerCase().includes(q);
      const matchPkg = (act.work_package || '').toLowerCase().includes(q);
      const matchScope = (act.brief_requirements?.work_scope || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchPkg && !matchScope) return false;
    }
    return true;
  });

  // Unique towers for filtering
  const availableTowers = Array.from(
    new Set((data?.activities || []).map((a) => a.tower).filter(Boolean))
  );

  // Aggregate trade muster across filtered activities
  const tradeTotals: Record<string, number> = {};
  filteredActivities.forEach((act) => {
    if (act.labour_requirement?.trades) {
      Object.entries(act.labour_requirement.trades).forEach(([trade, count]) => {
        if (count && count > 0) {
          tradeTotals[trade] = (tradeTotals[trade] || 0) + count;
        }
      });
    }
  });

  const parsedDateObj = new Date(selectedDate);
  const formattedDateString = isNaN(parsedDateObj.getTime())
    ? selectedDate
    : parsedDateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  return (
    <div className="space-y-6">
      {/* 1. Executive Header & Date Controller */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AI Daily Workfront Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {project.name} ({project.code})
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60 uppercase tracking-wider">
                Project Schedule Isolated
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Daily Tasks & Labour Requirements</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Active scheduled daily activities for <strong className="text-slate-200">{project.name}</strong> with
              operational scope, technical tolerances, material requisitions, and trade-wise muster allocation.
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-800/90 p-2 rounded-lg border border-slate-700/80">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDateOffset(-1)}
                className="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                title="Previous Day"
              >
                ◀
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono tabular-nums font-semibold text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => handleDateOffset(1)}
                className="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                title="Next Day"
              >
                ▶
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-700 sm:pl-2 pt-1.5 sm:pt-0">
              <button
                onClick={setDateToToday}
                className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition-colors"
              >
                Today
              </button>
              <button
                onClick={setDateToTomorrow}
                className="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold transition-colors"
              >
                Tomorrow
              </button>
              <button
                onClick={() => fetchDailyTasks(selectedDate)}
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                title="Refresh Schedule"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Date Notice & Status */}
        <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="font-medium text-slate-300">Schedule Active Date:</span>
            <span className="font-mono tabular-nums font-semibold text-amber-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {formattedDateString}
            </span>
          </div>

          {data?.notice_message && (
            <div className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{data.notice_message}</span>
            </div>
          )}
        </div>

        {isSelectedDateAfterCompletion && (
          <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="text-white font-bold">Project is Completed:</strong> The project reached 100% completion and was handed over on {projectCompletionDate}. Selected date ({selectedDate}) is post-completion with zero active construction.
              </div>
            </div>
            <button
              onClick={() => setSelectedDate(projectCompletionDate)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shrink-0 self-start sm:self-auto"
            >
              Go to Handover Date ({projectCompletionDate})
            </button>
          </div>
        )}
      </div>

      {/* 2. Key KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="enterprise-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Daily Tasks</span>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {data?.total_activities || 0}
            </div>
            <span className="text-[11px] text-slate-500">Scheduled on date</span>
          </div>
        </div>

        <div className="enterprise-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Labour Muster</span>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-0.5">
              {data?.total_labour_required || 0}
            </div>
            <span className="text-[11px] text-slate-500">Headcount required</span>
          </div>
        </div>

        <div className="enterprise-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Plant & Machinery</span>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {data?.total_equipment_deployed || 0}
            </div>
            <span className="text-[11px] text-slate-500">Equipment units</span>
          </div>
        </div>

        <div className="enterprise-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Control</span>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
              {data?.in_control_count || 0}
            </div>
            <span className="text-[11px] text-slate-500">On scheduled pace</span>
          </div>
        </div>

        <div className="enterprise-card p-4 flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Risky / Delayed</span>
            <div className="text-xl font-bold font-mono tabular-nums text-rose-700 mt-0.5">
              {(data?.risky_count || 0) + (data?.delayed_count || 0)}
            </div>
            <span className="text-[11px] text-slate-500">
              {data?.risky_count || 0} risky • {data?.delayed_count || 0} delayed
            </span>
          </div>
        </div>
      </div>

      {/* 3. Trade-Wise Labour Muster Summary Bar */}
      {Object.keys(tradeTotals).length > 0 && (
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardHat className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Daily Trade-Wise Labour Allocation Muster
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
              Total Required: {Object.values(tradeTotals).reduce((a, b) => a + b, 0)} Crew
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tradeTotals).map(([trade, count]) => {
              const tradeLabels: Record<string, string> = {
                bar_benders: 'Bar Benders',
                carpenters: 'Carpenters & Shuttering',
                masons: 'Masons',
                helpers: 'General Labour',
                operators: 'Plant & Rig Operators',
                supervisors: 'Site Supervisors',
                electricians: 'Electricians & MEP',
              };
              const label = tradeLabels[trade] || trade.replace(/_/g, ' ');
              return (
                <div
                  key={trade}
                  className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs"
                >
                  <span className="text-slate-600 font-medium">{label}:</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200/80 text-[11px]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 enterprise-card p-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search daily activities by name, code, work package, or specifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableTowers.length > 1 && (
            <select
              value={selectedTower}
              onChange={(e) => setSelectedTower(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Towers</option>
              {availableTowers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Health Categories</option>
            <option value="IN_CONTROL">In Control Only</option>
            <option value="RISKY">Risky Only</option>
            <option value="DELAYED">Delayed Only</option>
          </select>

          <span className="text-xs text-slate-500 font-medium pl-1">
            Showing <strong className="text-slate-900 font-semibold">{filteredActivities.length}</strong> tasks
          </span>
        </div>
      </div>

      {/* 5. Every Daily Activity List */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3 enterprise-card">
          <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
          <span className="font-medium text-slate-600">Loading daily workfronts and operational requirements...</span>
        </div>
      ) : isSelectedDateAfterCompletion ? (
        <div className="space-y-6">
          {/* Completion Hero Card */}
          <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 text-white shadow-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    PROJECT IS 100% COMPLETED
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
                    Inspected Date: {selectedDate}
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>Project is Completed</span>
                  <Award className="w-6 h-6 text-emerald-400" />
                </h2>

                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  The contractual construction lifecycle for <strong className="text-white">{project.name}</strong> ({project.code}) reached 100% completion on <strong className="text-emerald-400 font-mono">{new Date(projectCompletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Even when selecting any date after project completion ({selectedDate}), all civil works, structural casting, architectural finishes, and statutory occupancy handovers remain successfully completed.
                </p>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/30 text-center shrink-0 min-w-[200px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Project Status
                </span>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  100.0%
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Handover: {projectCompletionDate}
                </span>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Possession Handed Over</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Architectural / Structural Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Substructure & Raft</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold font-mono text-emerald-700">100% Certified</div>
              <p className="text-[11px] text-slate-500">Excavation, retaining shoring & foundation raft complete.</p>
            </div>

            <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Superstructure RCC</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold font-mono text-emerald-700">All Floors Cast</div>
              <p className="text-[11px] text-slate-500">All residential and podium floors cast and cured.</p>
            </div>

            <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">MEP & Finishes</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold font-mono text-emerald-700">100% Commissioned</div>
              <p className="text-[11px] text-slate-500">Electrical, plumbing, facades & elevators energised.</p>
            </div>

            <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Handover & Statutory OC</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base font-bold font-mono text-emerald-700">Occupancy Granted</div>
              <p className="text-[11px] text-slate-500">Fire NOC and Occupancy Certificate issued.</p>
            </div>
          </div>

          {/* Operational Status */}
          <div className="enterprise-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-900 block">No Active Construction Tasks on {selectedDate}</span>
              <span className="text-xs text-slate-500">Project is currently in Defect Liability Period (DLP) & Facilities custody.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(projectCompletionDate)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Go to Handover Date ({projectCompletionDate})</span>
              </button>
              <button
                onClick={setDateToToday}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <span>Return to Today</span>
              </button>
            </div>
          </div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs enterprise-card space-y-2">
          <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-semibold text-slate-800 text-sm">No activities matched the current search or filters.</p>
          <p className="text-slate-500">Adjust your filter parameters or choose a different date from the controller above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((act) => {
            const isExpanded = !!expandedActivityIds[act.id];

            const categoryBadge =
              act.category === 'IN_CONTROL' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  IN CONTROL
                </span>
              ) : act.category === 'RISKY' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                  RISKY (DELAY ALERT)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                  DELAYED PACE
                </span>
              );

            return (
              <div
                key={act.id}
                className={`enterprise-card overflow-hidden transition-all duration-150 ${
                  act.category === 'RISKY'
                    ? 'border-rose-200/90'
                    : act.category === 'DELAYED'
                    ? 'border-amber-200/90'
                    : 'border-slate-200'
                }`}
              >
                {/* Activity Card Header */}
                <div
                  onClick={() => toggleExpand(act.id)}
                  className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryBadge}
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                        {act.code || `ACT-${act.id}`}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60 text-[11px] font-medium">
                        {act.tower} • Floor {act.floor}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-normal">
                        {act.phase}
                      </span>
                      {act.is_critical && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider">
                          Critical Path (0 Float)
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>{act.name}</span>
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {act.brief_requirements?.work_scope || act.work_package}
                    </p>
                  </div>

                  {/* Progress & Quick Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right space-y-1 min-w-[120px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Progress:</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">{act.progress_percent}%</span>
                      </div>
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${Math.min(100, act.progress_percent)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Planned: <span className="font-mono tabular-nums">{act.planned_progress_percent}%</span>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5 min-w-[90px] pl-3 border-l border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Crew</span>
                      <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {act.labour_requirement?.total_headcount || 8} <span className="text-xs font-normal text-slate-500">workers</span>
                      </div>
                    </div>

                    <button
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand Details'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-700" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Brief Requirements & Labour Breakdown */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 bg-slate-50/40 space-y-4">
                    {/* Risk & Blocker Alert (if any) */}
                    {(act.category === 'RISKY' || act.category === 'DELAYED' || act.blockers_count > 0) && (
                      <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200/90 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-semibold text-rose-900">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Active Site Risk Factors & Blockers:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-rose-800 pl-1 text-[11px]">
                          {act.risk_factors.map((rf, idx) => (
                            <li key={idx}>{rf}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Dual Cards: Brief Requirements & Labour Requirements */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left Card: Brief Requirements */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <ClipboardList className="w-4 h-4 text-slate-700" />
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Operational Requirements
                          </h4>
                        </div>

                        {/* Work Scope */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Execution Scope</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-200/70 font-normal">
                            {act.brief_requirements?.work_scope}
                          </p>
                        </div>

                        {/* Technical Specifications */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                            <Ruler className="w-3.5 h-3.5 text-slate-500" />
                            <span>Technical Specifications & Tolerances</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-200/70 font-mono text-[11px]">
                            {act.brief_requirements?.technical_specifications}
                          </p>
                        </div>

                        {/* Required Materials */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                            <Boxes className="w-3.5 h-3.5 text-slate-500" />
                            <span>Material Requisition & Specifications</span>
                          </div>
                          <p className="text-slate-800 font-medium bg-slate-50 border border-slate-200/70 p-2.5 rounded-md text-[11px]">
                            {act.brief_requirements?.material_requirements}
                          </p>
                        </div>

                        {/* Plant & Equipment */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                            <Truck className="w-3.5 h-3.5 text-slate-500" />
                            <span>Plant & Heavy Machinery Deployed</span>
                          </div>
                          <p className="text-slate-800 font-medium bg-slate-50 border border-slate-200/70 p-2.5 rounded-md text-[11px]">
                            {act.brief_requirements?.equipment_requirements}
                          </p>
                        </div>

                        {/* Quality & Safety Checkpoints */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                            <span>Quality Assurance & Safety Gate</span>
                          </div>
                          <p className="text-slate-700 bg-slate-50 border border-slate-200/70 p-2.5 rounded-md text-[11px] leading-relaxed">
                            {act.brief_requirements?.safety_and_quality}
                          </p>
                        </div>
                      </div>

                      {/* Right Card: Labour Requirements & Trade Muster */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-700" />
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                Daily Labour Muster & Trades
                              </h4>
                            </div>
                            <span className="px-2 py-0.5 rounded font-mono tabular-nums font-semibold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                              {act.labour_requirement?.total_headcount || 8} Total Crew
                            </span>
                          </div>

                          {/* Shift & Muster Info */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/70">
                              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Shift Window</span>
                              <span className="font-medium text-slate-800">
                                {act.labour_requirement?.shift || 'General Day Shift (08:00 - 17:00)'}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/70">
                              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Muster Status</span>
                              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                {act.labour_requirement?.muster_status || 'ALLOCATED & READY'}
                              </span>
                            </div>
                          </div>

                          {/* Trade Breakdown Grid */}
                          <div className="space-y-1.5">
                            <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide block">
                              Trade-Wise Allocation
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {Object.entries(act.labour_requirement?.trades || {}).map(([trade, count]) => {
                                const tradeLabels: Record<string, string> = {
                                  bar_benders: 'Bar Benders',
                                  carpenters: 'Carpenters',
                                  masons: 'Masons',
                                  helpers: 'Helpers',
                                  operators: 'Operators',
                                  supervisors: 'Supervisor',
                                  electricians: 'Electricians',
                                };
                                const label = tradeLabels[trade] || trade.replace(/_/g, ' ');
                                return (
                                  <div
                                    key={trade}
                                    className="p-2 rounded-md bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between"
                                  >
                                    <span className="text-slate-600 font-medium capitalize">{label}:</span>
                                    <span className="font-mono tabular-nums font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                      {count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Workfront Schedule Details */}
                          <div className="p-3 rounded-md bg-slate-50 border border-slate-200/70 space-y-1 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Scheduled Duration:</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-800">
                                {new Date(act.start_date).toLocaleDateString()} → {new Date(act.end_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Total CPM Float:</span>
                              <span className={`font-mono tabular-nums font-semibold ${act.total_float <= 2 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {act.total_float} days buffer
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Assigned Governance Tier:</span>
                              <span className="font-semibold text-slate-800">{act.assigned_role || 'Site Manager'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                          {onOpenLogHindrance && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenLogHindrance(act.id);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Log Hindrance</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLogProgress(act.id);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Log Today's Progress</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
