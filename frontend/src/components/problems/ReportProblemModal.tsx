import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Activity, Problem, Project, Task } from '../../types';
import { PrimaryButton, SecondaryButton, errorText, formatDate, useEscape } from '../simple/ui';

interface Props {
  project: Project;
  activities: Activity[];
  /** When opened from a running task the problem is tied to it, and the task is held up. */
  task?: Task;
  /** PM and Admin may report a project-wide problem that is not tied to one activity. */
  allowProjectWide?: boolean;
  onClose: () => void;
  onReported: (problem: Problem) => void;
}

const SEVERITIES: { id: 'LOW' | 'MEDIUM' | 'HIGH'; label: string }[] = [
  { id: 'LOW', label: 'Minor' },
  { id: 'MEDIUM', label: 'Serious' },
  { id: 'HIGH', label: 'Stopping work' },
];

export const ReportProblemModal: React.FC<Props> = ({ project, activities, task, allowProjectWide, onClose, onReported }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [owner, setOwner] = useState('');
  const [fixBy, setFixBy] = useState('');
  const [search, setSearch] = useState('');
  const [activityId, setActivityId] = useState<number | null>(null);
  const [projectWide, setProjectWide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  useEffect(() => {
    let alive = true;
    apiClient.getProblemCategories().then((c) => { if (alive) { setCategories(c); setCategory((cur) => cur || c[0] || ''); } }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities
      .filter((a) => a.status !== 'COMPLETED' && a.work_package !== 'Summary Header' && (!q || a.name.toLowerCase().includes(q)))
      .sort((a, b) => Number((b.status === 'IN_PROGRESS')) - Number((a.status === 'IN_PROGRESS')) || a.start_date.localeCompare(b.start_date))
      .slice(0, 30);
  }, [activities, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onReported(await apiClient.reportProblem(project.id, {
        category, description: description.trim(), severity, owner: owner.trim() || undefined,
        expected_resolution: fixBy || undefined,
        task_id: task?.id, activity_id: task ? undefined : (projectWide ? undefined : activityId ?? undefined),
      }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const needsActivity = !task && !projectWide;
  const ready = category && description.trim().length >= 3 && (!needsActivity || activityId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rp-title" onClick={(e) => e.stopPropagation()}>
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="rp-title" className="text-lg font-semibold text-slate-900">Report a problem</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        {task ? (
          <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Holding up: <span className="font-medium">{task.title}</span>. The task will be marked blocked until this is fixed.</p>
        ) : (
          <>
            {allowProjectWide && (
              <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={projectWide} onChange={(e) => setProjectWide(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                Affects the whole project, not one activity
              </label>
            )}
            {!projectWide && (
              <>
                <label htmlFor="rp-search" className="mb-1 block text-sm font-medium text-slate-700">Which activity is it holding up?</label>
                <input id="rp-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <ul className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Activities">
                  {choices.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No matching activity.</li>}
                  {choices.map((a) => (
                    <li key={a.id} role="option" aria-selected={activityId === a.id}>
                      <button type="button" onClick={() => setActivityId(a.id)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${activityId === a.id ? 'bg-blue-50' : ''}`}>
                        <span className="min-w-0 truncate text-slate-800">{a.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{a.tower} · {formatDate(a.start_date)}</span>
                        {activityId === a.id && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <label htmlFor="rp-category" className="mb-1 block text-sm font-medium text-slate-700">What kind of problem?</label>
        <select id="rp-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label htmlFor="rp-desc" className="mb-1 block text-sm font-medium text-slate-700">What is wrong?</label>
        <textarea id="rp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required maxLength={2000}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Rebar delivery for the 3rd floor is two days late" />

        <fieldset className="mb-4">
          <legend className="mb-1 text-sm font-medium text-slate-700">How bad is it?</legend>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((s) => (
              <button key={s.id} type="button" aria-pressed={severity === s.id} onClick={() => setSeverity(s.id)}
                className={`rounded-lg border px-2 py-2 text-sm ${severity === s.id ? 'border-blue-600 bg-blue-50 font-medium text-blue-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{s.label}</button>
            ))}
          </div>
        </fieldset>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rp-owner" className="mb-1 block text-sm font-medium text-slate-700">Who will fix it? <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="rp-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Person or team" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="rp-fix" className="mb-1 block text-sm font-medium text-slate-700">Fixed by <span className="font-normal text-slate-400">(if known)</span></label>
            <input id="rp-fix" type="date" value={fixBy} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFixBy(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={!ready || busy}>{busy ? 'Reporting…' : 'Report problem'}</PrimaryButton>
        </div>
      </form>
    </div>
  );
};
