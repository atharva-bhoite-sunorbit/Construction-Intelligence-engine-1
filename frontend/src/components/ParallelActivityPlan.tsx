import React, { useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { Search } from 'lucide-react';
import { Activity, ActivityDependency } from '../types';

interface ParallelActivityPlanProps {
  activities: Activity[];
  dependencies: ActivityDependency[];
}

const DAY_WIDTH = 24;
const LABEL_WIDTH = 300;

export const ParallelActivityPlan: React.FC<ParallelActivityPlanProps> = ({
  activities,
  dependencies,
}) => {
  const [search, setSearch] = useState('');
  const [selectedWorkFront, setSelectedWorkFront] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');

  const displayedActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (selectedWorkFront !== 'all' && (activity.tower || activity.building) !== selectedWorkFront) {
        return false;
      }
      if (selectedPhase !== 'all' && activity.phase !== selectedPhase) {
        return false;
      }
      if (search && !activity.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [activities, search, selectedPhase, selectedWorkFront]);

  const workFronts = useMemo(
    () => Array.from(new Set(activities.map((activity) => activity.tower || activity.building))).filter(Boolean),
    [activities],
  );

  const phases = useMemo(
    () => Array.from(new Set(activities.map((activity) => activity.phase))).filter(Boolean),
    [activities],
  );

  const plan = useMemo(() => {
    const scheduledActivities = displayedActivities
      .map((activity) => ({
        activity,
        start: parseISO(activity.start_date),
        end: parseISO(activity.end_date),
      }))
      .filter(({ start, end }) => isValid(start) && isValid(end) && end >= start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (scheduledActivities.length === 0) {
      return {
        groups: [],
        dayCount: 0,
        start: null,
        headers: [],
        overlappingCount: 0,
        workFrontCount: 0,
        startToStartCount: 0,
        scheduledCount: 0,
      };
    }

    const start = startOfWeek(scheduledActivities[0].start, { weekStartsOn: 1 });
    const latestEnd = scheduledActivities.reduce(
      (latest, item) => (item.end > latest ? item.end : latest),
      scheduledActivities[0].end,
    );
    const end = endOfWeek(latestEnd, { weekStartsOn: 1 });
    const dayCount = differenceInCalendarDays(end, start) + 1;
    const headers = Array.from({ length: Math.ceil(dayCount / 7) }, (_, index) => ({
      date: addDays(start, index * 7),
      offset: index * 7 * DAY_WIDTH,
    }));

    const groups = new Map<string, typeof scheduledActivities>();
    scheduledActivities.forEach((item) => {
      const workFront = item.activity.tower || item.activity.building || 'Unassigned work front';
      const group = groups.get(workFront) || [];
      group.push(item);
      groups.set(workFront, group);
    });

    const overlappingActivityIds = new Set<number>();
    scheduledActivities.forEach((item, index) => {
      scheduledActivities.slice(index + 1).forEach((other) => {
        if (other.start > item.end) return;
        overlappingActivityIds.add(item.activity.id);
        overlappingActivityIds.add(other.activity.id);
      });
    });

    const scheduledIds = new Set(scheduledActivities.map(({ activity }) => activity.id));
    const startToStartCount = dependencies.filter(
      (dependency) =>
        dependency.dependency_type === 'SS' &&
        scheduledIds.has(dependency.predecessor_id) &&
        scheduledIds.has(dependency.successor_id),
    ).length;

    return {
      groups: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)),
      dayCount,
      start,
      headers,
      overlappingCount: overlappingActivityIds.size,
      workFrontCount: groups.size,
      startToStartCount,
      scheduledCount: scheduledActivities.length,
    };
  }, [displayedActivities, dependencies]);

  if (plan.scheduledCount === 0 || !plan.start) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <h2 className="text-sm font-semibold text-slate-900">No scheduled activities yet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add activities with planned start and finish dates to build the parallel work plan.
        </p>
      </div>
    );
  }

  const timelineWidth = plan.dayCount * DAY_WIDTH;

  return (
    <section className="space-y-4" aria-label="Parallel activity plan">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activities..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedWorkFront}
            onChange={(event) => setSelectedWorkFront(event.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All work fronts</option>
            {workFronts.map((workFront) => (
              <option key={workFront} value={workFront}>
                {workFront}
              </option>
            ))}
          </select>

          <select
            value={selectedPhase}
            onChange={(event) => setSelectedPhase(event.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All phases</option>
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Scheduled overlaps</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {plan.overlappingCount}
            <span className="ml-2 text-xs font-normal tracking-normal text-slate-500">activities</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Active work fronts</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {plan.workFrontCount}
            <span className="ml-2 text-xs font-normal tracking-normal text-slate-500">towers / areas</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Start-to-Start links</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {plan.startToStartCount}
            <span className="ml-2 text-xs font-normal tracking-normal text-slate-500">parallel logic links</span>
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Parallel work-front schedule</h2>
          <p className="mt-1 text-xs text-slate-500">
            Activities are arranged by tower or area. Overlapping bars show work scheduled at the same time.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-full" style={{ width: LABEL_WIDTH + timelineWidth }}>
            <div
              className="grid border-b border-slate-200 bg-slate-50"
              style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${timelineWidth}px` }}
            >
              <div className="flex h-10 items-center border-r border-slate-200 px-4 text-xs font-semibold text-slate-600">
                Work front / activity
              </div>
              <div className="relative h-10">
                {plan.headers.map(({ date, offset }) => (
                  <span
                    key={date.toISOString()}
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium text-slate-500"
                    style={{ left: offset + 6 }}
                  >
                    {format(date, 'MMM d')}
                  </span>
                ))}
              </div>
            </div>

            {plan.groups.map(([workFront, scheduledActivities]) => (
              <React.Fragment key={workFront}>
                <div
                  className="grid border-b border-slate-200 bg-slate-50/80"
                  style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${timelineWidth}px` }}
                >
                  <div className="col-span-2 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                    {workFront}
                    <span className="font-normal text-slate-500">
                      {scheduledActivities.length} {scheduledActivities.length === 1 ? 'activity' : 'activities'}
                    </span>
                  </div>
                </div>

                {scheduledActivities.map(({ activity, start, end }) => {
                  const offsetDays = differenceInCalendarDays(start, plan.start!);
                  const durationDays = differenceInCalendarDays(end, start) + 1;
                  const isCritical = activity.is_critical;
                  const isComplete = activity.status === 'COMPLETED' || activity.progress_percent >= 100;
                  const isDelayed = activity.status === 'DELAYED';
                  const barColor = isCritical
                    ? 'border-rose-300 bg-rose-100 text-rose-800'
                    : isDelayed
                    ? 'border-amber-300 bg-amber-100 text-amber-900'
                    : isComplete
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                    : 'border-brand-200 bg-brand-100 text-brand-900';

                  return (
                    <div
                      key={activity.id}
                      className="grid border-b border-slate-100 last:border-b-0"
                      style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${timelineWidth}px` }}
                    >
                      <div className="flex h-12 min-w-0 items-center gap-2 border-r border-slate-100 px-4">
                        <span className="truncate text-xs font-medium text-slate-800" title={activity.name}>
                          {activity.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          F{activity.floor === 0 ? 'G' : activity.floor}
                        </span>
                      </div>
                      <div
                        className="relative h-12"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(to right, transparent 0, transparent 23px, #f1f5f9 23px, #f1f5f9 24px)',
                        }}
                      >
                        <div
                          className={`absolute top-2 z-0 flex h-8 min-w-[12px] items-center overflow-hidden rounded-md border px-2 text-[10px] font-semibold ${barColor}`}
                          style={{
                            left: offsetDays * DAY_WIDTH,
                            width: Math.max(durationDays * DAY_WIDTH - 4, 12),
                          }}
                          title={`${activity.name}: ${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')} · ${activity.progress_percent}% complete${isCritical ? ' · Critical path' : ''}`}
                          role="img"
                          aria-label={`${activity.name}, ${format(start, 'MMM d, yyyy')} to ${format(end, 'MMM d, yyyy')}, ${activity.progress_percent}% complete`}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 bg-current opacity-[0.08]"
                            style={{ width: `${Math.min(100, Math.max(0, activity.progress_percent))}%` }}
                          />
                          {durationDays * DAY_WIDTH > 90 && (
                            <span className="relative z-[1] truncate">
                              {format(start, 'MMM d')} – {format(end, 'MMM d')} · {activity.progress_percent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
          <span className="font-medium text-slate-500">Schedule status</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" />
            Planned / in progress
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />
            Complete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />
            Delayed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" />
            Critical path
          </span>
        </div>
      </div>
    </section>
  );
};
