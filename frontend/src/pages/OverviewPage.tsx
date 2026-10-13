import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { Activity, AttentionItem, DelaySummary, Digest, Project, Task, User } from '../types';
import { EmptyState, PageHeader, ProgressBar, formatDate } from '../components/simple/ui';
import { isLate, weightedProgress } from '../components/simple/activityUtils';
import { BuildingProgress } from '../components/building/BuildingProgress';
import { ProjectGallery } from '../components/simple/ProjectGallery';
import { DailyChecklistCard } from '../components/today/DailyChecklistCard';
import { ActivityDetailPanel } from '../components/activity/ActivityDetailPanel';

interface OverviewPageProps {
  project: Project;
  activities: Activity[];
  currentUser: User;
  delaySummary?: DelaySummary | null;
  onNavigate: (tab: string, focus?: { type: 'task' | 'problem' | 'activity'; id: number }) => void;
}

const Stat: React.FC<{ label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'bad'; onClick?: () => void }> = ({ label, value, hint, tone = 'default', onClick }) => {
  const color = tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900';
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </>
  );
  const cls = 'rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm';
  return onClick ? (
    <button onClick={onClick} className={`${cls} transition hover:border-slate-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600`}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

const DOT: Record<string, string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-slate-400' };
const KIND_LABEL: Record<string, string> = {
  APPROVAL: 'Approval', PROBLEM_REVIEW: 'Review', BLOCKED_TASK: 'Blocked', LATE_ACTIVITY: 'Late', SHOULD_HAVE_STARTED: 'Not started',
};

const Line: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <li className="flex items-baseline justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold tabular-nums text-slate-900">{n}</span></li>
);

