import React from 'react';
import {
  Building2, Plus, ClipboardCheck, Sparkles, HardHat,
  ChevronDown, Wind, Layers, ShieldCheck, LogIn, LogOut, Menu, X,
  UserCheck, AlertTriangle, Pickaxe, Bell
} from 'lucide-react';
import { Project, User } from '../types';

interface NavbarProps {
  projects: Project[];
  activeProjectId?: number;
  currentUser?: User | null;
  onSelectProject: (id: number) => void;
  onToggleNavigation?: () => void;
  mobileNavOpen?: boolean;
  onOpenCreateProject?: () => void;
  onOpenLogProgress: () => void;
  onToggleAIAssistant: () => void;
  onOpenWeatherSoil?: () => void;
  onOpenValidation?: () => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onOpenGeotechReview?: () => void;
  onOpenLogHindrance?: () => void;
  hindranceCount?: number;
  onOpenHindranceRegister?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  activeProjectId,
  currentUser,
  onSelectProject,
  onToggleNavigation,
  mobileNavOpen = false,
  onOpenCreateProject,
  onOpenLogProgress,
  onToggleAIAssistant,
  onOpenWeatherSoil,
  onOpenValidation,
  onOpenLoginModal,
  onLogout,
  onOpenGeotechReview,
  onOpenLogHindrance,
  hindranceCount = 0,
  onOpenHindranceRegister,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200/90 bg-white/95 px-3 backdrop-blur-md shadow-xs sm:px-4 xl:px-6">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-4">
        {/* Brand & Project Selector */}
        <div className="flex min-w-0 items-center gap-3 xl:gap-5">
          {onToggleNavigation && (
            <button
              type="button"
              onClick={onToggleNavigation}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
              <HardHat className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-slate-900">CONSTRUCTION</span>
                <span className="text-xs font-bold tracking-wider text-amber-700">INTEL</span>
                <span className="hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:inline-flex">
                  Enterprise
                </span>
              </div>
              <div className="hidden text-[10px] font-medium tracking-wide text-slate-500 xl:block">
                Deterministic CPM & AI Risk Engine
              </div>
            </div>
          </div>

          {/* Project Selector Dropdown */}
          <div className="hidden items-center gap-2 border-l border-slate-200 pl-4 md:flex">
            <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-slate-500 xl:inline">Project:</span>
            <select
              value={activeProject?.id || ''}
              onChange={(e) => onSelectProject(Number(e.target.value))}
              className="max-w-[150px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 focus:border-amber-500 focus:bg-white xl:max-w-[280px] xl:px-3"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} • {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-shrink-0 items-center gap-1.5 xl:gap-2">
          {onOpenCreateProject && (
            <button
              onClick={onOpenCreateProject}
              title="Create a new project"
              aria-label="New Project"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 xl:px-3"
            >
              <Plus className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden xl:inline">New Project</span>
            </button>
          )}

          {onOpenWeatherSoil && (
            <button
              onClick={onOpenWeatherSoil}
              title="Weather and soil intelligence"
              aria-label="Weather and soil intelligence"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 xl:flex xl:px-3"
            >
              <Wind className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden xl:inline">Weather & Soil</span>
            </button>
          )}

          <button
            onClick={onOpenLogProgress}
            title="Log daily progress"
            aria-label="Log daily progress"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition-all hover:bg-emerald-100 xl:px-3"
          >
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden xl:inline">Log Daily Progress</span>
          </button>

          {onOpenGeotechReview && (
            <button
              onClick={onOpenGeotechReview}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 2xl:flex"
              title="Open Geotechnical & Project Activities Manager Decision Gate"
            >
              <Pickaxe className="h-3.5 w-3.5 text-slate-600" />
              <span>Geotech Gate</span>
            </button>
          )}

          {currentUser?.role === 'Admin' && onOpenHindranceRegister && (
            <button
              type="button"
              onClick={onOpenHindranceRegister}
              aria-label={`Open hindrance register, ${hindranceCount} open records`}
              title="Open Admin hindrance notifications and register"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
            >
              <Bell className="h-4 w-4" />
              {hindranceCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                  {hindranceCount > 99 ? '99+' : hindranceCount}
                </span>
              )}
            </button>
          )}

          {onOpenLogHindrance && (
            <button
              onClick={onOpenLogHindrance}
              className="hidden items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm transition-all hover:bg-amber-100 2xl:flex"
              title="Log hindrance in persistent register"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Log Hindrance</span>
            </button>
          )}

          <button
            onClick={onToggleAIAssistant}
            title="Open AI Copilot"
            aria-label="AI Copilot"
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 xl:px-3"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xl:inline">AI Copilot</span>
          </button>

          <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {currentUser.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden text-left 2xl:block">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <span>{currentUser.full_name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="max-w-[130px] truncate text-[10px] text-slate-500 font-mono">{currentUser.email}</div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                title="Manager login"
                aria-label="Manager login"
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 xl:px-3"
              >
                <LogIn className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden xl:inline">Manager Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
