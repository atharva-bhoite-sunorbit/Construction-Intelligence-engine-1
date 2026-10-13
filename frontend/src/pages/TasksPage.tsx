import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Lock, Plus, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { Activity, FocusTarget, NewTaskInput, Project, SequenceItem, Task, TaskActionName, TaskCheck, User } from '../types';
import { ReportProblemModal } from '../components/problems/ReportProblemModal';
import {
  EmptyState, PageHeader, PrimaryButton, ProgressBar, SecondaryButton, StatusChip, errorText, formatDate, useEscape,
} from '../components/simple/ui';

const WORK_ROLES = ['Site Engineer', 'Engineer', 'Site Manager', 'Project Manager', 'Admin'];
const APPROVER_ROLES = ['Project Manager', 'Admin'];

type FilterId = 'approval' | 'todo' | 'running' | 'done';
const FILTER_STATUSES: Record<FilterId, string[]> = {
  approval: ['PENDING_APPROVAL'],
  todo: ['DRAFT', 'APPROVED', 'REJECTED', 'PENDING_APPROVAL'],
  running: ['IN_PROGRESS', 'BLOCKED'],
  done: ['COMPLETED'],
};
const FILTER_LABEL: Record<FilterId, string> = {
  approval: 'Needs approval', todo: 'To do', running: 'In progress', done: 'Done',
};