export const OverviewPage: React.FC<OverviewPageProps> = ({ project, activities, currentUser, delaySummary, onNavigate }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const director = currentUser.role === 'Top Management';
  const [openActivity, setOpenActivity] = useState<number | null>(null);

  const load = useCallback(() => {
    void apiClient.getTasks(project.id).then(setTasks).catch(() => undefined);
    void apiClient.getAttention(project.id).then(setAttention).catch(() => setAttention([]));
    void apiClient.getDigest(project.id, 7).then(setDigest).catch(() => undefined);
  }, [project.id]);

  useEffect(() => {
    setAttention(null);
    setDigest(null);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const late = activities.filter((a) => isLate(a));
    const towers = Array.from(new Set(activities.map((a) => a.tower).filter(Boolean)));
    return {
      overall: weightedProgress(activities),
      late: late.length,
      done: activities.filter((a) => a.status === 'COMPLETED').length,
      byTower: towers.map((tower) => {
        const rows = activities.filter((a) => a.tower === tower);
        return { tower, count: rows.length, progress: weightedProgress(rows), late: rows.filter((a) => isLate(a)).length };
      }),
    };
  }, [activities]);

  const waiting = tasks.filter((t) => t.status === 'PENDING_APPROVAL').length;
  const canApprove = ['Project Manager', 'Admin'].includes(currentUser.role);
  const open = (item: AttentionItem) => onNavigate(item.tab, { type: item.entity_type, id: item.entity_id });

  if (activities.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Overview" subtitle={project.name} />
        <EmptyState title="No schedule loaded yet" hint="Import the project schedule to see progress here." />
      </div>
    );
  }

  const slip = digest && digest.confirmed_project_delay_days > 0;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Overview"
        subtitle={`${project.name} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        action={digest?.planned_finish && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm" aria-label="Finish date">
            <span className="text-slate-500">Planned finish </span><span className="font-medium text-slate-900">{formatDate(digest.planned_finish)}</span>
            {slip ? <span className="ml-2 font-medium text-rose-700">Expected {formatDate(digest.expected_finish)} (+{digest.confirmed_project_delay_days} days)</span>
              : <span className="ml-2 text-emerald-700">no confirmed delay</span>}
          </div>
        )}
      />

      <BuildingProgress projectId={project.id} onOpenActivity={setOpenActivity} onOpenFull={() => onNavigate('building')} />
      {director && <div className="mb-8"><DailyChecklistCard projectId={project.id} /></div>}
      <ProjectGallery projectCode={project.code} />

      {(canApprove || director) && (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={director ? 'Needs attention' : 'Needs your action'}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">{director ? 'Needs attention' : 'Needs your action'}</h2>
            {attention && attention.length > 0 && <span className="text-sm text-slate-500">{attention.length} item{attention.length === 1 ? '' : 's'}</span>}
          </div>
          {attention === null ? (
            <p className="text-sm text-slate-500" role="status">Checking…</p>
          ) : attention.length === 0 ? (
            <p className="text-sm text-slate-500">{director ? 'Nothing is overdue or stuck.' : 'Nothing needs you right now.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((item) => (
                <li key={`${item.kind}-${item.entity_id}`}>
                  <button onClick={() => open(item)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[item.severity]}`} aria-label={`${item.severity} priority`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block text-sm text-slate-500">{item.detail}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{KIND_LABEL[item.kind] ?? item.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Overall progress" value={`${stats.overall.toFixed(0)}%`} hint={`${stats.done} of ${activities.length} activities done`} />
        <Stat label="Open problems" value={String(delaySummary?.open_problems ?? 0)}
          tone={(delaySummary?.waiting_for_review ?? 0) > 0 ? 'warn' : 'default'}
          hint={(delaySummary?.waiting_for_review ?? 0) > 0 ? `${delaySummary?.waiting_for_review} need PM review` : 'none waiting for review'}
          onClick={() => onNavigate('problems')} />
        <Stat label="Running late" value={String(stats.late)} tone={stats.late ? 'bad' : 'default'} hint={stats.late ? 'planned finish has passed' : 'nothing overdue'} onClick={() => onNavigate('schedule')} />
        <Stat label="Waiting for approval" value={String(waiting)} tone={waiting ? 'warn' : 'default'} hint={waiting ? (canApprove ? 'review in Tasks' : 'unplanned tasks') : 'all clear'} onClick={canApprove ? () => onNavigate('tasks') : undefined} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="This week">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-base font-semibold text-slate-900">This week</h2><span className="text-xs text-slate-500">last {digest?.days ?? 7} days</span></div>
          {!digest ? <p className="text-sm text-slate-500" role="status">Loading…</p> : (
            <>
              <ul className="space-y-2">
                <Line n={digest.tasks_finished} label="Tasks finished" />
                <Line n={digest.tasks_started} label="Tasks started" />
                <Line n={digest.activities_finished} label="Activities completed" />
                <Line n={digest.problems_reported} label="Problems reported" />
                <Line n={digest.problems_resolved} label="Problems resolved" />
                <Line n={digest.approvals_decided} label="Approvals decided" />
              </ul>
              {digest.recent_finished.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Recently finished</p>
                  <ul className="space-y-1">{digest.recent_finished.slice(0, 3).map((t, i) => <li key={i} className="truncate text-sm text-slate-700">{t.title} <span className="text-xs text-slate-400">· {t.tower}</span></li>)}</ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Delay and causes">
          <div className="mb-3"><h2 className="text-base font-semibold text-slate-900">Delay and its causes</h2><p className="text-xs text-slate-500">Only delay confirmed by the project manager is counted.</p></div>
          {delaySummary && delaySummary.confirmed_problems > 0 ? (
            <div>
              {delaySummary.largest_confirmed_project_delay_days > 0 ? (
                <p className="text-3xl font-semibold tabular-nums text-rose-700">{delaySummary.largest_confirmed_project_delay_days} <span className="text-base font-normal text-slate-500">days to the project end</span></p>
              ) : (
                <p className="text-xl font-semibold text-emerald-700">Project end not moved</p>
              )}
              <p className="mb-3 mt-1 text-sm text-slate-500">{delaySummary.confirmed_problems} confirmed problem{delaySummary.confirmed_problems === 1 ? '' : 's'}, {delaySummary.confirmed_activity_delay_days} activity days lost</p>
              <ul className="space-y-2">
                {delaySummary.by_category.filter((c) => c.confirmed_delay_days > 0).slice(0, 4).map((c) => (
                  <li key={c.category} className="flex items-center justify-between text-sm"><span className="text-slate-800">{c.category}</span><span className="tabular-nums text-slate-600">{c.confirmed_delay_days} days</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No confirmed delay.{(delaySummary?.waiting_for_review ?? 0) > 0 ? ` ${delaySummary?.waiting_for_review} reported problem${delaySummary?.waiting_for_review === 1 ? ' is' : 's are'} waiting for review.` : ''}</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Progress by tower">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Progress by tower</h2>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {stats.byTower.map((t) => (
            <li key={t.tower}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-800">{t.tower}</span>
                <span className="tabular-nums text-slate-600">{t.progress.toFixed(0)}%{t.late ? <span className="ml-2 text-rose-700">{t.late} late</span> : null}</span>
              </div>
              <ProgressBar value={t.progress} tone={t.late ? 'red' : 'blue'} />
            </li>
          ))}
        </ul>
      </section>
      {openActivity !== null && (
        <ActivityDetailPanel activityId={openActivity} onClose={() => setOpenActivity(null)}
          onOpenTasks={() => { setOpenActivity(null); onNavigate('tasks'); }} onOpenProblems={() => { setOpenActivity(null); onNavigate('problems'); }} />
      )}
    </div>
  );
};
