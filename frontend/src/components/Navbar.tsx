import React from 'react';
import { Building2, Plus, ClipboardCheck, Sparkles, HardHat, ChevronDown, Wind, Layers, ShieldCheck } from 'lucide-react';
import { Project } from '../types';

interface NavbarProps {
  projects: Project[];
  activeProjectId?: number;
  onSelectProject: (id: number) => void;
  onOpenCreateProject: () => void;
  onOpenLogProgress: () => void;
  onToggleAIAssistant: () => void;
  onOpenWeatherSoil?: () => void;
  onOpenValidation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenLogProgress,
  onToggleAIAssistant,
  onOpenWeatherSoil,
  onOpenValidation,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between shadow-xs">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-sm text-white font-black text-lg">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 tracking-tight text-sm">CONSTRUCTION</span>
              <span className="font-extrabold text-brand-600 tracking-tight text-sm">INTEL</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 border border-brand-200">
                ENTERPRISE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-tight leading-none">
              AI/ML PLANNING & RISK CONTROL
            </div>
          </div>
        </div>

        {/* Project Selector Dropdown */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Active Project:</span>
          <select
            value={activeProject?.id || ''}
            onChange={(e) => onSelectProject(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 focus:bg-white max-w-[280px] truncate shadow-xs transition-colors"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name} ({p.construction_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCreateProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 text-brand-600" />
          <span>New Project</span>
        </button>

        {onOpenWeatherSoil && (
          <button
            onClick={onOpenWeatherSoil}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold transition-all shadow-xs"
          >
            <Wind className="w-4 h-4 text-cyan-600" />
            <span>Weather & Soil Intel</span>
          </button>
        )}

        <button
          onClick={onOpenLogProgress}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all shadow-xs"
        >
          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          <span>Log Daily Progress</span>
        </button>

        <button
          onClick={onToggleAIAssistant}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Copilot</span>
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-xs font-bold shadow-xs">
            MB
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">Marcus Brody</div>
            <div className="text-[10px] text-slate-500 leading-tight">Project Director</div>
          </div>
        </div>
      </div>
    </header>
  );
};
