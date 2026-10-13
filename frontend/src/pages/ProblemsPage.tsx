import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { Activity, FocusTarget, Problem, Project, User } from '../types';
import { EmptyState, PageHeader, PrimaryButton, SecondaryButton, errorText, formatDate, useEscape } from '../components/simple/ui';
import { ReportProblemModal } from '../components/problems/ReportProblemModal';

const WORK_ROLES = ['Site Engineer', 'Engineer', 'Site Manager', 'Project Manager', 'Admin'];
const APPROVER_ROLES = ['Project Manager', 'Admin'];
type FilterId = 'review' | 'open' | 'resolved';
const LABEL: Record<FilterId, string> = { review: 'Needs review', open: 'Open', resolved: 'Resolved' };

const days = (n: number | null | undefined) => `${(n ?? 0) % 1 === 0 ? n ?? 0 : (n ?? 0).toFixed(1)} day${n === 1 ? '' : 's'}`;

const ImpactChip: React.FC<{ p: Problem }> = ({ p }) => {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap';
  if (p.impact_status === 'CONFIRMED') {
    return <span className={`${base} bg-rose-100 text-rose-800`}>{(p.confirmed_project_delay_days ?? 0) > 0 ? `Project delayed ${days(p.confirmed_project_delay_days)}` : `Activity delayed ${days(p.confirmed_delay_days)}`}</span>;
  }
  if (p.impact_status === 'NO_IMPACT') return <span className={`${base} bg-emerald-100 text-emerald-800`}>No delay</span>;
  return <span className={`${base} bg-amber-100 text-amber-800`}>Impact not reviewed</span>;
};

interface ProblemsPageProps {
  project: Project;
  activities: Activity[];
  currentUser: User;
  focus?: FocusTarget | null;
  onChanged?: () => void;
}

