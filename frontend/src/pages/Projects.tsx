import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  HardHat,
  Layers3,
  MapPin,
  Ruler,
  Users,
} from 'lucide-react';
import { Project } from '../types';
import { ManageStageEngineersModal } from '../components/ManageStageEngineersModal';

interface ProjectsPageProps {
  projects: Project[];
  activeProjectId?: number;
  onSelectProject: (id: number) => void;
  onOpenCreateModal?: () => void;
  onProjectUpdated?: (project: Project) => void;
}

const STAGE_SHORT_CODES: Record<string, { label: string; color: string }> = {
  'Pre-Construction': { label: 'Pre-construction', color: 'bg-stone-100 text-stone-700 border-stone-200' },
  Substructure: { label: 'Substructure', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  Superstructure: { label: 'Superstructure', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  MEP: { label: 'MEP', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Finishing: { label: 'Finishing', color: 'bg-lime-50 text-lime-800 border-lime-200' },
  Handover: { label: 'Handover', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
};

const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not set'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatStatus = (status: string) =>
  status.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  onProjectUpdated,
}) => {
  const [managingEngineersProject, setManagingEngineersProject] = useState<Project | null>(null);
  const activeProjects = projects.filter((project) => project.status === 'IN_PROGRESS').length;
  const totalActivities = projects.reduce((sum, project) => sum + (project.total_activities || 0), 0);
  const averageProgress = projects.length
    ? Math.round(projects.reduce((sum, project) => sum + (project.overall_progress || 0), 0) / projects.length)
    : 0;

  const handleEngineerSaved = (updated: Project) => {
    onProjectUpdated?.(updated);
    setManagingEngineersProject(updated);
  };

  return (
    <div className="-m-4 min-h-full space-y-6 bg-stone-50 p-4 pb-8 text-stone-900 lg:-m-7 lg:p-7">
      <header className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white px-6 py-6 shadow-sm sm:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-100/70 via-orange-50/40 to-transparent sm:block" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
              <Building2 className="h-3.5 w-3.5" />
              Project portfolio
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">Project overview</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
              A clear view of project delivery, site teams, and the milestones that carry each build through to handover.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live portfolio
            </span>
            {onOpenCreateModal && (
              <button
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                <Building2 className="h-4 w-4" />
                Add project
              </button>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Projects tracked', value: projects.length, icon: Building2, tone: 'text-amber-700 bg-amber-50' },
          { label: 'In delivery', value: activeProjects, icon: Activity, tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'Scheduled activities', value: totalActivities.toLocaleString(), icon: Layers3, tone: 'text-stone-700 bg-stone-100' },
          { label: 'Portfolio progress', value: `${averageProgress}%`, icon: CheckCircle2, tone: 'text-orange-700 bg-orange-50' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-stone-500">{label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-mono text-2xl font-bold tracking-tight text-stone-950 tabular-nums">{value}</div>
          </div>
        ))}
      </section>

      <section aria-label="Projects" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-stone-900">Active projects</h2>
            <p className="mt-1 text-xs text-stone-500">Select a project to open its schedule and live site controls.</p>
          </div>
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-stone-600">
            {projects.length.toString().padStart(2, '0')} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
            <Building2 className="mx-auto h-9 w-9 text-stone-400" />
            <h3 className="mt-4 text-base font-semibold text-stone-900">No projects to display</h3>
            <p className="mt-1 text-sm text-stone-500">Projects will appear here when they are available in the portfolio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {projects.map((project) => {
              const isCurrent = project.id === activeProjectId;
              const stageEngineers = project.stage_engineers || {};
              const totalEngineers = Object.values(stageEngineers).reduce(
                (sum, engineers) => sum + (engineers?.length || 0),
                0
              );
              const activeStagesCount = Object.values(stageEngineers).filter(
                (engineers) => (engineers?.length || 0) > 0
              ).length;
              const progress = Math.min(100, Math.max(0, project.overall_progress || 0));

              return (
                <article
                  key={project.id}
                  className={`group overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                    isCurrent ? 'border-amber-300 ring-2 ring-amber-200/70' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="border-l-4 border-amber-500 bg-stone-900 px-5 py-5 text-white sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
                            {project.construction_type}
                          </span>
                          <span className="font-mono text-[11px] font-medium tracking-wide text-stone-300">{project.code}</span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">{project.name}</h3>
                        <div className="mt-2 flex items-start gap-2 text-sm leading-5 text-stone-300">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          <span>{project.location}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
                          project.status === 'IN_PROGRESS'
                            ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                            : 'border-white/15 bg-white/10 text-stone-200'
                        }`}
                      >
                        {formatStatus(project.status)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-5 p-5 sm:p-6">
                    <p className="line-clamp-3 text-sm leading-6 text-stone-600">
                      {project.description || 'Project details and delivery scope will be updated as planning progresses.'}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Towers', value: project.num_towers || 0, icon: Building2 },
                        { label: 'Floors', value: project.num_floors || 0, icon: Layers3 },
                        { label: 'Built-up area', value: `${(project.built_up_area || 0).toLocaleString()} m²`, icon: Ruler },
                        { label: 'Activities', value: project.total_activities || 0, icon: Activity },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50/70 px-3 py-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            <Icon className="h-3.5 w-3.5 text-amber-700" />
                            {label}
                          </div>
                          <div className="mt-2 font-mono text-lg font-bold leading-none text-stone-900 tabular-nums">{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-stone-700">Overall progress</div>
                          <div className="mt-1 text-[11px] text-stone-500">Measured against the current delivery plan</div>
                        </div>
                        <span className="font-mono text-xl font-bold text-stone-950 tabular-nums">{progress.toFixed(1)}%</span>
                      </div>
                      <div
                        className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100"
                        role="progressbar"
                        aria-label={`${project.name} overall progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-orange-500 transition-[width] duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-stone-100 pt-3 text-xs">
                        <div className="flex items-center gap-2 text-stone-600">
                          <CalendarDays className="h-4 w-4 shrink-0 text-amber-700" />
                          <span><span className="text-stone-400">Start </span>{formatDate(project.planned_start_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-600">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span><span className="text-stone-400">Target </span>{formatDate(project.target_completion_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-800 shadow-sm ring-1 ring-amber-100">
                            <HardHat className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-xs font-bold text-stone-800">Stage engineering team</div>
                            <div className="mt-0.5 text-[11px] text-stone-500">
                              {totalEngineers} assigned · {activeStagesCount} of {Object.keys(STAGE_SHORT_CODES).length} stages staffed
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setManagingEngineersProject(project)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Manage team
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.entries(STAGE_SHORT_CODES).map(([stageKey, meta]) => {
                          const count = (stageEngineers[stageKey] || []).length;
                          return (
                            <div
                              key={stageKey}
                              title={`${stageKey}: ${count} engineer(s) assigned`}
                              className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold ${meta.color}`}
                            >
                              <span className="truncate">{meta.label}</span>
                              <span className="font-mono tabular-nums">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                        isCurrent
                          ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                          : 'bg-stone-900 text-white hover:bg-stone-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isCurrent && <CheckCircle2 className="h-4 w-4 text-amber-800" />}
                        {isCurrent ? 'Open active workspace' : 'Open project workspace'}
                      </span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {managingEngineersProject && (
        <ManageStageEngineersModal
          isOpen={true}
          onClose={() => setManagingEngineersProject(null)}
          project={managingEngineersProject}
          onProjectUpdated={handleEngineerSaved}
        />
      )}
    </div>
  );
};
