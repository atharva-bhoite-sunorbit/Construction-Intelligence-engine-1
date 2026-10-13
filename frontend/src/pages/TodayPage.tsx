import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CircleSlash, Clock } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Activity, Lookahead, LookaheadItem, PlanBOption, Project, User } from '../types';
import { PageHeader, ProgressBar, errorText, formatDate } from '../components/simple/ui';
import { DailyChecklistCard } from '../components/today/DailyChecklistCard';
import { ActivityDetailPanel } from '../components/activity/ActivityDetailPanel';
import { ReportProblemModal } from '../components/problems/ReportProblemModal';

interface TodayPageProps {
  project: Project;
  activities: Activity[];
  currentUser: User;
  onNavigate: (tab: string, focus?: { type: 'task' | 'problem' | 'activity'; id: number }) => void;
}

const WORKER_ROLES = new Set(['Site Engineer', 'Engineer', 'Site Manager', 'Project Manager', 'Admin']);
const dayLabel = (iso: string, i: number) =>
  i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const StopLine: React.FC<{ kind: string; text: string }> = ({ kind, text }) => (
  <li className="flex items-start gap-1.5 text-xs text-rose-800">
    {kind === 'waiting' ? <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
    <span>{text}</span>
  </li>
);

/** Plan A for today, Plan B when something is stopped, the coming 5 working days and the person's daily checklist. */
export const TodayPage: React.FC<TodayPageProps> = ({ project, activities, currentUser, onNavigate }) => {
  const [data, setData] = useState<Lookahead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<number | null>(null);
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const canWork = WORKER_ROLES.has(currentUser.role);

  const load = useCallback(() => {
    apiClient.getLookahead(project.id).then((d) => { setData(d); setError(null); }).catch((e) => setError(errorText(e)));
  }, [project.id]);
  useEffect(() => { setData(null); load(); const t = window.setInterval(load, 60_000); return () => window.clearInterval(t); }, [load]);

  const planTask = async (opt: PlanBOption) => {
    if (opt.open_task_id) { onNavigate('tasks', { type: 'task', id: opt.open_task_id }); return; }
    setBusy(opt.activity_id);
    try {
      const days = opt.start_date && opt.end_date ? Math.max(1, Math.round((+new Date(opt.end_date) - +new Date(opt.start_date)) / 86_400_000)) : 1;
      const task = await apiClient.createTask(project.id, { title: opt.name, planned_days: Math.min(days, 30), activity_id: opt.activity_id });
      onNavigate('tasks', { type: 'task', id: task.id });
    } catch (e) { setError(errorText(e)); } finally { setBusy(null); }
  };

  const today = data?.days[0];
  const stopped = today?.items.filter((x) => x.stopped_by.length) ?? [];
  const going = today?.items.filter((x) => !x.stopped_by.length) ?? [];
  const reportActivity = activities.find((a) => a.id === reportFor);

  const ItemRow: React.FC<{ x: LookaheadItem }> = ({ x }) => (
    <li className={`rounded-lg border px-3 py-2.5 ${x.stopped_by.length ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button onClick={() => setOpenActivity(x.activity_id)} className="min-w-0 text-left">
          <span className="block truncate text-sm font-medium text-slate-900 hover:underline">{x.name}</span>
          <span className="text-xs text-slate-500">{x.tower} · planned {formatDate(x.start_date)} to {formatDate(x.end_date)}</span>
        </button>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
          {x.late && <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-800">Late</span>}
          {x.finishes && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">Due today</span>}
          {x.state === 'READY' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Can start</span>}
          {x.state === 'WAITING' && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Not ready</span>}
        </span>
      </div>
      {x.state === 'IN_PROGRESS' && <div className="mt-2 flex items-center gap-2"><ProgressBar value={x.progress_percent} className="flex-1" tone={x.late ? 'red' : 'blue'} /><span className="w-10 text-right text-xs tabular-nums text-slate-600">{Math.round(x.progress_percent)}%</span></div>}
      {x.stopped_by.length > 0 && <ul className="mt-2 space-y-1">{x.stopped_by.map((s, i) => <StopLine key={i} kind={s.kind} text={s.text} />)}</ul>}
      {x.notes.length > 0 && <ul className="mt-1.5 space-y-0.5">{x.notes.map((n) => <li key={n} className="text-xs text-amber-800">{n}</li>)}</ul>}
      {canWork && !x.stopped_by.some((s) => s.kind === 'problem') && (
        <button onClick={() => setReportFor(x.activity_id)} className="mt-2 text-xs text-slate-500 underline hover:text-slate-800">Something stopped this?</button>
      )}
    </li>
  );

  return (
    <div>
      <PageHeader title="Today" subtitle={`${project.name} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`} />
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Today's plan">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Plan A: today's work</h2>
              {data && <span className="text-sm text-slate-500">{data.summary.today_items} items{data.summary.late ? `, ${data.summary.late} late` : ''}</span>}
            </div>
            {!data ? <p className="text-sm text-slate-500" role="status">Loading…</p>
              : today && today.items.length === 0 ? <p className="text-sm text-slate-500">Nothing is planned for today in your area.</p>
              : (
                <>
                  {stopped.length > 0 && (
                    <>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-800"><AlertTriangle className="h-4 w-4" aria-hidden />Stopped ({stopped.length})</h3>
                      <ul className="mb-4 space-y-2">{stopped.map((x) => <ItemRow key={x.activity_id} x={x} />)}</ul>
                    </>
                  )}
                  {going.length > 0 && (
                    <>
                      {stopped.length > 0 && <h3 className="mb-2 text-sm font-semibold text-slate-800">Going ahead ({going.length})</h3>}
                      <ul className="space-y-2">{going.map((x) => <ItemRow key={x.activity_id} x={x} />)}</ul>
                    </>
                  )}
                </>
              )}
          </section>

          {data && (data.stopped > 0 || data.plan_b.length > 0) && (
            <section className={`rounded-xl border p-5 shadow-sm ${data.stopped ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`} aria-label="Plan B">
              <h2 className="text-base font-semibold text-slate-900">Plan B{data.stopped ? ': keep the crew working' : ': ready if something stops'}</h2>
              <p className="mb-3 text-xs text-slate-600">
                {data.stopped ? `${data.stopped} item${data.stopped === 1 ? ' is' : 's are'} stopped. These can go ahead instead.` : 'Work that is ready now, in case today\'s plan is held up.'}
              </p>
              {data.plan_b.length === 0 ? <p className="text-sm text-slate-600">Nothing else is ready to pull forward right now. Talk to the site manager.</p> : (
                <ul className="space-y-2">
                  {data.plan_b.map((o) => (
                    <li key={`${o.kind}-${o.activity_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <span className="mr-2 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">{o.kind === 'boost' ? 'Add crew' : `Pull forward ${o.days_early} day${o.days_early === 1 ? '' : 's'}`}</span>
                        <button onClick={() => setOpenActivity(o.activity_id)} className="text-sm font-medium text-slate-900 hover:underline">{o.name}</button>
                        <p className="mt-0.5 text-xs text-slate-500">{o.tower}{o.work_type ? ` · ${o.work_type}` : ''} · {o.why}</p>
                      </div>
                      {canWork && (
                        <button disabled={busy === o.activity_id} onClick={() => planTask(o)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                          {o.open_task_id ? 'Open task' : 'Plan a task'}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {data && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Next 5 days">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Next 5 working days</h2>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {data.days.slice(1).map((day, i) => {
                  const starts = day.items.filter((x) => x.starts);
                  const finishes = day.items.filter((x) => x.finishes);
                  const notReady = day.items.filter((x) => x.stopped_by.length && !x.starts);
                  const continuing = day.items.length - starts.length - finishes.filter((x) => !x.starts).length - notReady.filter((x) => !x.finishes).length;
                  return (
                    <li key={day.date} className="rounded-lg border border-slate-200 p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-900">{dayLabel(day.date, i + 1)}</p>
                      <ul className="space-y-1.5 text-xs">
                        {starts.map((x) => (
                          <li key={`s${x.activity_id}`} className={x.stopped_by.length ? 'text-rose-800' : 'text-emerald-800'}>
                            <span className="font-medium">{x.stopped_by.length ? 'Not ready to start' : 'Starts'}:</span> {x.name}
                            {x.stopped_by.length > 0 && <span className="block text-rose-700">{x.stopped_by[0].text}</span>}
                          </li>
                        ))}
                        {finishes.map((x) => <li key={`f${x.activity_id}`} className="text-amber-900"><span className="font-medium">Due:</span> {x.name}</li>)}
                        {notReady.filter((x) => !x.finishes).map((x) => <li key={`n${x.activity_id}`} className="text-rose-800"><span className="font-medium">Held up:</span> {x.name}</li>)}
                        {continuing > 0 && <li className="text-slate-500">+{continuing} continuing</li>}
                        {day.items.length === 0 && <li className="text-slate-400">Nothing planned</li>}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <DailyChecklistCard projectId={project.id} />
        </div>
      </div>

      {openActivity !== null && (
        <ActivityDetailPanel activityId={openActivity} onClose={() => setOpenActivity(null)}
          onOpenTasks={() => { setOpenActivity(null); onNavigate('tasks'); }} onOpenProblems={() => { setOpenActivity(null); onNavigate('problems'); }} />
      )}
      {reportFor !== null && reportActivity && (
        <ReportProblemModal project={project} activities={activities.filter((a) => a.id === reportFor)} onClose={() => setReportFor(null)}
          onReported={() => { setReportFor(null); load(); }} />
      )}
    </div>
  );
};
