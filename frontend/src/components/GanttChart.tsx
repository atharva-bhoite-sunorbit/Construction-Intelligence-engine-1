import React, { useState, useMemo, useRef } from 'react';
import { differenceInDays, parseISO, format, addDays, addMonths } from 'date-fns';
import { AlertTriangle, Layers } from 'lucide-react';

interface GanttTask {
  id: number;
  name: string;
  code?: string;
  phase: string;
  tower: string;
  floor: number;
  baseline_task_id?: number | null;
  start: string;
  end: string;
  baseline_start?: string | null;
  baseline_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  brief_explanation?: string;
  work_package?: string | null;
  duration: number;
  progress: number;
  status: string;
  is_critical: boolean;
  total_float: number;
  free_float: number;
  required_labour: number;
}

interface GanttLink {
  id: number;
  source: number;
  target: number;
  type: string;
  lag: number;
  source_name: string;
  target_name: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  links: GanttLink[];
  onTaskClick?: (task: GanttTask) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, links, onTaskClick }) => {
  const activityListRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const chronologicalTasks = useMemo(
    () => [...tasks].sort((left, right) => {
      const startOrder = (left.baseline_start || left.start).localeCompare(right.baseline_start || right.start);
      if (startOrder !== 0) return startOrder;
      const taskOrder = (left.baseline_task_id ?? left.id) - (right.baseline_task_id ?? right.id);
      if (taskOrder !== 0) return taskOrder;
      return (left.baseline_end || left.end).localeCompare(right.baseline_end || right.end);
    }),
    [tasks]
  );

  // Extract unique floors & phases for filters
  const floors = useMemo(() => {
    const set = new Set(chronologicalTasks.map((t) => t.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [chronologicalTasks]);

  const phases = useMemo(() => {
    const set = new Set(chronologicalTasks.map((t) => t.phase));
    return Array.from(set).filter(Boolean);
  }, [chronologicalTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return chronologicalTasks.filter((t) => {
      if (selectedFloor !== 'all' && t.floor !== parseInt(selectedFloor)) return false;
      if (selectedPhase !== 'all' && t.phase !== selectedPhase) return false;
      if (showCriticalOnly && !t.is_critical) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [chronologicalTasks, selectedFloor, selectedPhase, showCriticalOnly, search]);
  const visibleTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);
  const visibleLinkCount = useMemo(
    () => links.filter((link) => visibleTaskIds.has(link.source) && visibleTaskIds.has(link.target)).length,
    [links, visibleTaskIds]
  );
  const syncVerticalScroll = (source: 'activityList' | 'timeline', scrollTop: number) => {
    const target = source === 'activityList' ? timelineRef.current : activityListRef.current;
    if (target && target.scrollTop !== scrollTop) target.scrollTop = scrollTop;
  };

  // Timeline bounds
  const { minDate, maxDate, totalTimelineDays } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: addDays(now, 30), totalTimelineDays: 30 };
    }
    let min = parseISO(chronologicalTasks[0].start);
    let max = parseISO(chronologicalTasks[0].end);

    chronologicalTasks.forEach((t) => {
      const dates = [t.start, t.end, t.baseline_start, t.baseline_end]
        .filter((value): value is string => Boolean(value))
        .map((value) => parseISO(value));
      dates.forEach((date) => {
        if (date < min) min = date;
        if (date > max) max = date;
      });
    });

    const diff = Math.max(15, differenceInDays(max, min) + 1);
    return { minDate: min, maxDate: max, totalTimelineDays: diff };
  }, [chronologicalTasks]);

  // Four pixels per day keeps the full multi-year plan navigable while retaining duration.
  const dayWidth = 4;
  const chartWidth = Math.max(1024, totalTimelineDays * dayWidth);

  // Month labels keep the long-range project timeline readable.
  const timeHeaders = useMemo(() => {
    const headers = [];
    let curr = minDate;
    while (differenceInDays(curr, minDate) < totalTimelineDays) {
      const offsetDays = differenceInDays(curr, minDate);
      headers.push({
        label: format(curr, 'MMM yyyy'),
        offsetDays,
        widthDays: differenceInDays(addMonths(curr, 1), curr),
      });
      curr = addMonths(curr, 1);
    }
    return headers;
  }, [minDate, totalTimelineDays]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs border border-slate-200">
      {/* Header & Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900 tracking-wide">Complete Construction Activity Timeline</h3>
          <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
            {filteredTasks.length} Activities · {visibleLinkCount} Dependencies Tracked
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-amber-700 bg-amber-500" />
            Baseline plan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm border border-dashed border-slate-500 bg-slate-200" />
            Live projection
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-amber-500"
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
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Phases</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            aria-pressed={showCriticalOnly}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
              showCriticalOnly
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Critical Path Only
          </button>
        </div>
      </div>

      {/* Main Gantt Body */}
      <div className="flex overflow-hidden">
        {/* Left Frozen Activity Names Column */}
        <div className="w-[25rem] flex-shrink-0 border-r border-slate-200 bg-white z-10">
          <div className="h-10 border-b border-slate-200 px-4 flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
            Activity / Baseline Planning Dates
          </div>
          <div
            ref={activityListRef}
            onScroll={(event) => syncVerticalScroll('activityList', event.currentTarget.scrollTop)}
            className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto"
          >
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onTaskClick?.(t)}
                className={`h-28 px-4 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-amber-50/40 transition-colors ${
                  t.is_critical ? 'border-l-2 border-l-rose-500 bg-rose-500/[0.02]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold leading-tight text-slate-800 flex items-center gap-1.5">
                    {t.is_critical && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                    )}
                    {t.name}
                  </div>
                  <div className="mt-1 truncate text-[10px] leading-tight text-slate-500">
                    {t.baseline_task_id != null ? `PDF #${t.baseline_task_id} · ` : ''}{t.tower} · F{t.floor} · {t.progress}% · {t.duration}d
                  </div>
                  {t.brief_explanation && (
                    <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-slate-500" title={t.brief_explanation}>
                      {t.brief_explanation}
                    </div>
                  )}
                  <div className="mt-1.5 truncate text-[10px] leading-tight font-mono tabular-nums text-amber-800">
                    {t.baseline_start && t.baseline_end
                      ? `Baseline ${t.baseline_start} → ${t.baseline_end}`
                      : 'PDF baseline dates not provided'}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] leading-tight font-mono tabular-nums text-slate-600">
                    Live {t.start} → {t.end}
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-800'
                      : t.status === 'DELAYED'
                      ? 'bg-rose-50 text-rose-800'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-amber-50 text-amber-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline View */}
        <div
          ref={timelineRef}
          onScroll={(event) => syncVerticalScroll('timeline', event.currentTarget.scrollTop)}
          className="flex-1 overflow-x-auto overflow-y-auto max-h-[680px] relative bg-slate-50"
        >
          <div style={{ width: `${chartWidth}px` }} className="relative min-h-[760px]">
            {/* Timeline Header Row */}
            <div className="h-10 border-b border-slate-200 bg-slate-50 sticky top-0 z-20 flex">
              {timeHeaders.map((h, i) => (
                <div
                  key={i}
                  style={{ left: `${h.offsetDays * dayWidth}px`, width: `${h.widthDays * dayWidth}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-200 px-2 flex items-center text-[11px] font-mono text-slate-500"
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Monthly grid lines */}
            <div className="absolute inset-0 top-10 pointer-events-none">
              {timeHeaders.map((h, i) => (
                <div
                  key={i}
                  style={{ left: `${h.offsetDays * dayWidth}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-200"
                />
              ))}
            </div>

            {/* Baseline is the primary planned bar; the live projection remains a comparison. */}
            <div className="relative divide-y divide-slate-100">
              {filteredTasks.map((t) => {
                const startDiff = Math.max(0, differenceInDays(parseISO(t.start), minDate));
                const barDuration = Math.max(1, differenceInDays(parseISO(t.end), parseISO(t.start)) + 1);
                const barWidth = Math.max(dayWidth * 2, barDuration * dayWidth);
                const leftPos = startDiff * dayWidth;
                const hasBaseline = Boolean(t.baseline_start && t.baseline_end);
                const plannedStart = hasBaseline ? t.baseline_start! : t.start;
                const plannedEnd = hasBaseline ? t.baseline_end! : t.end;
                const plannedStartDiff = Math.max(0, differenceInDays(parseISO(plannedStart), minDate));
                const plannedDuration = Math.max(1, differenceInDays(parseISO(plannedEnd), parseISO(plannedStart)) + 1);
                const plannedBarWidth = Math.max(dayWidth * 2, plannedDuration * dayWidth);

                return (
                  <div key={t.id} className="h-28 relative">
                    <div
                      style={{ left: `${plannedStartDiff * dayWidth}px`, width: `${plannedBarWidth}px`, top: '18px' }}
                      onClick={() => onTaskClick?.(t)}
                      className={`absolute h-5 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-95 flex items-center overflow-hidden border ${
                        t.is_critical
                          ? 'bg-rose-100 border-rose-600'
                          : t.status === 'COMPLETED'
                          ? 'bg-emerald-100 border-emerald-600'
                          : t.status === 'DELAYED'
                          ? 'bg-orange-100 border-orange-600'
                          : 'bg-slate-100 border-slate-500'
                      }`}
                      title={`${t.name} | ${hasBaseline ? 'PDF baseline' : 'Current plan (no PDF baseline dates)'}: ${plannedStart} to ${plannedEnd} | Live projection: ${t.start} to ${t.end} | ${plannedDuration} calendar days | ${t.progress}% complete | Float: ${t.total_float}d`}
                    >
                      {/* Progress fill */}
                      <div
                        style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }}
                        className={`h-full transition-all ${
                          t.is_critical
                            ? 'bg-rose-500/80'
                            : t.status === 'COMPLETED'
                            ? 'bg-emerald-500/80'
                            : t.status === 'DELAYED'
                            ? 'bg-orange-500/80'
                            : 'bg-amber-500/80'
                        }`}
                      />
                    </div>

                    {hasBaseline && (
                      <div
                        style={{ left: `${leftPos}px`, width: `${barWidth}px`, top: '49px' }}
                        className="absolute h-2 rounded-sm border border-dashed border-slate-500 bg-slate-200/70"
                        title={`Live projection: ${t.start} to ${t.end}`}
                      />
                    )}

                    {/* Float indicator if float > 0 */}
                    {t.total_float > 0 && (
                      <div
                        style={{ left: `${plannedStartDiff * dayWidth + plannedBarWidth}px`, width: `${Math.max(0, t.total_float) * dayWidth}px`, top: '54px' }}
                        className="absolute h-1.5 bg-slate-700/60 rounded-full border border-dashed border-slate-600/40"
                        title={`Total Float: ${t.total_float} days`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-2 rounded-sm border-2 border-dashed border-slate-700 bg-amber-200/40" />
            <span>PDF Master Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 border border-rose-400" />
            <span>Critical Path (Zero Float)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-400 border border-slate-500" />
            <span>Live plan (progress in amber)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400" />
            <span>Completed (100%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 border border-amber-400" />
            <span>Delayed / At Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-1 rounded-full bg-slate-600 border border-dashed border-slate-500" />
            <span>Schedule Float Buffer</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Showing timeline from {format(minDate, 'dd MMM yyyy')} to {format(maxDate, 'dd MMM yyyy')}
        </div>
      </div>
    </div>
  );
};
