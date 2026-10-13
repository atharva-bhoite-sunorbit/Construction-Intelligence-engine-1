import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { ProjectCover } from '../components/simple/ProjectCover';
import { apiClient } from '../api/client';
import { PortfolioProject } from '../types';
import { EmptyState, PageHeader, ProgressBar, errorText, formatDate } from '../components/simple/ui';

type Health = { label: string; chip: string; tone: 'blue' | 'green' | 'red' };

const healthOf = (p: PortfolioProject): Health => {
  if (p.largest_confirmed_project_delay_days > 0) return { label: `Project end moves ${p.largest_confirmed_project_delay_days} days`, chip: 'bg-rose-100 text-rose-800', tone: 'red' };
  if (p.late_activities > 0) return { label: `${p.late_activities} activit${p.late_activities === 1 ? 'y' : 'ies'} late`, chip: 'bg-amber-100 text-amber-800', tone: 'red' };
  if (p.problems_waiting_for_review > 0) return { label: 'Problems to review', chip: 'bg-amber-100 text-amber-800', tone: 'blue' };
  return { label: 'On track', chip: 'bg-emerald-100 text-emerald-800', tone: 'green' };
};

const severity = (p: PortfolioProject) => p.largest_confirmed_project_delay_days * 10 + p.late_activities + p.problems_waiting_for_review;

export const PortfolioPage: React.FC<{ onOpenProject: (projectId: number) => void; currentUserName?: string }> = ({ onOpenProject, currentUserName }) => {
  const [projects, setProjects] = useState<PortfolioProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getPortfolio().then((rows) => alive && setProjects(rows)).catch((err) => alive && setError(errorText(err)));
    return () => { alive = false; };
  }, []);

  const sorted = useMemo(() => [...(projects ?? [])].sort((a, b) => severity(b) - severity(a) || a.name.localeCompare(b.name)), [projects]);
  const totals = useMemo(() => ({
    late: sorted.reduce((n, p) => n + p.late_activities, 0),
    review: sorted.reduce((n, p) => n + p.problems_waiting_for_review, 0),
    delayed: sorted.filter((p) => p.largest_confirmed_project_delay_days > 0).length,
  }), [sorted]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Your projects"
        subtitle={currentUserName ? `${currentUserName.replace(/\s*\(.*\)\s*$/, '')} · ${sorted.length} project${sorted.length === 1 ? '' : 's'}` : undefined}
      />

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
      {projects === null && !error && <p className="py-12 text-center text-sm text-slate-500" role="status">Loading projects…</p>}
      {projects !== null && sorted.length === 0 && <EmptyState title="No projects yet" hint="Ask an administrator to add you to a project." />}

      {sorted.length > 1 && (
        <p className="mb-5 text-sm text-slate-600">
          {totals.delayed > 0 ? `${totals.delayed} project${totals.delayed === 1 ? ' has' : 's have'} confirmed delay. ` : 'No project has confirmed delay. '}
          {totals.late > 0 ? `${totals.late} activities are past their planned finish. ` : ''}
          {totals.review > 0 ? `${totals.review} problem${totals.review === 1 ? ' is' : 's are'} waiting for a project manager to review.` : ''}
        </p>
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {sorted.map((p) => {
          const h = healthOf(p);
          const delayed = p.expected_finish && p.target_completion_date && p.expected_finish !== p.target_completion_date;
          return (
            <li key={p.id}>
              <button onClick={() => onOpenProject(p.id)} className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                <div className="relative">
                  <ProjectCover name={p.name} src={p.cover_image_url} className="h-48" />
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm ${h.chip}`}>{h.label}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{p.name}</h2>
                  {p.location && <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" aria-hidden />{p.location}</p>}

                  <div className="mt-4 mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-semibold tabular-nums text-slate-900">{p.progress_percent.toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={p.progress_percent} tone={h.tone} />

                  {p.current_work.length > 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="text-slate-500">Now building: </span>
                      {p.current_work.map((w) => `${w.name}${w.towers.length ? ` (${w.towers.length > 1 ? 'Towers' : 'Tower'} ${w.towers.map((t) => t.replace('Tower ', '')).join(', ')})` : ''}`).join('; ')}
                    </p>
                  )}

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-sm">
                    <div><dt className="text-slate-500">Late</dt><dd className={`text-lg font-semibold tabular-nums ${p.late_activities ? 'text-rose-700' : 'text-slate-900'}`}>{p.late_activities}</dd></div>
                    <div><dt className="text-slate-500">Open problems</dt><dd className="text-lg font-semibold tabular-nums text-slate-900">{p.open_problems}{p.problems_waiting_for_review > 0 && <span className="ml-1 text-xs font-normal text-amber-700">{p.problems_waiting_for_review} to review</span>}</dd></div>
                    <div><dt className="text-slate-500">Finish</dt><dd className="text-sm font-medium text-slate-900">{formatDate(p.expected_finish ?? p.target_completion_date)}{delayed && <span className="block text-xs font-normal text-rose-700">planned {formatDate(p.target_completion_date)}</span>}</dd></div>
                  </dl>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
