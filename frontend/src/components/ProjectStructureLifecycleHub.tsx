import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  HardHat,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  XCircle,
  Truck,
  ShieldAlert,
  FileText,
  Ruler,
  Boxes,
  Network,
  Activity as ActivityIcon,
  Flame,
  Award,
  Zap,
  CheckSquare,
  FileCheck,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { Project, Activity, ActivityDependency, DailyTasksResponse, DailyTaskActivity, CompletionForecast, User } from '../types';
import { apiClient } from '../api/client';
import { compareActivitiesByBaseline, getBriefActivityExplanation } from '../utils/activityPresentation';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ProjectStructureLifecycleHubProps {
  project: Project;
  activities: Activity[];
  dependencies: ActivityDependency[];
  forecast?: CompletionForecast | null;
  currentUser?: User | null;
  onOpenLogProgress?: (activityId?: number) => void;
  onOpenLogHindrance?: (activityId?: number) => void;
  onRefreshData?: () => void;
  lastUpdatedAt?: Date | null;
  isRefreshError?: boolean;
  isRefreshing?: boolean;
}

interface DateSpanProps {
  start?: string | null;
  end?: string | null;
  emphasis: 'baseline' | 'live' | 'actual';
}

const formatScheduleDate = (value?: string | null) => {
  if (!value) return 'Not recorded';
  return new Date(`${value.split('T')[0]}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DateSpan: React.FC<DateSpanProps> = ({ start, end, emphasis }) => {
  const styles = emphasis === 'baseline'
    ? { label: 'Baseline', color: 'text-amber-800' }
    : emphasis === 'live'
      ? { label: 'Live plan', color: 'text-slate-800' }
      : { label: 'Actual', color: 'text-emerald-800' };

  return (
    <div className={`space-y-1 ${styles.color}`}>
      <div className="text-[9px] font-sans font-bold uppercase tracking-wide">{styles.label}</div>
      <div className="whitespace-nowrap text-[11px] font-semibold">
        <time dateTime={start || undefined}>{formatScheduleDate(start)}</time>
        <span className="mx-1 text-slate-400">→</span>
        <time dateTime={end || undefined}>{formatScheduleDate(end)}</time>
      </div>
    </div>
  );
};

interface DependencyListProps {
  title: string;
  dependencies: ActivityDependency[];
  activityNameById: Map<number, string>;
  activityIdKey: 'predecessor_id' | 'successor_id';
}

const DependencyList: React.FC<DependencyListProps> = ({
  title,
  dependencies,
  activityNameById,
  activityIdKey,
}) => {
  if (dependencies.length === 0) return null;
  const shownDependencies = dependencies.slice(0, 2);

  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-0.5 space-y-1">
        {shownDependencies.map((dependency) => {
          const activityId = dependency[activityIdKey];
          const activityName = activityNameById.get(activityId) || `Activity ${activityId}`;
          const lag = dependency.lag_days ? ` · ${dependency.lag_days > 0 ? '+' : ''}${dependency.lag_days}d lag` : '';
          return (
            <div
              key={`${dependency.id}-${activityIdKey}`}
              className="max-w-64 truncate text-[10px] font-medium text-slate-700"
              title={`${activityName} · ${dependency.dependency_type}${lag}`}
            >
              {activityName}
              <span className="ml-1 text-slate-400">{dependency.dependency_type}{lag}</span>
            </div>
          );
        })}
        {dependencies.length > shownDependencies.length && (
          <div className="text-[10px] font-medium text-slate-500">
            +{dependencies.length - shownDependencies.length} additional links
          </div>
        )}
      </div>
    </div>
  );
};

export const ProjectStructureLifecycleHub: React.FC<ProjectStructureLifecycleHubProps> = ({
  project,
  activities,
  dependencies,
  forecast,
  currentUser,
  onOpenLogProgress,
  onOpenLogHindrance,
  onRefreshData,
  lastUpdatedAt,
  isRefreshError = false,
  isRefreshing = false,
}) => {
  // Navigation tabs within lifecycle hub
  const [activeTab, setActiveTab] = useState<'overview' | 'sequential' | 'parallel' | 'handover-roadmap' | 'daily-inspector'>('sequential');

  // Sub-filter within Sequential view: Excavation vs Construction vs Validation
  const [sequencePhase, setSequencePhase] = useState<'all' | 'excavation' | 'construction' | 'validation'>('all');

  // Dynamic Date Inspector state
  const [inspectedDate, setInspectedDate] = useState<string>(() => {
    return getLocalDateString();
  });
  const [dailyData, setDailyData] = useState<DailyTasksResponse | null>(null);
  const [loadingDaily, setLoadingDaily] = useState<boolean>(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [expandedDailyIds, setExpandedDailyIds] = useState<Record<number, boolean>>({});
  const dailyRequestId = useRef(0);

  // Filter & Search states
  const [search, setSearch] = useState<string>('');
  const [selectedTower, setSelectedTower] = useState<string>('all');
  // Selected parallel activity inspection
  const [inspectedParallelActId, setInspectedParallelActId] = useState<number | null>(null);

  // 1. Strictly isolate activities to current project
  const projectActivities = useMemo(() => {
    return activities.filter((a) => a.project_id === project.id);
  }, [activities, project.id]);
  const projectTowers = useMemo(
    () => [...new Set(projectActivities.map((activity) => activity.tower).filter(Boolean))].sort(),
    [projectActivities]
  );
  const projectDependencies = useMemo(
    () => dependencies.filter((dependency) => dependency.project_id === project.id),
    [dependencies, project.id]
  );
  const activityNameById = useMemo(
    () => new Map(projectActivities.map((activity) => [activity.id, activity.name])),
    [projectActivities]
  );
  const activityFlow = useMemo(() => {
    const flow = new Map<number, { predecessors: ActivityDependency[]; successors: ActivityDependency[] }>();
    projectDependencies.forEach((dependency) => {
      const predecessorFlow = flow.get(dependency.predecessor_id) || { predecessors: [], successors: [] };
      predecessorFlow.successors.push(dependency);
      flow.set(dependency.predecessor_id, predecessorFlow);

      const successorFlow = flow.get(dependency.successor_id) || { predecessors: [], successors: [] };
      successorFlow.predecessors.push(dependency);
      flow.set(dependency.successor_id, successorFlow);
    });
    return flow;
  }, [projectDependencies]);

  // 2. Fetch daily activities dynamically whenever inspectedDate changes
  const fetchDailyActivities = useCallback(async (targetDate: string) => {
    const requestId = ++dailyRequestId.current;
    setLoadingDaily(true);
    setDailyError(null);
    setDailyData(null);
    try {
      const res = await apiClient.getActivitiesByDate(project.id, targetDate);
      if (requestId !== dailyRequestId.current) return;
      setDailyData(res);
      // Auto expand first 3 activities
      if (res.activities && res.activities.length > 0) {
        const initialExp: Record<number, boolean> = {};
        res.activities.slice(0, 3).forEach((a: DailyTaskActivity) => {
          initialExp[a.id] = true;
        });
        setExpandedDailyIds(initialExp);
      }
    } catch (err: any) {
      if (requestId !== dailyRequestId.current) return;
      console.error('Failed to dynamically load day activities:', err);
      setDailyError(err.response?.data?.detail || 'Failed to query dynamic activities for this date.');
    } finally {
      if (requestId === dailyRequestId.current) setLoadingDaily(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (activeTab !== 'daily-inspector') return;
    void fetchDailyActivities(inspectedDate);
    return () => {
      dailyRequestId.current += 1;
    };
  }, [activeTab, fetchDailyActivities, inspectedDate]);

  useEffect(() => {
    if (activeTab === 'daily-inspector') {
      document.getElementById('dynamic-date-inspector-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [activeTab]);

  // Handler when user clicks ANY date across the UI
  const handleSelectDate = (dateStr: string) => {
    if (!dateStr) return;
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    setInspectedDate(cleanDate);
    setActiveTab('daily-inspector');
  };

  const toggleDailyExpand = (id: number) => {
    setExpandedDailyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 3. Compute Structural Progress Breakdown
  const structuralMetrics = useMemo(() => {
    const progressFor = (items: Activity[]) => ({
      total: items.length,
      completed: items.filter((activity) => activity.status === 'COMPLETED').length,
      percent: items.length
        ? Math.round(items.reduce((sum, activity) => sum + (activity.progress_percent || 0), 0) / items.length)
        : 0,
    });

    const excavationActs = projectActivities.filter((a) => {
      const n = a.name.toUpperCase();
      return n.includes('EXCAVATION') || n.includes('MOBILIZATION') || n.includes('SHORING') || n.includes('DEWATER');
    });

    const substructureActs = projectActivities.filter((a) => {
      const n = a.name.toUpperCase();
      const p = (a.phase || '').toUpperCase();
      return p.includes('SUBSTRUCTURE') || n.includes('SUB- STRUCTURE') || n.includes('BASEMENT') || n.includes('PODIUM') || n.includes('STILT');
    });

    const slabActs = projectActivities.filter((a) => {
      const n = a.name.toUpperCase();
      return (a.phase || '').toUpperCase().includes('SUPERSTRUCTURE') || n.includes('SLAB') || n.includes('ALUFORM') || n.includes('TERRACE');
    });

    const finishingActs = projectActivities.filter((a) => {
      const p = (a.phase || '').toUpperCase();
      const n = a.name.toUpperCase();
      return p.includes('FINISHING') || p.includes('MEP') || n.includes('PLASTER') || n.includes('BLOCKWORK') || n.includes('TILING') || n.includes('ELECTRICAL') || n.includes('PLUMBING');
    });

    const validationActs = projectActivities.filter((a) => {
      const n = a.name.toUpperCase();
      return (a.phase || '').toUpperCase().includes('HANDOVER') || n.includes('NOC') || n.includes('SNAGGING');
    });

    const activeActivity = projectActivities
      .filter((activity) => activity.status === 'IN_PROGRESS')
      .sort((a, b) => Number(b.is_critical) - Number(a.is_critical) || b.floor - a.floor)[0];
    const completedFloors = projectActivities
      .filter((activity) => activity.status === 'COMPLETED' && activity.floor > 0)
      .map((activity) => activity.floor);

    return {
      overall: project.overall_progress ?? progressFor(projectActivities).percent,
      excavation: progressFor(excavationActs),
      substructure: progressFor(substructureActs),
      superstructure: progressFor(slabActs),
      finishing: progressFor(finishingActs),
      validation: progressFor(validationActs),
      totalFloors: project.num_floors || 0,
      castFloors: completedFloors.length ? Math.max(...completedFloors) : 0,
      towers: project.num_towers || 0,
      activeLevel: activeActivity
        ? `${activeActivity.tower} • Floor ${activeActivity.floor} • ${activeActivity.name}`
        : 'No activity currently in progress',
    };
  }, [projectActivities, project]);

  // 4. Categorize Activities into Strict Sequence
  const sequenceData = useMemo(() => {
    const excavation: Activity[] = [];
    const construction: Activity[] = [];
    const validation: Activity[] = [];

    projectActivities.forEach((a) => {
      const name = a.name.toUpperCase();
      const phase = (a.phase || '').toUpperCase();
      const pkg = (a.work_package || '').toUpperCase();

      // Check if Validation
      if (
        phase.includes('HANDOVER') ||
        name.includes("NOC'S") ||
        name.includes('SNAGGING') ||
        name.includes('CLEANING') ||
        name.includes('COMMISSIONING') ||
        name.includes('VALIDATION') ||
        name.includes('TESTING') ||
        pkg.includes('CLEARANCE') ||
        pkg.includes('COMMISSIONING') ||
        pkg.includes('TESTING')
      ) {
        validation.push(a);
      }
      // Check if Excavation
      else if (
        phase === 'PRE-CONSTRUCTION' ||
        name.includes('EXCAVATION') ||
        name.includes('MOBILIZATION') ||
        name.includes('SHORING') ||
        name.includes('DEWATERING') ||
        name.includes('ROCK BREAK') ||
        name.includes('STRATA') ||
        name.includes('PCC') ||
        name.includes('RAFT')
      ) {
        excavation.push(a);
      }
      // Everything else is Construction
      else {
        construction.push(a);
      }
    });

    return {
      excavation: excavation.sort(compareActivitiesByBaseline),
      construction: construction.sort(compareActivitiesByBaseline),
      validation: validation.sort(compareActivitiesByBaseline),
    };
  }, [projectActivities]);

  // Filtered sequential activities based on sequencePhase and search
  const filteredSequenceActivities = useMemo(() => {
    let list: Activity[] = [];
    if (sequencePhase === 'all') {
      list = [...projectActivities].sort(compareActivitiesByBaseline);
    } else if (sequencePhase === 'excavation') {
      list = sequenceData.excavation;
    } else if (sequencePhase === 'construction') {
      list = sequenceData.construction;
    } else {
      list = sequenceData.validation;
    }

    if (!search.trim() && selectedTower === 'all') return list;

    return list.filter((a) => {
      if (selectedTower !== 'all' && a.tower !== selectedTower) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          (a.code || '').toLowerCase().includes(q) ||
          (a.work_package || '').toLowerCase().includes(q) ||
          (a.phase || '').toLowerCase().includes(q) ||
          (a.tower || '').toLowerCase().includes(q) ||
          (a.subcategory || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projectActivities, sequenceData, sequencePhase, search, selectedTower]);

  // 5. Parallel Concurrency Engine: Find all activities that overlap in time
  const parallelConcurrencyGroups = useMemo(() => {
    const validActs = projectActivities.filter((a) => a.start_date && a.end_date);
    if (validActs.length === 0) return [];

    // Map each activity to its overlapping parallel activities
    const parallelMap: Array<{
      activity: Activity;
      overlappingCount: number;
      parallelPartners: Activity[];
      spanDescription: string;
    }> = [];

    validActs.forEach((act) => {
      const actStart = act.actual_start_date || act.start_date;
      const actEnd = act.actual_end_date || act.end_date;

      const partners = validActs.filter((other) => {
        if (other.id === act.id) return false;
        const otherStart = other.actual_start_date || other.start_date;
        const otherEnd = other.actual_end_date || other.end_date;
        // Overlap condition
        return actStart <= otherEnd && otherStart <= actEnd;
      });

      parallelMap.push({
        activity: act,
        overlappingCount: partners.length,
        parallelPartners: partners,
        spanDescription: `${new Date(actStart).toLocaleDateString('en-GB')} → ${new Date(actEnd).toLocaleDateString('en-GB')}`,
      });
    });

    // Sort by most parallel activities first
    return parallelMap.sort((a, b) => b.overlappingCount - a.overlappingCount);
  }, [projectActivities]);

  // Keep the imported PDF baseline separate from the live schedule forecast.
  const scheduledFinishDate = projectActivities
    .map((activity) => activity.end_date)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const baselineStartDate = projectActivities
    .map((activity) => activity.baseline_start_date)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const baselineFinishDate = projectActivities
    .map((activity) => activity.baseline_end_date)
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse()[0];
  const handoverDate = project.target_completion_date;
  const startDate = projectActivities
    .map((activity) => activity.baseline_start_date || activity.start_date)
    .filter(Boolean)
    .sort()[0] || project.planned_start_date;
  const quickSelectActivities = useMemo(() => {
    const chronological = [...projectActivities].sort(compareActivitiesByBaseline);
    const sampleCount = Math.min(7, chronological.length);
    return Array.from({ length: sampleCount }, (_, index) =>
      chronological[Math.round(index * (chronological.length - 1) / Math.max(1, sampleCount - 1))]
    ).filter((activity, index, list) => list.findIndex((item) => item.id === activity.id) === index);
  }, [projectActivities]);

  const projectCompletionDate = useMemo(() => {
    if (dailyData?.completion_date) {
      return dailyData.completion_date.split('T')[0];
    }
    if (project.status !== 'COMPLETED') return '';
    const actualEndDates = projectActivities
      .filter((activity) => activity.status === 'COMPLETED')
      .map((activity) => activity.actual_end_date)
      .filter(Boolean)
      .sort()
      .reverse();
    return actualEndDates[0]?.split('T')[0] || '';
  }, [dailyData, project.status, projectActivities]);

  // Check if inspected date is strictly after project completion date
  const isInspectedDateAfterCompletion = useMemo(() => {
    if (dailyData?.is_project_completed === true) return true;
    if (!inspectedDate || !projectCompletionDate) return false;
    if (inspectedDate > projectCompletionDate) return true;
    if (project.status === 'COMPLETED' && inspectedDate >= projectCompletionDate) return true;
    if ((project.overall_progress || 0) >= 100 && inspectedDate >= projectCompletionDate) return true;
    return false;
  }, [inspectedDate, projectCompletionDate, dailyData, project.status, project.overall_progress]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. STRUCTURAL PROGRESS OF STRUCTURE (FIRST SECTION UPON CLICKING PROJECT) */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-stone-800 bg-stone-900 p-6 text-white shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-stone-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-300" />
                Structural Intelligence & Lifecycle
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-stone-800 text-stone-300 border border-stone-700 uppercase tracking-wider">
                {project.code} • {project.construction_type}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-stone-800/80 text-stone-400 border border-stone-700/60 uppercase tracking-wider">
                {structuralMetrics.towers} Towers • {structuralMetrics.totalFloors} Floors + Terrace
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                isRefreshError
                  ? 'border-rose-700/60 bg-rose-950/70 text-rose-300'
                  : 'border-emerald-800/60 bg-emerald-950/70 text-emerald-300'
              }`} title="Project data refreshes every 30 seconds">
                <span className={`h-1.5 w-1.5 rounded-full ${isRefreshError ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                {isRefreshError ? 'Refresh issue' : 'Live tracking · 30 sec'}
                {lastUpdatedAt && ` · ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
              <button
                type="button"
                onClick={() => onRefreshData?.()}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200 transition hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing…' : 'Refresh'}
              </button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{project.name}</span>
            </h1>
            <p className="text-xs text-stone-400 mt-1 max-w-3xl leading-relaxed">
              Structural scope: <strong className="text-stone-200">{structuralMetrics.towers} towers and {structuralMetrics.totalFloors} planned floors</strong>.
              Current workfront: <strong className="text-amber-300 font-mono">{structuralMetrics.activeLevel}</strong>.
            </p>
            {isInspectedDateAfterCompletion && (
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Notice: Inspected date ({inspectedDate}) is after completion date ({projectCompletionDate}) — Project is Completed!</span>
              </div>
            )}
          </div>

          {/* Handover & Overall Metrics Badge */}
          <div className="flex flex-wrap items-center gap-4 bg-stone-800/80 p-3.5 rounded-xl border border-stone-700 shrink-0">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 block">
                Overall Structural Progress
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-300 mt-0.5">
                {structuralMetrics.overall}%
              </div>
              <span className="text-[10px] text-stone-400">
                Highest completed activity floor: {structuralMetrics.castFloors}
              </span>
            </div>

            <div className="border-l border-stone-700 pl-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 block">
                Handover Milestone
              </span>
              <div className="text-sm font-bold font-mono tabular-nums text-emerald-400 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(handoverDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">
                {forecast?.duration_metrics?.remaining_days ? `${forecast.duration_metrics.remaining_days} days to handover` : 'Planned completion'}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Stage Structural Milestone Progress Barometer */}
        <div className="pt-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-300" />
              Structural Milestone Progress Barometer
            </span>
            <span className="text-stone-400 font-mono text-[11px]">
              {projectActivities.length} scheduled activities · Baseline {baselineStartDate || startDate} to {baselineFinishDate || 'not imported'} · Live forecast through {scheduledFinishDate || handoverDate}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* 1. Excavation */}
            <div className="p-3 rounded-lg bg-stone-800/90 border border-stone-700/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-stone-300">1. Excavation</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">{structuralMetrics.excavation.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${structuralMetrics.excavation.percent}%` }} />
              </div>
              <span className="text-[10px] text-stone-400 block truncate">{structuralMetrics.excavation.completed} of {structuralMetrics.excavation.total} activities complete</span>
            </div>

            {/* 2. Substructure */}
            <div className="p-3 rounded-lg bg-stone-800/90 border border-stone-700/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-stone-300">2. Substructure</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">{structuralMetrics.substructure.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${structuralMetrics.substructure.percent}%` }} />
              </div>
              <span className="text-[10px] text-stone-400 block truncate">{structuralMetrics.substructure.completed} of {structuralMetrics.substructure.total} activities complete</span>
            </div>

            {/* 3. Superstructure */}
            <div className="p-3 rounded-lg bg-stone-800/90 border border-amber-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-300">3. Superstructure</span>
                <span className="font-mono tabular-nums font-bold text-amber-300">{structuralMetrics.superstructure.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${structuralMetrics.superstructure.percent}%` }} />
              </div>
              <span className="text-[10px] text-amber-300 block truncate">{structuralMetrics.superstructure.completed} of {structuralMetrics.superstructure.total} activities complete</span>
            </div>

            {/* 4. Finishing & MEP */}
            <div className="p-3 rounded-lg bg-stone-800/90 border border-stone-700/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-stone-300">4. Finishing & MEP</span>
                <span className="font-mono tabular-nums font-bold text-amber-400">{structuralMetrics.finishing.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${structuralMetrics.finishing.percent}%` }} />
              </div>
              <span className="text-[10px] text-stone-400 block truncate">{structuralMetrics.finishing.completed} of {structuralMetrics.finishing.total} activities complete</span>
            </div>

            {/* 5. Validation & Handover */}
            <div className="p-3 rounded-lg bg-stone-800/90 border border-stone-700/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-stone-300">5. Handover QA</span>
                <span className="font-mono tabular-nums font-bold text-stone-300">{structuralMetrics.validation.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                <div className="h-full bg-stone-500 rounded-full" style={{ width: `${structuralMetrics.validation.percent}%` }} />
              </div>
              <span className="text-[10px] text-stone-400 block truncate">{structuralMetrics.validation.completed} of {structuralMetrics.validation.total} activities complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-NAVIGATION: SEQUENTIAL / PARALLEL / HANDOVER / DYNAMIC INSPECTOR */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'overview'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Structure Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('sequential')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'sequential'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sequential Activities (Excavation ➔ Construction ➔ Validation)</span>
            <span className="font-mono tabular-nums text-[10px] bg-stone-200/80 text-stone-700 px-1.5 py-0.2 rounded">
              {projectActivities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('parallel')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'parallel'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Network className="w-4 h-4 text-amber-700" />
            <span>Parallel Activities Plan</span>
            <span className="font-mono tabular-nums text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
              Concurrent
            </span>
          </button>

          <button
            onClick={() => setActiveTab('handover-roadmap')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'handover-roadmap'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Plan Till Handover Date</span>
            <span className="font-mono tabular-nums text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
              {new Date(handoverDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('daily-inspector')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'daily-inspector'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Dynamic Day Inspector</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </button>
        </div>

        {/* Quick Date Click Indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">Inspected Date:</span>
          <button
            onClick={() => handleSelectDate(inspectedDate)}
            className="font-mono tabular-nums font-semibold text-slate-900 bg-white border border-slate-200 hover:border-amber-500 px-2 py-1 rounded shadow-2xs flex items-center gap-1"
          >
            <span>{inspectedDate}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: STRUCTURE OVERVIEW & KEY MILESTONE SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Jump Date Bar across Major Project Epochs */}
          <div className="enterprise-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-700" />
                Quick-Select Milestone Dates to Dynamically Inspect That Day's Activities:
              </span>
              <span className="text-xs text-slate-500">Clicking any date dynamically queries live workfronts</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                ...quickSelectActivities.map((activity) => ({
                  label: activity.code || activity.phase,
                  date: activity.baseline_start_date || activity.start_date,
                  title: activity.name,
                })),
                { label: 'Today', date: getLocalDateString(), title: 'Inspect today' },
                { label: 'Contract handover', date: handoverDate, title: 'Inspect contractual handover target' },
              ].map((m) => (
                <button
                  key={`${m.date}-${m.label}`}
                  onClick={() => handleSelectDate(m.date)}
                  title={m.title}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                    inspectedDate === m.date
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="max-w-40 truncate font-semibold">{m.label}:</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-80">{m.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3 Sequential Cards Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Excavation Activities Card */}
            <div
              onClick={() => {
                setSequencePhase('excavation');
                setActiveTab('sequential');
              }}
              className="enterprise-card p-5 cursor-pointer hover:border-amber-500 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phase 1 of 3
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {structuralMetrics.excavation.percent}% Complete
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 group-hover:text-amber-700 transition-colors">
                  <span>Excavation Activities</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Scheduled activities categorized as excavation and pre-construction work.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono font-semibold">{sequenceData.excavation.length} Activities</span>
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  View Sequence <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Construction Activities Card */}
            <div
              onClick={() => {
                setSequencePhase('construction');
                setActiveTab('sequential');
              }}
              className="enterprise-card p-5 cursor-pointer hover:border-amber-500 transition-all flex flex-col justify-between group border-amber-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Phase 2 of 3
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    {structuralMetrics.overall}% Progress
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 group-hover:text-amber-700 transition-colors">
                  <span>Construction Activities</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Scheduled construction, structural, finishing, and building-services work packages.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono font-semibold">{sequenceData.construction.length} Activities</span>
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  View Floor Sequence <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Validation Activities Card */}
            <div
              onClick={() => {
                setSequencePhase('validation');
                setActiveTab('sequential');
              }}
              className="enterprise-card p-5 cursor-pointer hover:border-amber-500 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phase 3 of 3
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                    {structuralMetrics.validation.percent}% Complete
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 group-hover:text-amber-700 transition-colors">
                  <span>Validation of Activities</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Scheduled handover, inspection, commissioning, and validation activities.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono font-semibold">{sequenceData.validation.length} Activities</span>
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  View Governance Gate <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SEQUENTIAL ACTIVITIES (EXCAVATION ➔ CONSTRUCTION ➔ VALIDATION) */}
      {/* ========================================================================= */}
      {activeTab === 'sequential' && (
        <div className="space-y-5">
          {/* Phase Filter Controller */}
          <div className="enterprise-card space-y-3 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Complete activity sequence</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  All work is ordered by master-baseline start and finish. Activities on overlapping dates remain concurrent, not artificially serialized.
                </p>
              </div>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                {projectActivities.length} activities in complete master plan
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All activities', count: projectActivities.length },
                { id: 'excavation', label: 'Excavation', count: sequenceData.excavation.length },
                { id: 'construction', label: 'Construction', count: sequenceData.construction.length },
                { id: 'validation', label: 'Validation & handover', count: sequenceData.validation.length },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSequencePhase(btn.id as any)}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    sequencePhase === btn.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                    sequencePhase === btn.id ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search activities</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search name, phase, code, or work package"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
                />
              </label>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
                <span>Tower</span>
                <select
                  aria-label="Filter activities by tower"
                  value={selectedTower}
                  onChange={(event) => setSelectedTower(event.target.value)}
                  className="min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500"
                >
                  <option value="all">All towers</option>
                  {projectTowers.map((tower) => <option key={tower} value={tower}>{tower}</option>)}
                </select>
              </label>
              <span className="shrink-0 text-xs tabular-nums text-slate-500" aria-live="polite">
                {filteredSequenceActivities.length} of {projectActivities.length} activities
              </span>
              {(search || selectedTower !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedTower('all');
                  }}
                  className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Sequential Activities Table */}
          <div className="enterprise-card overflow-hidden">
            <div className="border-b border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs leading-relaxed text-amber-950">
              The imported PDF baseline is the planning reference. Live forecasts and actual dates are shown separately; activities sharing a baseline window remain concurrent unless a dependency is recorded.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1760px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="w-24 py-3 px-4">Sequence / WBS</th>
                    <th className="min-w-64 py-3 px-4">Activity & Work Scope</th>
                    <th className="w-44 py-3 px-4">Phase / Package</th>
                    <th className="w-40 py-3 px-4">Work Location</th>
                    <th className="w-56 py-3 px-4">Baseline Start → Finish</th>
                    <th className="w-56 py-3 px-4">Live Start → Finish</th>
                    <th className="w-40 py-3 px-4">Actual Start → Finish</th>
                    <th className="w-36 py-3 px-4">Duration / Quantity</th>
                    <th className="w-40 py-3 px-4">Progress / Status</th>
                    <th className="min-w-56 py-3 px-4">Predecessors / Successors</th>
                    <th className="w-28 py-3 px-4">Inspect Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredSequenceActivities.map((act, index) => {
                    const isExcavation = /\b(excavation|earthwork|dewatering)\b/i.test(
                      [act.name, act.category, act.subcategory, act.work_package].filter(Boolean).join(' ')
                    );
                    const isValidation = act.phase === 'Handover' || act.name.toUpperCase().includes('NOC');
                    const flow = activityFlow.get(act.id) || { predecessors: [], successors: [] };
                    const baselineTaskLabel = act.baseline_task_id != null
                      ? `PDF task ${act.baseline_task_id}`
                      : `Activity ${String(index + 1).padStart(3, '0')}`;

                    return (
                      <tr key={act.id} className="align-top hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                            {String(index + 1).padStart(3, '0')}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold text-slate-500">{baselineTaskLabel}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">{act.name}</span>
                            {isExcavation && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase">
                                Early works
                              </span>
                            )}
                            {isValidation && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 uppercase">
                                Validation
                              </span>
                            )}
                          </div>
                          <div className="mt-1 space-y-0.5 text-[11px] font-normal leading-relaxed text-slate-600">
                            <p>{[act.category, act.subcategory].filter(Boolean).join(' · ') || act.work_package || 'Work scope not specified'}</p>
                            <p className="text-slate-700">{getBriefActivityExplanation(act)}</p>
                            <p>
                              Planned quantity: <span className="font-semibold tabular-nums text-slate-800">{act.quantity} {act.unit}</span>
                              {act.required_labour > 0 && <> · Crew: <span className="font-semibold tabular-nums text-slate-800">{act.required_labour}</span></>}
                            </p>
                            {(act.required_material || act.required_equipment) && (
                              <p>
                                {act.required_material && <>Material: {act.required_material}</>}
                                {act.required_material && act.required_equipment && ' · '}
                                {act.required_equipment && <>Equipment: {act.required_equipment}</>}
                              </p>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[10px] font-medium text-slate-400">{act.code || `ACT-${act.id}`}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-semibold">{act.phase || 'Phase not assigned'}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{act.work_package || 'Package not assigned'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-semibold">{act.tower || act.building || 'Site-wide'}</div>
                          <div className="mt-1 text-[11px] text-slate-500">Floor {act.floor} · {act.zone || 'Zone not assigned'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          {act.baseline_start_date && act.baseline_end_date ? (
                            <DateSpan start={act.baseline_start_date} end={act.baseline_end_date} emphasis="baseline" />
                          ) : (
                            <span className="text-[11px] font-sans text-slate-400">
                              {act.baseline_task_id != null ? 'No baseline dates in PDF' : 'Baseline not imported'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <DateSpan start={act.start_date} end={act.end_date} emphasis="live" />
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                          {act.actual_start_date || act.actual_end_date ? (
                            <DateSpan start={act.actual_start_date} end={act.actual_end_date} emphasis="actual" />
                          ) : (
                            <span className="font-sans text-[11px] text-slate-400">Not recorded</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-mono font-semibold tabular-nums">{act.planned_duration} days planned</div>
                          {act.actual_duration != null && (
                            <div className="mt-1 text-[11px] text-slate-500">{act.actual_duration} days actual</div>
                          )}
                          <div className="mt-1 text-[11px] text-slate-500">{act.quantity} {act.unit}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono tabular-nums font-bold text-slate-900">{Math.round(act.progress_percent || 0)}%</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              act.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800'
                                : act.status === 'DELAYED' || act.status === 'BLOCKED' ? 'bg-rose-50 text-rose-800'
                                  : act.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-900'
                                    : 'bg-slate-100 text-slate-600'
                            }`}>{(act.status || 'NOT_STARTED').replaceAll('_', ' ')}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${act.status === 'COMPLETED' ? 'bg-emerald-500' : act.status === 'DELAYED' || act.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, act.progress_percent || 0))}%` }}
                            />
                          </div>
                          {act.is_critical ? (
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">Critical path</div>
                          ) : (
                            <div className="mt-1 text-[10px] font-medium tabular-nums text-slate-500">{act.total_float} days float</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <DependencyList
                            title="Previous work"
                            dependencies={flow.predecessors}
                            activityNameById={activityNameById}
                            activityIdKey="predecessor_id"
                          />
                          <DependencyList
                            title="Next work"
                            dependencies={flow.successors}
                            activityNameById={activityNameById}
                            activityIdKey="successor_id"
                          />
                          {flow.predecessors.length === 0 && flow.successors.length === 0 && (
                            <span className="text-[10px] text-slate-400">No dependency link recorded</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleSelectDate(act.start_date)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                            title="Inspect all activities happening on this day"
                          >
                            <span>Inspect Day</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSequenceActivities.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center">
                        <p className="text-sm font-semibold text-slate-700">No matching activities</p>
                        <p className="mt-1 text-xs text-slate-500">Try a different search or clear the tower filter.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setSelectedTower('all');
                          }}
                          className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: PARALLEL ACTIVITIES FOR PLANNED ACTIVITIES (CONCURRENCY ENGINE) */}
      {/* ========================================================================= */}
      {activeTab === 'parallel' && (
        <div className="space-y-5">
          <div className="enterprise-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Network className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Planned Activities Concurrency & Parallel Execution Engine
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                Automatically identifies planned workfronts that execute simultaneously (e.g. A-Wing vs B-Wing parallel flows,
                Slab casting while lower floors execute Blockwork and Plumbing, and simultaneous trade muster).
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold font-mono">
              Total Parallel Clusters: {parallelConcurrencyGroups.length}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {parallelConcurrencyGroups.slice(0, 20).map(({ activity, overlappingCount, parallelPartners, spanDescription }) => {
              const isSelected = inspectedParallelActId === activity.id;

              return (
                <div
                  key={activity.id}
                  className={`enterprise-card p-4 transition-all ${
                    isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : 'hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {activity.code || `ACT-${activity.id}`}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 truncate max-w-xs">
                        {activity.name}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                      ⚡ {overlappingCount} Parallel Tasks
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>Active Window: <strong className="font-mono text-slate-800">{spanDescription}</strong></span>
                    <span>{activity.tower} • Floor {activity.floor}</span>
                  </div>

                  {/* Overlapping Partners Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Concurrent Workfronts on Site:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {parallelPartners.slice(0, 6).map((p) => (
                        <span
                          key={p.id}
                          onClick={() => handleSelectDate(p.start_date)}
                          className="px-2 py-1 rounded bg-slate-50 hover:bg-amber-50 hover:text-amber-800 border border-slate-200 text-[10px] font-medium text-slate-700 cursor-pointer transition-colors"
                          title={`Click to inspect ${p.start_date}`}
                        >
                          {p.name} ({p.tower} • F{p.floor})
                        </span>
                      ))}
                      {parallelPartners.length > 6 && (
                        <span className="px-2 py-1 rounded bg-slate-100 text-[10px] text-slate-500 font-mono">
                          +{parallelPartners.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                    <button
                      onClick={() => handleSelectDate(activity.start_date)}
                      className="text-xs text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1"
                    >
                      <span>Inspect Day ({activity.start_date})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      Planned: {activity.planned_duration}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DETAIL PLANNING TILL HANDOVER DATE (FULL MASTER ROADMAP) */}
      {/* ========================================================================= */}
      {activeTab === 'handover-roadmap' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wider">
                  Full Lifecycle Master Plan
                </span>
                <h2 className="text-xl font-bold tracking-tight text-white mt-1.5">
                  Complete Construction Schedule
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  PDF master baseline: <strong className="text-slate-200 font-mono">{baselineStartDate || startDate}</strong> through
                  <strong className="text-slate-200 font-mono"> {baselineFinishDate || 'not imported'}</strong>.
                  Live schedule forecast: <strong className="text-amber-300 font-mono">{scheduledFinishDate || 'not scheduled'}</strong>.
                  Contractual handover target: <strong className="text-emerald-400 font-mono">{handoverDate}</strong>.
                </p>
              </div>

              <div className="flex gap-3 shrink-0">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    PDF Baseline Finish
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-0.5">
                    {baselineFinishDate || 'Not imported'}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Live Forecast Finish
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-0.5">
                    {scheduledFinishDate || 'Not scheduled'}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Contract Handover
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
                    {handoverDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Complete activity roadmap, ordered by baseline start and finish */}
          <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
            {[...projectActivities]
              .sort(compareActivitiesByBaseline)
              .map((activity, idx) => {
              const statusStyles = activity.status === 'COMPLETED'
                ? { dot: 'border-emerald-500', fill: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-800' }
                : activity.status === 'IN_PROGRESS'
                  ? { dot: 'border-amber-500', fill: 'bg-amber-500', badge: 'bg-amber-50 text-amber-900' }
                  : activity.status === 'DELAYED' || activity.status === 'BLOCKED'
                    ? { dot: 'border-rose-500', fill: 'bg-rose-500', badge: 'bg-rose-50 text-rose-800' }
                    : { dot: 'border-slate-300', fill: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600' };

              return (
                <div key={activity.id} className="relative group">
                  {/* Indicator Dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${statusStyles.dot}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${statusStyles.fill}`} />
                  </div>

                  <div className="enterprise-card p-4 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          Activity {String(idx + 1).padStart(3, '0')}
                        </span>
                        {activity.baseline_start_date && activity.baseline_end_date ? (
                          <>
                            <span className="text-xs font-mono tabular-nums font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Dates from the imported PDF master baseline">
                              Baseline {activity.baseline_start_date} → {activity.baseline_end_date}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Current live schedule dates">
                              Live {activity.start_date} → {activity.end_date}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-mono tabular-nums font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Live {activity.start_date} → {activity.end_date}
                            </span>
                            {activity.baseline_task_id != null && (
                              <span className="text-[10px] font-semibold text-slate-500">No dates in PDF baseline</span>
                            )}
                          </>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusStyles.badge}`}>
                          {activity.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">{activity.phase}</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                        {activity.name}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {activity.tower} · Floor {activity.floor} · {activity.progress_percent || 0}% complete
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectDate(activity.start_date)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 shadow-2xs flex items-center gap-1.5 transition-all self-start md:self-auto"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect start date</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: DYNAMIC DAY INSPECTOR (WHEN WE CLICK ON SPECIFIC DATE) */}
      {/* ========================================================================= */}
      {activeTab === 'daily-inspector' && (
      <div id="dynamic-date-inspector-section" className="scroll-mt-20 space-y-5 pt-4">
        {/* Dynamic Date Controller Bar */}
        <div className="enterprise-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-slate-300 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Live Day Activity & Requirements Inspector (Dynamic Live Query)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or click any calendar date to dynamically inspect that day's scheduled workfronts, technical tolerances, materials, plant & labour muster.
            </p>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium pl-1">Target Date:</span>
            <input
              type="date"
              value={inspectedDate}
              onChange={(e) => setInspectedDate(e.target.value)}
              aria-label="Date to inspect"
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono tabular-nums font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => fetchDailyActivities(inspectedDate)}
              disabled={loadingDaily}
              aria-label={loadingDaily ? 'Refreshing day activities' : 'Refresh day activities'}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs transition-colors"
              title="Refresh Dynamic Query"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDaily ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Result Rendering */}
        {loadingDaily ? (
          <div className="py-16 text-center text-slate-500 text-xs enterprise-card flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-amber-700 animate-spin" />
            <span className="font-semibold text-slate-700">
              Dynamically querying project activities, material requisitions & trade muster for {inspectedDate}...
            </span>
          </div>
        ) : dailyError ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{dailyError}</span>
            <button
              type="button"
              onClick={() => void fetchDailyActivities(inspectedDate)}
              className="ml-auto shrink-0 rounded-md border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        ) : isInspectedDateAfterCompletion ? (
          <div className="space-y-6">
            {/* Project Completed Hero Banner */}
            <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      PROJECT IS 100% COMPLETED
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
                      Inspected Date: {inspectedDate}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>Project is Completed</span>
                    <Award className="w-6 h-6 text-emerald-400" />
                  </h2>

                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    The contractual construction lifecycle for <strong className="text-white">{project.name}</strong> ({project.code}) reached 100% completion on <strong className="text-emerald-400 font-mono">{new Date(projectCompletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Even when selecting any date after project completion ({inspectedDate}), all civil works, structural casting, architectural finishes, snagging validations, and statutory occupancy handovers remain 100% finished.
                  </p>
                </div>

                <div className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/30 text-center shrink-0 min-w-[210px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Completion Status
                  </span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                    100.0%
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Handover Date: {projectCompletionDate}
                  </span>
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Possession Handed Over</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Architectural / Structural Milestones Cleared */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">1. Substructure & Foundations</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700">100% Certified</div>
                <p className="text-[11px] text-slate-500">Excavation, raft & podiums structurally cleared & backfilled.</p>
              </div>

              <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">2. Superstructure RCC</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700">All {project.num_floors || 29} Floors Cast</div>
                <p className="text-[11px] text-slate-500">Terrace slab, lift machine room & overhead tank RCC cured.</p>
              </div>

              <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">3. MEP & Finishes</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700">100% Commissioned</div>
                <p className="text-[11px] text-slate-500">Elevators, electrical substations, firefighting & external facades live.</p>
              </div>

              <div className="enterprise-card p-4 border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">4. Handover & Statutory OC</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700">Occupancy Granted</div>
                <p className="text-[11px] text-slate-500">Fire NOC, structural stability certificate & client possession handed over.</p>
              </div>
            </div>

            {/* Operational Summary & Action Bar */}
            <div className="enterprise-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Post-Completion Operations & Custody</h4>
                  <p className="text-xs text-slate-500">
                    No active daily site labour muster or plant equipment units required on {inspectedDate}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectDate(projectCompletionDate)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Handover Date ({projectCompletionDate})</span>
                  </button>
                  <button
                    onClick={() => handleSelectDate(getLocalDateString())}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Jump to Today (Active Site)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-medium block">Daily Tasks on Date:</span>
                  <span className="font-mono font-bold text-slate-900">0 Active Construction Tasks</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-medium block">Site Headcount:</span>
                  <span className="font-mono font-bold text-slate-900">0 Labourers (Facility Management Custody)</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-medium block">Project Health:</span>
                  <span className="font-semibold text-emerald-700">Project Completed & Signed Off</span>
                </div>
              </div>
            </div>
          </div>
        ) : !dailyData || dailyData.activities.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-xs enterprise-card space-y-2">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">
              No activities scheduled directly on {inspectedDate}
            </p>
            <p className="text-slate-500">
              Select another project milestone date above or choose a date during active construction (e.g. 2026-10-09).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Day Overview Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div className="enterprise-card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0">
                  {dailyData.total_activities}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Day Tasks</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{dailyData.total_activities} active</span>
                </div>
              </div>

              <div className="enterprise-card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-800 font-bold shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Labour Muster</span>
                  <span className="text-xs font-mono font-bold text-amber-800">{dailyData.total_labour_required} workers</span>
                </div>
              </div>

              <div className="enterprise-card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Plant Units</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{dailyData.total_equipment_deployed} units</span>
                </div>
              </div>

              <div className="enterprise-card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Control</span>
                  <span className="text-xs font-mono font-bold text-emerald-700">{dailyData.in_control_count} on pace</span>
                </div>
              </div>

              <div className="enterprise-card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Risky / Delayed</span>
                  <span className="text-xs font-mono font-bold text-rose-700">
                    {dailyData.risky_count + dailyData.delayed_count} flagged
                  </span>
                </div>
              </div>
            </div>

            {/* List of Day Activities */}
            <div className="space-y-3">
              {dailyData.activities.map((act) => {
                const isExpanded = !!expandedDailyIds[act.id];

                return (
                  <div
                    key={act.id}
                    className={`enterprise-card overflow-hidden transition-all duration-150 ${
                      act.category === 'RISKY'
                        ? 'border-rose-200'
                        : act.category === 'DELAYED'
                        ? 'border-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div
                      onClick={() => toggleDailyExpand(act.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                            act.category === 'IN_CONTROL'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : act.category === 'RISKY'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              act.category === 'IN_CONTROL' ? 'bg-emerald-600' : act.category === 'RISKY' ? 'bg-rose-600' : 'bg-amber-600'
                            }`} />
                            {act.category}
                          </span>

                          <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {act.code || `ACT-${act.id}`}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                            {act.tower} • Floor {act.floor}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                            {act.phase}
                          </span>
                          {act.is_critical && (
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider">
                              Critical Path
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                          {act.name}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {act.brief_requirements?.work_scope || act.work_package}
                        </p>
                      </div>

                      {/* Right stats */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right min-w-[110px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Progress:</span>
                            <span className="font-mono tabular-nums font-bold text-slate-900">{act.progress_percent}%</span>
                          </div>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${act.progress_percent}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Planned: {act.planned_progress_percent}%
                          </span>
                        </div>

                        <div className="text-right min-w-[80px] pl-3 border-l border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Crew</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            {act.labour_requirement?.total_headcount || 8} <span className="text-xs font-normal text-slate-500">pax</span>
                          </span>
                        </div>

                        <button className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Requirements & Muster Accordion */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50/40 space-y-4">
                        {/* Risks & Blockers */}
                        {(act.category === 'RISKY' || act.category === 'DELAYED' || act.blockers_count > 0) && (
                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1">
                            <span className="font-semibold text-rose-900 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-rose-600" />
                              Active Site Blockers & Risk Factors:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-rose-800 pl-1 text-[11px]">
                              {act.risk_factors.map((rf, i) => (
                                <li key={i}>{rf}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left: Operational Brief Requirements */}
                          <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                            <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-700" />
                              <span>Operational Requirements & Specifications</span>
                            </h5>

                            <div className="space-y-1 text-xs">
                              <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide block">
                                Execution Scope:
                              </span>
                              <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200/70">
                                {act.brief_requirements?.work_scope}
                              </p>
                            </div>

                            <div className="space-y-1 text-xs">
                              <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide block">
                                Technical Specifications & Tolerances:
                              </span>
                              <p className="text-slate-700 font-mono text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200/70">
                                {act.brief_requirements?.technical_specifications}
                              </p>
                            </div>

                            <div className="space-y-1 text-xs">
                              <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide block">
                                Required Materials:
                              </span>
                              <p className="text-slate-800 font-medium bg-slate-50 p-2.5 rounded border border-slate-200/70 text-[11px]">
                                {act.brief_requirements?.material_requirements}
                              </p>
                            </div>

                            <div className="space-y-1 text-xs">
                              <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide block">
                                Plant & Heavy Machinery Deployed:
                              </span>
                              <p className="text-slate-800 font-medium bg-slate-50 p-2.5 rounded border border-slate-200/70 text-[11px]">
                                {act.brief_requirements?.equipment_requirements}
                              </p>
                            </div>
                          </div>

                          {/* Right: Labour Muster Trades & Governance */}
                          <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-slate-700" />
                                  <span>Trade-Wise Crew Muster</span>
                                </span>
                                <span className="font-mono tabular-nums font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                  {act.labour_requirement?.total_headcount || 8} Total
                                </span>
                              </h5>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/70">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Shift</span>
                                  <span className="font-medium text-slate-800">{act.labour_requirement?.shift}</span>
                                </div>
                                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/70">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Muster Status</span>
                                  <span className="font-semibold text-emerald-700">{act.labour_requirement?.muster_status}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(act.labour_requirement?.trades || {}).map(([tr, cnt]) => (
                                  <div key={tr} className="p-2 rounded bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                                    <span className="text-slate-600 capitalize">{tr.replace(/_/g, ' ')}:</span>
                                    <span className="font-mono tabular-nums font-bold text-slate-900 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                      {cnt}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="p-2.5 rounded bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Governance Tier:</span>
                                  <span className="font-semibold text-slate-800">{act.assigned_role || 'Site Manager'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Total CPM Float:</span>
                                  <span className={`font-mono font-semibold ${act.total_float <= 2 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                    {act.total_float} days buffer
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                              {onOpenLogHindrance && (
                                <button
                                  onClick={() => onOpenLogHindrance(act.id)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-rose-700 border border-rose-200 text-xs font-semibold"
                                >
                                  Log Hindrance
                                </button>
                              )}
                              {onOpenLogProgress && (
                                <button
                                  onClick={() => onOpenLogProgress(act.id)}
                                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                                >
                                  Log Progress
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
