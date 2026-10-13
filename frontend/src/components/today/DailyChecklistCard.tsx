import React, { useCallback, useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { DailyChecklist } from '../../types';
import { ProgressBar, errorText } from '../simple/ui';

/**
 * The person's checklist for today: the same steps every day, in order, and none can be skipped.
 * A step opens once the step before it is done; unticking a step clears the steps after it.
 */
export const DailyChecklistCard: React.FC<{ projectId: number }> = ({ projectId }) => {
  const [list, setList] = useState<DailyChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient.getDailyChecklist(projectId).then(setList).catch((e) => setError(errorText(e)));
  }, [projectId]);
  useEffect(() => { setList(null); load(); }, [load]);

  if (!list || list.total === 0) return null;
  const allDone = list.done === list.total;

  const toggle = async (itemId: number, step: number, next: boolean) => {
    const laterDone = list.items.some((i) => i.step > step && i.done);
    if (!next && laterDone && !window.confirm('Unticking this step also clears the steps after it. Continue?')) return;
    setBusy(true);
    setError(null);
    try { setList(await apiClient.setDailyStep(projectId, itemId, next)); } catch (e) { setError(errorText(e)); load(); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="My checklist today">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">My checklist today</h2>
        <span className={`text-sm font-medium tabular-nums ${allDone ? 'text-emerald-700' : 'text-slate-600'}`}>{list.done}/{list.total}</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">{list.role}: in order, no step skipped.</p>
      <ProgressBar value={(list.done / list.total) * 100} tone={allDone ? 'green' : 'blue'} className="mb-4" />
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
      <ol className="space-y-1">
        {list.items.map((it) => (
          <li key={it.id}>
            <label className={`flex items-start gap-3 rounded-lg px-2 py-2 ${it.locked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-slate-50'}`}>
              <input type="checkbox" className="sr-only" checked={it.done} disabled={busy || it.locked || !list.editable}
                onChange={(e) => toggle(it.id, it.step, e.target.checked)} aria-label={`Step ${it.step}: ${it.name}`} />
              <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                it.done ? 'bg-emerald-600 text-white' : it.locked ? 'bg-slate-200 text-slate-500' : 'bg-white text-blue-700 ring-2 ring-blue-600'}`}>
                {it.done ? <Check className="h-3.5 w-3.5" /> : it.locked ? <Lock className="h-3 w-3" /> : it.step}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm ${it.done ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}`}>{it.name}</span>
                {!it.done && it.description && <span className="block text-xs text-slate-500">{it.description}</span>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      {allDone && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">All done for today.</p>}
    </section>
  );
};
