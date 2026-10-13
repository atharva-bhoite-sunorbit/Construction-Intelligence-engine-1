import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { apiClient } from '../api/client';
import { Activity, FocusTarget, Project, SequenceItem } from '../types';
import { ActivityDetailPanel } from '../components/activity/ActivityDetailPanel';
import { EmptyState, PageHeader, ProgressBar, StatusChip, errorText, formatDate } from '../components/simple/ui';

type Filter = 'ALL' | 'IN_PROGRESS' | 'READY' | 'DELAYED' | 'COMPLETED';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'READY', label: 'Ready to start' },
  { id: 'DELAYED', label: 'Late' },
  { id: 'COMPLETED', label: 'Done' },
];
const PAGE_SIZE = 40;
const today = () => new Date().toISOString().slice(0, 10);

/** What to show for one planned activity: done, running, late, ready to start, or waiting on earlier work. */
const shownState = (i: SequenceItem): 'COMPLETED' | 'DELAYED' | 'IN_PROGRESS' | 'READY' | 'WAITING' => {
  if (i.state === 'DONE') return 'COMPLETED';
  if (i.end_date && i.end_date < today() && i.progress_percent < 100) return 'DELAYED';
  return i.state;
};

export const SchedulePage: React.FC<{ project: Project; activities: Activity[]; focus?: FocusTarget | null; onOpenTab?: (tab: string) => void }> = ({ project, focus, onOpenTab }) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [items, setItems] = useState<SequenceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Filter>('ALL');
  const [tower, setTower] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    let alive = true;
    setItems(null);
    apiClient.getSequence(project.id).then((rows) => alive && setItems(rows)).catch((err) => alive && setError(errorText(err)));
    return () => { alive = false; };
  }, [project.id]);

  useEffect(() => {
    if (focus?.type === 'activity') setOpenId(focus.id);
  }, [focus?.nonce, focus?.type, focus?.id]);

  const towers = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.tower).filter(Boolean))) as string[], [items]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      const s = shownState(i);
      return (!tower || i.tower === tower) && (!q || i.name.toLowerCase().includes(q))
        && (status === 'ALL' || s === status || (status === 'IN_PROGRESS' && i.state === 'IN_PROGRESS'));
    });
  }, [items, status, tower, search]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Schedule" subtitle={`${project.name} · the planned order of work and how it is going.`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={status === f.id} onClick={() => { setStatus(f.id); setLimit(PAGE_SIZE); }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${status === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {towers.length > 1 && (
            <select value={tower} onChange={(e) => { setTower(e.target.value); setLimit(PAGE_SIZE); }} aria-label="Tower" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option value="">All towers</option>
              {towers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }} placeholder="Search"
              aria-label="Search activities" className="w-44 rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm" />
          </div>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
      {items === null && !error && <p className="py-12 text-center text-sm text-slate-500" role="status">Loading the plan…</p>}
      {items !== null && rows.length === 0 && <EmptyState title="No activities match" hint="Try another filter." />}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="w-14 px-4 py-3 font-medium">Step</th>
                <th scope="col" className="px-4 py-3 font-medium">Activity</th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Planned</th>
                <th scope="col" className="px-4 py-3 font-medium">Progress</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, limit).map((i) => {
                const shown = shownState(i);
                return (
                  <tr key={i.activity_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(i.activity_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(i.activity_id); }} tabIndex={0} aria-label={`Details: ${i.name}`}>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{i.step}</td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate font-medium text-slate-900">{i.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {i.tower}
                        {i.state === 'WAITING' && <span className="ml-2 text-amber-700">After: {i.waiting_on.slice(0, 2).join(', ')}</span>}
                      </p>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 md:table-cell">{formatDate(i.start_date)} – {formatDate(i.end_date)}</td>
                    <td className="w-40 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={i.progress_percent} tone={shown === 'COMPLETED' ? 'green' : shown === 'DELAYED' ? 'red' : 'blue'} className="flex-1" />
                        <span className="w-9 text-right tabular-nums text-slate-600">{Math.round(i.progress_percent)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {shown === 'READY' ? <StatusChip status="APPROVED" label="Ready to start" />
                        : shown === 'WAITING' ? <StatusChip status="DRAFT" label="Waiting" />
                        : <StatusChip status={shown} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div className="mt-4 text-center">
          <button onClick={() => setLimit((n) => n + PAGE_SIZE)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Show more ({rows.length - limit} left)
          </button>
        </div>
      )}
      {openId !== null && (
        <ActivityDetailPanel activityId={openId} onClose={() => setOpenId(null)}
          onOpenTasks={onOpenTab ? () => onOpenTab('tasks') : undefined} onOpenProblems={onOpenTab ? () => onOpenTab('problems') : undefined} />
      )}
    </div>
  );
};