export const ProblemsPage: React.FC<ProblemsPageProps> = ({ project, activities, currentUser, focus, onChanged }) => {
  const canWork = WORK_ROLES.includes(currentUser.role);
  const canApprove = APPROVER_ROLES.includes(currentUser.role);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    try {
      setProblems(await apiClient.getProblems(project.id));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  useEffect(() => {
    if (focus?.type === 'problem' && problems.some((p) => p.id === focus.id)) setSelectedId(focus.id);
  }, [focus?.nonce, focus?.type, focus?.id, problems]);

  const groups = useMemo(() => ({
    review: problems.filter((p) => p.needs_review),
    open: problems.filter((p) => p.status !== 'RESOLVED'),
    resolved: problems.filter((p) => p.status === 'RESOLVED'),
  }), [problems]);
  const filters: FilterId[] = canApprove ? ['review', 'open', 'resolved'] : ['open', 'resolved'];
  const active: FilterId = filter ?? (canApprove && groups.review.length > 0 ? 'review' : 'open');
  const visible = groups[active];
  const selected = problems.find((p) => p.id === selectedId) ?? null;

  const replace = (updated: Problem) => {
    setProblems((cur) => cur.map((p) => (p.id === updated.id ? updated : p)));
    onChanged?.();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Problems"
        subtitle="Anything holding up the work. A problem only counts as delay once the project manager confirms its effect."
        action={canWork && <PrimaryButton onClick={() => setShowReport(true)}><Plus className="h-4 w-4" aria-hidden /> Report a problem</PrimaryButton>}
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Problem filter">
        {filters.map((f) => (
          <button key={f} role="tab" aria-selected={active === f} onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${active === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {LABEL[f]} <span className={active === f ? 'text-slate-300' : 'text-slate-400'}>{groups[f].length}</span>
          </button>
        ))}
      </div>

      {loadError && <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {loadError}</div>}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500" role="status">Loading problems…</p>
      ) : visible.length === 0 ? (
        <EmptyState title={active === 'review' ? 'Nothing needs your review' : active === 'open' ? 'No open problems' : 'No resolved problems yet'}
          hint={active === 'open' && canWork ? 'If something is holding up the work, report it here.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelectedId(p.id)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-slate-900">{p.category}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{p.activity_name ?? 'Whole project'}{p.tower ? ` · ${p.tower}` : ''}</p>
                  </div>
                  <ImpactChip p={p} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-700">{p.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {p.status === 'RESOLVED' ? `Resolved ${formatDate(p.resolved_date)}` : `Open ${p.days_open} day${p.days_open === 1 ? '' : 's'}`}
                  {p.owner ? ` · Owner: ${p.owner}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showReport && (
        <ReportProblemModal project={project} activities={activities} allowProjectWide={canApprove} onClose={() => setShowReport(false)}
          onReported={(p) => { setProblems((cur) => [p, ...cur]); setShowReport(false); setFilter('open'); setSelectedId(p.id); onChanged?.(); }} />
      )}
      {selected && <ProblemPanel problem={selected} canWork={canWork} canApprove={canApprove} onClose={() => setSelectedId(null)} onUpdated={replace} />}
    </div>
  );
};

const ProblemPanel: React.FC<{ problem: Problem; canWork: boolean; canApprove: boolean; onClose: () => void; onUpdated: (p: Problem) => void }> = ({ problem: p, canWork, canApprove, onClose, onUpdated }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [activityDays, setActivityDays] = useState(String(p.confirmed_delay_days ?? p.proposed_delay_days ?? ''));
  const [projectDays, setProjectDays] = useState(String(p.confirmed_project_delay_days ?? p.proposed_project_delay_days ?? ''));
  const [resolveNote, setResolveNote] = useState('');
  useEscape(onClose);

  useEffect(() => {
    setActivityDays(String(p.confirmed_delay_days ?? p.proposed_delay_days ?? ''));
    setProjectDays(String(p.confirmed_project_delay_days ?? p.proposed_project_delay_days ?? ''));
    setNote(p.impact_note ?? '');
  }, [p.id, p.proposed_delay_days, p.proposed_project_delay_days, p.confirmed_delay_days, p.confirmed_project_delay_days, p.impact_note]);

  const run = async (fn: () => Promise<Problem>) => {
    setBusy(true);
    setError(null);
    try { onUpdated(await fn()); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  const open = p.status !== 'RESOLVED';
  const noEstimate = p.proposed_delay_days === null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="problem-title" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="problem-title" className="text-lg font-semibold text-slate-900">{p.category}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{p.activity_name ?? 'Whole project'}{p.tower ? ` · ${p.tower}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ImpactChip p={p} />
          {!open && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Resolved</span>}
        </div>

        <p className="mb-3 text-sm text-slate-800">{p.description}</p>
        <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-500">
          <dt>Reported</dt><dd className="text-slate-700">{formatDate(p.opened_date)}{p.reported_by_name ? ` by ${p.reported_by_name}` : ''}</dd>
          {p.owner && (<><dt>Owner</dt><dd className="text-slate-700">{p.owner}</dd></>)}
          {p.expected_resolution && open && (<><dt>Fix expected</dt><dd className="text-slate-700">{formatDate(p.expected_resolution)}</dd></>)}
          {p.task_title && (<><dt>Task held up</dt><dd className="text-slate-700">{p.task_title}</dd></>)}
          {p.resolved_date && (<><dt>Resolved</dt><dd className="text-slate-700">{formatDate(p.resolved_date)}</dd></>)}
        </dl>
        {p.resolution_note && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><span className="font-medium">How it was fixed:</span> {p.resolution_note}</p>}

        <section className="mb-5 rounded-xl border border-slate-200 p-4" aria-label="Effect on the schedule">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Effect on the schedule</h3>
          {p.impact_status === 'CONFIRMED' && (
            <p className="mb-3 text-sm text-slate-800">
              <span className="font-medium">Confirmed{p.impact_decided_by_name ? ` by ${p.impact_decided_by_name}` : ''}:</span> holds up the activity by {days(p.confirmed_delay_days)}; moves the project end by {days(p.confirmed_project_delay_days)}.
              {p.impact_note && <span className="block text-slate-500">{p.impact_note}</span>}
            </p>
          )}
          {p.impact_status === 'NO_IMPACT' && (
            <p className="mb-3 text-sm text-slate-800"><span className="font-medium">No delay{p.impact_decided_by_name ? `, confirmed by ${p.impact_decided_by_name}` : ''}.</span>{p.impact_note && <span className="block text-slate-500">{p.impact_note}</span>}</p>
          )}
          {p.estimate_changed && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The latest estimate is {days(p.proposed_delay_days)} on the activity and {days(p.proposed_project_delay_days)} on the project end. {canApprove ? 'Review the confirmed numbers.' : 'The project manager will review.'}</p>
          )}
          <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">System estimate (not confirmed):</span> {p.proposal_note ?? 'None yet.'}</p>

          {canApprove && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pi-days" className="mb-1 block text-xs font-medium text-slate-600">Activity held up (days)</label>
                  <input id="pi-days" type="number" min={0} step={0.5} value={activityDays} onChange={(e) => setActivityDays(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="pi-pdays" className="mb-1 block text-xs font-medium text-slate-600">Project end moves (days)</label>
                  <input id="pi-pdays" type="number" min={0} step={0.5} value={projectDays} onChange={(e) => setProjectDays(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              {noEstimate && <p className="mt-2 text-xs text-slate-500">This problem is not tied to one activity, so enter the delay yourself.</p>}
              <label htmlFor="pi-note" className="mb-1 mt-3 block text-xs font-medium text-slate-600">Note (optional)</label>
              <input id="pi-note" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryButton disabled={busy || activityDays === ''} onClick={() => run(() => apiClient.decideProblemImpact(p.id, { decision: 'CONFIRM', days: Number(activityDays), project_days: Number(projectDays || 0), note: note.trim() || undefined }))}>
                  {p.impact_status === 'CONFIRMED' ? 'Update confirmed delay' : 'Confirm delay'}
                </PrimaryButton>
                <SecondaryButton disabled={busy} onClick={() => run(() => apiClient.decideProblemImpact(p.id, { decision: 'NO_IMPACT', note: note.trim() || undefined }))}>No delay</SecondaryButton>
              </div>
            </div>
          )}
        </section>

        {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}

        {open && canWork && (
          <div className="mt-auto border-t border-slate-100 pt-4">
            <label htmlFor="pr-note" className="mb-1 block text-sm font-medium text-slate-700">How was it fixed? <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="pr-note" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <PrimaryButton disabled={busy} onClick={() => run(() => apiClient.resolveProblem(p.id, resolveNote.trim() || undefined))}>Mark as resolved</PrimaryButton>
            {p.task_id && <p className="mt-2 text-xs text-slate-500">The held-up task will go back to “In progress”.</p>}
          </div>
        )}
      </aside>
    </div>
  );
};
