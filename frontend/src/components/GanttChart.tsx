import React, { useState, useMemo } from 'react';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, Filter, Eye, Layers } from 'lucide-react';

interface GanttTask {
  id: number;
  name: string;
  code?: string;
  phase: string;
  tower: string;
  floor: number;
  start: string;
  end: string;
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
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Extract unique floors & phases for filters
  const floors = useMemo(() => {
    const set = new Set(tasks.map((t) => t.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [tasks]);

  const phases = useMemo(() => {
    const set = new Set(tasks.map((t) => t.phase));
    return Array.from(set).filter(Boolean);
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedFloor !== 'all' && t.floor !== parseInt(selectedFloor)) return false;
      if (selectedPhase !== 'all' && t.phase !== selectedPhase) return false;
      if (showCriticalOnly && !t.is_critical) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, selectedFloor, selectedPhase, showCriticalOnly, search]);

  // Timeline bounds
  const { minDate, maxDate, totalTimelineDays } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: addDays(now, 30), totalTimelineDays: 30 };
    }
    let min = parseISO(tasks[0].start);
    let max = parseISO(tasks[0].end);

    tasks.forEach((t) => {
      const s = parseISO(t.start);
      const e = parseISO(t.end);
      if (s < min) min = s;
      if (e > max) max = e;
    });

    const diff = Math.max(15, differenceInDays(max, min) + 5);
    return { minDate: min, maxDate: max, totalTimelineDays: diff };
  }, [tasks]);

  // Column width per day (pixels)
  const dayWidth = 24;
  const chartWidth = Math.max(800, totalTimelineDays * dayWidth);

  // Weeks for timeline header
  const timeHeaders = useMemo(() => {
    const headers = [];
    let curr = minDate;
    for (let i = 0; i < totalTimelineDays; i += 7) {
      headers.push({
        label: format(curr, 'MMM d'),
        offsetDays: i,
      });
      curr = addDays(curr, 7);
    }
    return headers;
  }, [minDate, totalTimelineDays]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs border border-slate-200">
      {/* Header & Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-slate-900 tracking-wide">Interactive Construction Gantt Timeline</h3>
          <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
            {filteredTasks.length} Activities
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-brand-500"
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
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-brand-500"
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
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
              showCriticalOnly
                ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-200'
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
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white z-10">
          <div className="h-10 border-b border-slate-200 px-4 flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
            Activity / Package
          </div>
          <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onTaskClick?.(t)}
                className={`h-11 px-4 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                  t.is_critical ? 'border-l-2 border-l-rose-500 bg-rose-500/[0.02]' : ''
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                    {t.is_critical && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                    )}
                    {t.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    F{t.floor} • {t.duration}d • {t.progress}%
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : t.status === 'DELAYED'
                      ? 'bg-rose-500/20 text-rose-400'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline View */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[590px] relative bg-slate-50">
          <div style={{ width: `${chartWidth}px` }} className="relative min-h-[550px]">
            {/* Timeline Header Row */}
            <div className="h-10 border-b border-slate-200 bg-slate-50 sticky top-0 z-20 flex">
              {timeHeaders.map((h, i) => (
                <div
                  key={i}
                  style={{ left: `${h.offsetDays * dayWidth}px`, width: `${7 * dayWidth}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-200 px-2 flex items-center text-[11px] font-mono text-slate-500"
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Vertical grid lines every 7 days */}
            <div className="absolute inset-0 top-10 pointer-events-none">
              {timeHeaders.map((h, i) => (
                <div
                  key={i}
                  style={{ left: `${h.offsetDays * dayWidth}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-200"
                />
              ))}
            </div>

            {/* Task Bars */}
            <div className="relative pt-1 divide-y divide-slate-100">
              {filteredTasks.map((t) => {
                const startDiff = Math.max(0, differenceInDays(parseISO(t.start), minDate));
                const barWidth = Math.max(dayWidth, t.duration * dayWidth);
                const leftPos = startDiff * dayWidth;

                return (
                  <div key={t.id} className="h-11 relative flex items-center">
                    <div
                      style={{ left: `${leftPos}px`, width: `${barWidth}px` }}
                      onClick={() => onTaskClick?.(t)}
                      className={`absolute h-6 rounded-md shadow-md cursor-pointer transition-all hover:scale-[1.01] hover:brightness-110 flex items-center overflow-hidden border ${
                        t.is_critical
                          ? 'bg-rose-950/80 border-rose-500/70'
                          : t.status === 'COMPLETED'
                          ? 'bg-emerald-950/80 border-emerald-500/70'
                          : t.status === 'DELAYED'
                          ? 'bg-amber-950/80 border-amber-500/70'
                          : 'bg-brand-950/80 border-brand-500/60'
                      }`}
                      title={`${t.name} | ${t.start} to ${t.end} (${t.duration}d) | Float: ${t.total_float}d`}
                    >
                      {/* Progress fill */}
                      <div
                        style={{ width: `${t.progress}%` }}
                        className={`h-full opacity-60 transition-all ${
                          t.is_critical
                            ? 'bg-rose-500'
                            : t.status === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : t.status === 'DELAYED'
                            ? 'bg-amber-500'
                            : 'bg-brand-500'
                        }`}
                      />
                      <span className="absolute left-2 text-[10px] font-medium text-white truncate drop-shadow pr-2">
                        {t.name}
                      </span>
                    </div>

                    {/* Float indicator if float > 0 */}
                    {t.total_float > 0 && (
                      <div
                        style={{ left: `${leftPos + barWidth}px`, width: `${t.total_float * dayWidth}px` }}
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
            <span className="w-3 h-3 rounded bg-rose-500 border border-rose-400" />
            <span>Critical Path (Zero Float)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-500 border border-brand-400" />
            <span>Normal Execution</span>
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
