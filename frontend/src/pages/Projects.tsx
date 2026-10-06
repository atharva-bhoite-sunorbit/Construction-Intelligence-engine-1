import React, { useState } from 'react';
import { Building2, Plus, Calendar, MapPin, Layers, ArrowRight, ShieldCheck, HardHat, Users, CheckCircle2 } from 'lucide-react';
import { Project } from '../types';
import { ManageStageEngineersModal } from '../components/ManageStageEngineersModal';

interface ProjectsPageProps {
  projects: Project[];
  activeProjectId?: number;
  onSelectProject: (id: number) => void;
  onOpenCreateModal: () => void;
  onProjectUpdated?: (project: Project) => void;
}

const STAGE_SHORT_CODES: Record<string, { label: string; color: string }> = {
  'Pre-Construction': { label: 'Pre-Con', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'Substructure': { label: 'Sub', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Superstructure': { label: 'Super', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'MEP': { label: 'MEP', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Finishing': { label: 'Finish', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Handover': { label: 'Handover', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  onProjectUpdated,
}) => {
  const [managingEngineersProject, setManagingEngineersProject] = useState<Project | null>(null);

  const handleOpenEngineerManager = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setManagingEngineersProject(project);
  };

  const handleEngineerSaved = (updated: Project) => {
    if (onProjectUpdated) {
      onProjectUpdated(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Construction Projects</h1>
          <p className="text-xs text-slate-500">
            Portfolio monitoring across Residential, High-Rise, Industrial, Commercial, and Infrastructure assets with Stage-Wise Site Engineering
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p) => {
          const isCurrent = p.id === activeProjectId;
          const stageEngineers = p.stage_engineers || {};
          const totalEngineers = Object.values(stageEngineers).reduce(
            (sum, list) => sum + (list?.length || 0),
            0
          );
          const activeStagesCount = Object.values(stageEngineers).filter(
            (list) => (list?.length || 0) > 0
          ).length;

          return (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={`rounded-xl border bg-white p-5 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-brand-500/70 relative overflow-hidden flex flex-col justify-between ${
                isCurrent ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-200'
              }`}
            >
              <div
                className={`absolute top-0 right-0 left-0 h-1 ${
                  isCurrent ? 'bg-gradient-to-r from-brand-600 to-indigo-600' : 'bg-slate-100'
                }`}
              />

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {p.construction_type}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">{p.code}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1">{p.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{p.location}</span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                  {p.description || 'Enterprise construction facility under active planning and execution.'}
                </p>

                {/* Site Engineers Stage Badge Summary */}
                <div className="mb-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <HardHat className="w-3.5 h-3.5 text-brand-600" />
                      <span>Stage Site Engineers:</span>
                      <span className="font-mono font-bold text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200 text-[11px]">
                        {totalEngineers}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleOpenEngineerManager(e, p)}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:underline flex items-center gap-1"
                    >
                      <span>Manage</span>
                    </button>
                  </div>

                  {/* Stage breakdown tags */}
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(STAGE_SHORT_CODES).map(([stageKey, meta]) => {
                      const count = (stageEngineers[stageKey] || []).length;
                      return (
                        <span
                          key={stageKey}
                          title={`${stageKey}: ${count} engineer(s) assigned`}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                            count > 0 ? meta.color : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
                          }`}
                        >
                          <span>{meta.label}</span>
                          <span className="font-mono font-bold">({count})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                    <span>Overall Progress</span>
                    <span className="text-slate-900 font-mono font-bold">{p.overall_progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${p.overall_progress || 0}%` }}
                      className="bg-brand-600 h-full rounded-full transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Floors:</span>{' '}
                    <span className="text-slate-800 font-semibold">{p.num_floors} Floors</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Built-Up:</span>{' '}
                    <span className="text-slate-800 font-semibold">{p.built_up_area?.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Target Finish:</span>{' '}
                    <span className="text-slate-800 font-semibold">
                      {p.target_completion_date ? new Date(p.target_completion_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Activities:</span>{' '}
                    <span className="text-slate-800 font-semibold">{p.total_activities || 0}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'IN_PROGRESS'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-brand-50 text-brand-700 border border-brand-200'
                    }`}
                  >
                    {p.status}
                  </span>

                  <span className="text-xs font-semibold text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    {isCurrent ? 'Active Workspace' : 'Select Project'}{' '}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal to manage stage engineers for selected project */}
      {managingEngineersProject && (
        <ManageStageEngineersModal
          isOpen={true}
          onClose={() => setManagingEngineersProject(null)}
          project={managingEngineersProject}
          onProjectUpdated={(updated) => {
            handleEngineerSaved(updated);
            setManagingEngineersProject(updated);
          }}
        />
      )}
    </div>
  );
};
