import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { ActivityDetail } from '../../types';
import { ProgressBar, StatusChip, errorText, formatDate, useEscape } from '../simple/ui';

const STATE_TEXT: Record<string, { label: string; cls: string }> = {
  DONE: { label: 'Done', cls: 'bg-emerald-100 text-emerald-800' },
  IN_PROGRESS: { label: 'In progress', cls: 'bg-blue-100 text-blue-800' },
  READY: { label: 'Ready to start', cls: 'bg-sky-100 text-sky-800' },
  WAITING: { label: 'Waiting', cls: 'bg-slate-100 text-slate-700' },
};

const LINK = { FS: 'finishes before this starts', SS: 'starts before this starts', FF: 'finishes before this finishes', SF: 'starts before this finishes' } as Record<string, string>;

const variance = (days: number | null) =>
  days === null ? null : days === 0 ? 'On the baseline' : days > 0 ? `${days} day${days === 1 ? '' : 's'} later than the baseline` : `${-days} day${days === -1 ? '' : 's'} earlier than the baseline`;

export const ActivityDetailPanel: React.FC<{ activityId: number; onClose: () => void; onOpenTasks?: () => void; onOpenProblems?: () => void }> = ({ activityId, onClose, onOpenTasks, onOpenProblems }) => {
  const [d, setD] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  useEffect(() => {
    let alive = true;
    setD(null);
    setError(null);
    apiClient.getActivityDetail(activityId).then((x) => alive && setD(x)).catch((e) => alive && setError(errorText(e)));
    return () => { alive = false; };
  }, [activityId]);

  const late = d && d.state !== 'DONE' && d.end_date && d.end_date < new Date().toISOString().slice(0, 10) && d.progress_percent < 100;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="activity-title" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="activity-title" className="text-lg font-semibold text-slate-900">{d?.name ?? 'Activity'}</h2>
            {d && <p className="mt-0.5 text-sm text-slate-500">Step {d.step} · {d.tower}{d.phase ? ` · ${d.phase}` : ''}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
        {!d && !error && <p className="py-10 text-center text-sm text-slate-500" role="status">Loading…</p>}

        {d && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_TEXT[d.state].cls}`}>{STATE_TEXT[d.state].label}</span>
              {late && <StatusChip status="DELAYED" />}
              {d.is_critical && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">On the critical path</span>}
            </div>

            <section aria-label="Progress">
              <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium text-slate-800">Progress</span><span className="tabular-nums text-slate-600">{Math.round(d.progress_percent)}%</span></div>
              <ProgressBar value={d.progress_percent} tone={d.state === 'DONE' ? 'green' : late ? 'red' : 'blue'} />
              {d.planned_duration ? <p className="mt-1.5 text-xs text-slate-500">{d.planned_duration} planned days. Tasks planned so far cover {d.task_days_planned} of them.</p> : null}
            </section>

            <section aria-label="Dates">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Dates</h3>
              <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
                <dt className="text-slate-500">Planned</dt><dd className="text-slate-800">{formatDate(d.start_date)} to {formatDate(d.end_date)}</dd>
                {d.baseline_start_date && (<><dt className="text-slate-500">Baseline</dt><dd className="text-slate-800">{formatDate(d.baseline_start_date)} to {formatDate(d.baseline_end_date)}</dd></>)}
                <dt className="text-slate-500">Actual</dt><dd className="text-slate-800">{d.actual_start_date ? `Started ${formatDate(d.actual_start_date)}` : 'Not started'}{d.actual_end_date ? `, finished ${formatDate(d.actual_end_date)}` : ''}</dd>
                {variance(d.finish_variance_days) && (<><dt className="text-slate-500">Finish</dt><dd className="text-slate-800">{variance(d.finish_variance_days)}</dd></>)}
              </dl>
            </section>

            <section aria-label="Place in the plan">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Place in the plan</h3>
              {d.waiting_on.length > 0 && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Waiting for: {d.waiting_on.join(', ')}</p>}
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Before this</p>
              {d.predecessors.length === 0 ? <p className="mb-3 text-sm text-slate-500">Nothing: it can start any time.</p> : (
                <ul className="mb-3 space-y-1 text-sm">
                  {d.predecessors.map((p) => (
                    <li key={p.id} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${p.done ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-label={p.done ? 'done' : 'not done'} />
                      <span><span className="text-slate-800">{p.name}</span> <span className="text-xs text-slate-500">({LINK[p.type] ?? p.type}{p.lag_days ? `, ${p.lag_days > 0 ? '+' : ''}${p.lag_days} days` : ''})</span></span></li>
                  ))}
                </ul>
              )}
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">After this</p>
              {d.successors.length === 0 ? <p className="text-sm text-slate-500">Nothing depends on it.</p> : (
                <ul className="space-y-1 text-sm">{d.successors.map((s) => <li key={s.id} className="text-slate-800">{s.name} <span className="text-xs text-slate-500">· {s.tower}</span></li>)}</ul>
              )}
            </section>

            <section aria-label="Tasks">
              <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-semibold text-slate-900">Tasks</h3>{onOpenTasks && d.tasks.length > 0 && <button onClick={onOpenTasks} className="text-xs text-blue-700 hover:underline">Open Tasks</button>}</div>
              {d.tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks yet.</p> : (
                <ul className="space-y-2">{d.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-800">{t.title}</span><span className="shrink-0"><StatusChip status={t.status} /></span></li>
                ))}</ul>
              )}
            </section>

            <section aria-label="Problems">
              <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-semibold text-slate-900">Problems</h3>{onOpenProblems && d.problems.length > 0 && <button onClick={onOpenProblems} className="text-xs text-blue-700 hover:underline">Open Problems</button>}</div>
              {d.problems.length === 0 ? <p className="text-sm text-slate-500">None reported.</p> : (
                <ul className="space-y-2">{d.problems.map((p) => (
                  <li key={p.id} className="text-sm"><span className="font-medium text-slate-800">{p.category}</span>
                    <span className="ml-2 text-xs text-slate-500">{p.status === 'RESOLVED' ? `resolved ${formatDate(p.resolved_date)}` : `opened ${formatDate(p.opened_date)}`}</span>
                    <p className="text-slate-600">{p.impact_status === 'CONFIRMED' ? `Delay confirmed: ${p.confirmed_delay_days ?? 0} days on this activity, ${p.confirmed_project_delay_days ?? 0} on the project end` : p.impact_status === 'NO_IMPACT' ? 'No delay' : 'Effect not reviewed yet'}</p></li>
                ))}</ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};