interface TasksPageProps {
  project: Project;
  activities: Activity[];
  currentUser: User;
  focus?: FocusTarget | null;
  onChanged?: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ project, activities, currentUser, focus, onChanged }) => {
  const canWork = WORK_ROLES.includes(currentUser.role);
  const canApprove = APPROVER_ROLES.includes(currentUser.role);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [presetActivityId, setPresetActivityId] = useState<number | null>(null);
  const [sequence, setSequence] = useState<SequenceItem[]>([]);

  const load = useCallback(async () => {
    try {
      setTasks(await apiClient.getTasks(project.id));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Opened from a notification or the PM inbox: show that task straight away.
  useEffect(() => {
    if (focus?.type === 'task' && tasks.some((t) => t.id === focus.id)) setSelectedId(focus.id);
  }, [focus?.nonce, focus?.type, focus?.id, tasks]);

  const loadSequence = useCallback(async () => {
    try { setSequence(await apiClient.getSequence(project.id)); } catch { setSequence([]); }
  }, [project.id]);
  useEffect(() => { void loadSequence(); }, [loadSequence, tasks.length]);

  // What the plan says should be worked on next, for activities that do not have a live task yet.
  const nextUp = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const hasLiveTask = new Set(tasks.filter((t) => t.activity_id && t.status !== 'COMPLETED' && t.status !== 'REJECTED').map((t) => t.activity_id));
    return sequence
      .filter((i) => i.state !== 'DONE' && !hasLiveTask.has(i.activity_id) && (i.start_date ?? '') <= horizon && (i.state !== 'IN_PROGRESS' || (i.end_date ?? '') >= today))
      .slice(0, 4);
  }, [sequence, tasks]);

  const counts = useMemo(() => {
    const out = { approval: 0, todo: 0, running: 0, done: 0 } as Record<FilterId, number>;
    for (const t of tasks) {
      (Object.keys(FILTER_STATUSES) as FilterId[]).forEach((f) => {
        if (FILTER_STATUSES[f].includes(t.status)) out[f] += 1;
      });
    }
    return out;
  }, [tasks]);

  const filters: FilterId[] = canApprove ? ['approval', 'todo', 'running', 'done'] : ['todo', 'running', 'done'];
  const activeFilter: FilterId =
    filter ?? (canApprove && counts.approval > 0 ? 'approval' : counts.running > 0 ? 'running' : 'todo');
  const visible = tasks.filter((t) => FILTER_STATUSES[activeFilter].includes(t.status));
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const replaceTask = (updated: Task) => {
    setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
    void loadSequence();
    onChanged?.();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={canApprove ? 'Tasks' : 'My tasks'}
        subtitle={`${project.name}. Work the site team has set up against the plan.`}
        action={canWork && (
          <PrimaryButton onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New task
          </PrimaryButton>
        )}
      />

      {canWork && nextUp.length > 0 && (
        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-label="Next in the plan">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Next in the plan</h2>
          <ul className="divide-y divide-blue-100">
            {nextUp.map((i) => (
              <li key={i.activity_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900"><span className="mr-2 text-slate-500">Step {i.step}</span>{i.name}</p>
                  <p className="text-xs text-slate-500">
                    {i.tower} · {formatDate(i.start_date)}
                    {i.state === 'READY' && <span className="ml-2 font-medium text-emerald-700">Ready to start</span>}
                    {i.state === 'IN_PROGRESS' && <span className="ml-2 font-medium text-blue-700">In progress, no task yet</span>}
                    {i.state === 'WAITING' && <span className="ml-2 font-medium text-amber-700">After: {i.waiting_on.slice(0, 2).join(', ')}</span>}
                  </p>
                </div>
                <SecondaryButton className="!px-3 !py-1" onClick={() => { setPresetActivityId(i.activity_id); setShowNew(true); }}>Create task</SecondaryButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Task filter">
        {filters.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={activeFilter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeFilter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {FILTER_LABEL[f]} <span className={activeFilter === f ? 'text-slate-300' : 'text-slate-400'}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {loadError}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500" role="status">Loading tasks…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={activeFilter === 'approval' ? 'Nothing is waiting for approval' : `No tasks under “${FILTER_LABEL[activeFilter]}”`}
          hint={canWork && activeFilter === 'todo' ? 'Create a task for the work you plan to do next.' : undefined}
          action={canWork && activeFilter === 'todo' ? <PrimaryButton onClick={() => setShowNew(true)}>New task</PrimaryButton> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((task) => (
            <li key={task.id}>
              <button
                onClick={() => setSelectedId(task.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-slate-900">{task.title}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {task.sequence_step !== null && <span className="mr-2 font-medium text-slate-600">Step {task.sequence_step}</span>}
                      {task.is_unplanned ? 'Unplanned work' : (task.activity_name && task.activity_name.trim() !== task.title.trim() ? `${task.activity_name} · ` : '')}{task.is_unplanned ? ' · ' : ''}{task.tower}
                    </p>
                  </div>
                  <StatusChip status={task.status} />
                </div>
                {(task.status === 'IN_PROGRESS' || task.status === 'BLOCKED') && (
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={task.progress_percent} className="flex-1" />
                    <span className="w-10 text-right text-sm tabular-nums text-slate-600">{Math.round(task.progress_percent)}%</span>
                  </div>
                )}
                {task.waiting_on.length > 0 && (
                  <p className="mt-2 text-sm text-amber-700">Comes after: {task.waiting_on.slice(0, 2).join(', ')}</p>
                )}
                {task.status === 'DRAFT' && task.checks_total > 0 && (
                  <p className={`mt-2 text-sm ${task.unmet_checks.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {task.unmet_checks.length
                      ? `${task.unmet_checks.length} check${task.unmet_checks.length === 1 ? '' : 's'} to complete before starting`
                      : 'Ready to start'}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewTaskModal
          project={project}
          activities={activities}
          sequence={sequence}
          presetActivityId={presetActivityId}
          onClose={() => { setShowNew(false); setPresetActivityId(null); }}
          onCreated={(task) => {
            setTasks((current) => [task, ...current]);
            void load();  // re-fetch so the new task sits in its place in the plan order
            setShowNew(false);
            setPresetActivityId(null);
            setFilter('todo');
            setSelectedId(task.id);
            onChanged?.();
          }}
        />
      )}

      {selected && (
        <TaskPanel
          project={project}
          activities={activities}
          task={selected}
          canWork={canWork}
          canApprove={canApprove}
          onClose={() => setSelectedId(null)}
          onUpdated={replaceTask}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ new task */

const NewTaskModal: React.FC<{
  project: Project;
  activities: Activity[];
  sequence: SequenceItem[];
  presetActivityId: number | null;
  onClose: () => void;
  onCreated: (task: Task) => void;
}> = ({ project, activities, sequence, presetActivityId, onClose, onCreated }) => {
  const [unplanned, setUnplanned] = useState(false);
  const [search, setSearch] = useState('');
  const [activityId, setActivityId] = useState<number | null>(presetActivityId);
  const [title, setTitle] = useState(() => (presetActivityId ? (sequence.find((i) => i.activity_id === presetActivityId)?.name ?? '') : ''));
  const [days, setDays] = useState(1);
  const [assignedTo, setAssignedTo] = useState('');
  const [reason, setReason] = useState('');
  const [tower, setTower] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  const towers = useMemo(() => Array.from(new Set(activities.map((a) => a.tower).filter((t) => t && t !== 'Common'))), [activities]);
  // In plan order: what is ready or running first, then what comes later. Finished work is not offered.
  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (state: string) => (state === 'IN_PROGRESS' ? 0 : state === 'READY' ? 1 : 2);
    if (sequence.length > 0) {
      return sequence
        .filter((i) => i.state !== 'DONE' && (!q || i.name.toLowerCase().includes(q) || (i.tower ?? '').toLowerCase().includes(q)))
        .sort((a, b) => (q ? a.step - b.step : rank(a.state) - rank(b.state) || a.step - b.step))
        .slice(0, 30)
        .map((i) => ({ id: i.activity_id, name: i.name, tower: i.tower ?? '', start: i.start_date ?? '', state: i.state, step: i.step, waiting: i.waiting_on }));
    }
    return activities
      .filter((a) => a.status !== 'COMPLETED' && a.work_package !== 'Summary Header' && (!q || a.name.toLowerCase().includes(q)))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 30)
      .map((a) => ({ id: a.id, name: a.name, tower: a.tower, start: a.start_date, state: 'READY', step: 0, waiting: [] as string[] }));
  }, [sequence, activities, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input: NewTaskInput = { title: title.trim(), planned_days: days, assigned_to: assignedTo.trim() || undefined };
    if (unplanned) {
      input.is_unplanned = true;
      input.unplanned_reason = reason.trim();
      input.tower = tower;
    } else {
      input.activity_id = activityId ?? undefined;
    }
    try {
      onCreated(await apiClient.createTask(project.id, input));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const ready = title.trim() && (unplanned ? reason.trim() && tower : activityId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-task-title">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-task-title" className="text-lg font-semibold text-slate-900">New task</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="group" aria-label="Kind of work">
          <button type="button" onClick={() => setUnplanned(false)} className={`rounded-md py-1.5 ${!unplanned ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Part of the plan</button>
          <button type="button" onClick={() => setUnplanned(true)} className={`rounded-md py-1.5 ${unplanned ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Unplanned work</button>
        </div>

        {unplanned ? (
          <>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-reason">Why is this needed?</label>
            <textarea id="nt-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required
              className="mb-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Client asked for an extra shear wall" />
            <p className="mb-4 text-xs text-slate-500">The project manager must approve unplanned work before it can start.</p>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-tower">Where?</label>
            <select id="nt-tower" value={tower} onChange={(e) => setTower(e.target.value)} required className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Choose a tower</option>
              {towers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-search">Which planned activity?</label>
            <input id="nt-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <ul className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Planned activities">
              {choices.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No matching activity.</li>}
              {choices.map((a) => (
                <li key={a.id} role="option" aria-selected={activityId === a.id}>
                  <button type="button"
                    onClick={() => { setActivityId(a.id); if (!title.trim()) setTitle(a.name); }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${activityId === a.id ? 'bg-blue-50' : ''}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">{a.step > 0 && <span className="mr-2 text-xs text-slate-500">Step {a.step}</span>}{a.name}</span>
                      <span className="block text-xs text-slate-500">{a.tower} · {formatDate(a.start)}
                        {a.state === 'IN_PROGRESS' && <span className="ml-2 text-blue-700">In progress</span>}
                        {a.state === 'READY' && a.step > 0 && <span className="ml-2 text-emerald-700">Ready</span>}
                        {a.state === 'WAITING' && <span className="ml-2 text-amber-700">After: {a.waiting.slice(0, 1).join(', ')}</span>}
                      </span>
                    </span>
                    {activityId === a.id && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-title">What will be done?</label>
        <input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Pour 5th floor slab, east half" />

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-days">Days</label>
            <input id="nt-days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nt-who">Assigned to <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="nt-who" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Crew or person"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={!ready || busy}>{busy ? 'Creating…' : 'Create task'}</PrimaryButton>
        </div>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ task details */

const TaskPanel: React.FC<{
  project: Project;
  activities: Activity[];
  task: Task;
  canWork: boolean;
  canApprove: boolean;
  onClose: () => void;
  onUpdated: (task: Task) => void;
}> = ({ project, activities, task, canWork, canApprove, onClose, onUpdated }) => {
  const [checks, setChecks] = useState<TaskCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<null | 'reject'>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [waiving, setWaiving] = useState<number | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [percent, setPercent] = useState(Math.round(task.progress_percent));
  useEscape(onClose);

  useEffect(() => {
    setPercent(Math.round(task.progress_percent));
  }, [task.id, task.progress_percent]);

  useEffect(() => {
    let alive = true;
    if (task.checks_total > 0) {
      apiClient.getTaskChecks(task.id).then((rows) => alive && setChecks(rows)).catch(() => undefined);
    } else {
      setChecks([]);
    }
    return () => { alive = false; };
  }, [task.id, task.checks_done, task.status, task.checks_total]);

  const run = async (fn: () => Promise<Task>) => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await fn());
      setMode(null);
      setNote('');
      setWaiving(null);
      setWaiveReason('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const act = (action: TaskActionName, body?: { reason?: string }) => run(() => apiClient.taskAction(task.id, action, body));

  // A blocked task is released by resolving the problem that holds it up.
  const resume = () => run(async () => {
    const open = (await apiClient.getProblems(project.id)).filter((p) => p.task_id === task.id && p.status !== 'RESOLVED');
    if (open.length === 0) return apiClient.taskAction(task.id, 'unblock');
    for (const p of open) await apiClient.resolveProblem(p.id);
    return apiClient.getTask(task.id);
  });
  const can = (action: TaskActionName) => task.allowed_actions.includes(action);
  const locked = task.status !== 'DRAFT';
  const unmet = task.unmet_checks.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="task-title" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="task-title" className="text-lg font-semibold text-slate-900">{task.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{task.is_unplanned ? 'Unplanned work' : task.activity_name} · {task.tower}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-5 flex items-center gap-3"><StatusChip status={task.status} /><span className="text-sm text-slate-500">{task.planned_days} planned day{task.planned_days === 1 ? '' : 's'}</span></div>

        {task.waiting_on.length > 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">In the plan this comes after: {task.waiting_on.join(', ')}. You can still start it if site conditions allow; check with the project manager first.</p>
        )}

        {task.is_unplanned && task.unplanned_reason && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-medium">Why:</span> {task.unplanned_reason}</p>
        )}
        {task.rejection_reason && task.status === 'REJECTED' && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900"><span className="font-medium">Sent back:</span> {task.rejection_reason}</p>
        )}
        {task.blocked_note && task.status === 'BLOCKED' && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900"><span className="font-medium">Problem:</span> {task.blocked_note}</p>
        )}

        {task.checks_total > 0 && locked && (
          <p className="mb-4 text-sm text-slate-500">Readiness checks: {task.checks_done} of {task.checks_total} done before starting.</p>
        )}

        {task.checks_total > 0 && !locked && (
          <section className="mb-5" aria-label="Readiness checks">
            <h3 className="mb-0.5 text-sm font-semibold text-slate-800">Before starting <span className="font-normal text-slate-500">({task.checks_done}/{task.checks_total})</span></h3>
            <p className="mb-2 text-xs text-slate-500">Work through the steps in order. No step can be skipped.</p>
            <ul className="space-y-1">
              {checks.map((c) => {
                const done = c.passed || c.waived;
                const laterDone = checks.some((o) => o.step > c.step && o.passed);
                const toggle = (next: boolean) => {
                  if (!next && laterDone && !window.confirm('Unticking this step also clears the steps after it. Continue?')) return;
                  run(() => apiClient.setTaskCheck(task.id, c.id, next));
                };
                return (
                  <li key={c.id} className={`rounded-lg px-2 py-1.5 ${c.locked ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                    <label className={`flex items-start gap-3 ${c.locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${done ? 'bg-emerald-600 text-white' : c.locked ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white'}`} aria-hidden>
                        {c.locked ? <Lock className="h-3 w-3" /> : c.step}
                      </span>
                      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" checked={done}
                        disabled={locked || !canWork || busy || c.waived || c.locked}
                        aria-label={`Step ${c.step}: ${c.name}`}
                        onChange={(e) => toggle(e.target.checked)} />
                      <span className="min-w-0 text-sm">
                        <span className={done ? 'text-slate-500 line-through' : 'text-slate-800'}>{c.name}</span>
                        {!c.mandatory && <span className="ml-2 text-xs text-slate-400">optional</span>}
                        {c.waived && <span className="ml-2 text-xs text-amber-700">waived: {c.waiver_reason}</span>}
                        {c.locked && c.locked_by && <span className="block text-xs text-slate-500">After “{c.locked_by}”</span>}
                      </span>
                    </label>
                    {canApprove && !locked && c.mandatory && !done && !c.locked && (
                      waiving === c.id ? (
                        <div className="ml-7 mt-2 flex gap-2">
                          <input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Reason for skipping this check"
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm" aria-label="Reason for skipping this check" />
                          <SecondaryButton className="!px-3 !py-1" disabled={waiveReason.trim().length < 3 || busy}
                            onClick={() => run(() => apiClient.waiveTaskCheck(task.id, c.id, waiveReason.trim()))}>Skip</SecondaryButton>
                        </div>
                      ) : (
                        <button className="ml-7 mt-1 text-xs text-slate-500 underline hover:text-slate-800" onClick={() => setWaiving(c.id)}>Skip for this task</button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(task.status === 'IN_PROGRESS' || task.status === 'BLOCKED') && (
          <section className="mb-5" aria-label="Progress">
            <div className="mb-1 flex items-center justify-between text-sm"><h3 className="font-semibold text-slate-800">Progress</h3><span className="tabular-nums text-slate-600">{percent}%</span></div>
            <input type="range" min={0} max={99} step={5} value={Math.min(percent, 99)}
              disabled={!canWork || task.status === 'BLOCKED' || busy}
              onChange={(e) => setPercent(Math.max(Math.round(task.progress_percent), Number(e.target.value)))}
              className="w-full accent-blue-600" aria-label="Progress percent" />
            {canWork && task.status === 'IN_PROGRESS' && percent !== Math.round(task.progress_percent) && (
              <SecondaryButton className="mt-2" disabled={busy} onClick={() => run(() => apiClient.setTaskProgress(task.id, percent))}>Save progress</SecondaryButton>
            )}
          </section>
        )}

        {task.actual_start_date && (
          <p className="mb-4 text-sm text-slate-500">Started {formatDate(task.actual_start_date)}{task.actual_end_date ? ` · Finished ${formatDate(task.actual_end_date)}` : ''}</p>
        )}
        {task.activity_progress_percent !== null && task.activity_name && (
          <p className="mb-4 text-sm text-slate-500">“{task.activity_name}” is {Math.round(task.activity_progress_percent)}% done.</p>
        )}

        {mode && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tp-note">Why is it being sent back?</label>
            <textarea id="tp-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="mt-2 flex gap-2">
              <PrimaryButton disabled={busy || !note.trim()} onClick={() => act('reject', { reason: note.trim() })}>Send back</PrimaryButton>
              <SecondaryButton onClick={() => { setMode(null); setNote(''); }}>Cancel</SecondaryButton>
            </div>
          </div>
        )}

        {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}

        {!mode && (
          <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canWork && can('submit') && <PrimaryButton disabled={busy} onClick={() => act('submit')}>Send for approval</PrimaryButton>}
            {canApprove && can('approve') && <PrimaryButton disabled={busy} onClick={() => act('approve')}>Approve</PrimaryButton>}
            {canApprove && can('reject') && <SecondaryButton disabled={busy} onClick={() => setMode('reject')}>Send back</SecondaryButton>}
            {canWork && can('start') && (
              <PrimaryButton disabled={busy || unmet > 0} onClick={() => act('start')} title={unmet ? `Complete ${unmet} more check${unmet === 1 ? '' : 's'} first` : undefined}>
                {unmet ? `Start (${unmet} check${unmet === 1 ? '' : 's'} left)` : 'Start work'}
              </PrimaryButton>
            )}
            {canWork && can('complete') && <PrimaryButton disabled={busy} onClick={() => act('complete')}>Mark done</PrimaryButton>}
            {canWork && can('block') && <SecondaryButton disabled={busy} onClick={() => setReporting(true)}>Report a problem</SecondaryButton>}
            {canWork && can('unblock') && <PrimaryButton disabled={busy} onClick={resume}>Problem solved, resume</PrimaryButton>}
            {task.status === 'PENDING_APPROVAL' && !canApprove && <p className="text-sm text-slate-500">Waiting for the project manager to approve.</p>}
          </div>
        )}
      </aside>
      {reporting && (
        <ReportProblemModal project={project} activities={activities} task={task} onClose={() => setReporting(false)}
          onReported={() => { setReporting(false); void apiClient.getTask(task.id).then(onUpdated); }} />
      )}
    </div>
  );
};
