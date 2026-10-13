import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, HardHat, LogOut, Menu, X } from 'lucide-react';
import { AppNotification, Project, User } from '../types';
import { NotificationBell } from './notifications/NotificationBell';

interface NavbarProps {
  projects: Project[];
  activeProjectId?: number;
  currentUser?: User | null;
  onSelectProject: (id: number) => void;
  onToggleNavigation?: () => void;
  mobileNavOpen?: boolean;
  /** The menu is folded away on large screens. */
  navHidden?: boolean;
  onOpenLogProgress: () => void;
  onToggleAIAssistant: () => void;
  onOpenWeatherSoil?: () => void;
  onOpenValidation?: () => void;
  onLogout?: () => void;
  onOpenGeotechReview?: () => void;
  onOpenLogHindrance?: () => void;
  /** Hide the project name / switcher, e.g. on the all-projects page. */
  hideProject?: boolean;
  notifications?: AppNotification[];
  unreadNotifications?: number;
  onOpenNotification?: (n: AppNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects, activeProjectId, currentUser, onSelectProject, onToggleNavigation, mobileNavOpen = false, navHidden = false,
  onOpenLogProgress, onToggleAIAssistant, onOpenWeatherSoil, onOpenValidation, onLogout, onOpenGeotechReview, onOpenLogHindrance, hideProject = false,
  notifications = [], unreadNotifications = 0, onOpenNotification, onMarkAllNotificationsRead,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const showTools = currentUser?.role === 'Admin' || currentUser?.role === 'Project Manager';
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const close = (e: MouseEvent) => { if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setToolsOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [toolsOpen]);

  const tools: { label: string; run?: () => void }[] = [
    { label: 'Log daily progress', run: onOpenLogProgress },
    { label: 'Report a hindrance', run: onOpenLogHindrance },
    { label: 'Weather and soil', run: onOpenWeatherSoil },
    { label: 'Activity validation', run: onOpenValidation },
    { label: 'Geotechnical sign-off', run: onOpenGeotechReview },
    { label: 'AI assistant', run: onToggleAIAssistant },
  ].filter((t) => t.run);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white px-4">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleNavigation && (
            <button type="button" onClick={onToggleNavigation} aria-label="Show or hide menu" aria-expanded={mobileNavOpen || navHidden === false}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100">
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-amber-400"><HardHat className="h-5 w-5" aria-hidden /></div>
          <span className="hidden text-base font-semibold text-slate-900 sm:inline">Construction Intelligence</span>
          {hideProject ? null : projects.length > 1 ? (
            <select value={activeProject?.id || ''} onChange={(e) => onSelectProject(Number(e.target.value))} aria-label="Project"
              className="max-w-[220px] truncate rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : activeProject ? (
            <span className="truncate border-l border-slate-200 pl-3 text-sm text-slate-600">{activeProject.name}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {showTools && (
            <div className="relative" ref={toolsRef}>
              <button onClick={() => setToolsOpen((v) => !v)} aria-expanded={toolsOpen} aria-haspopup="menu"
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Tools <ChevronDown className="h-4 w-4" />
              </button>
              {toolsOpen && (
                <ul role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {tools.map((t) => (
                    <li key={t.label} role="none">
                      <button role="menuitem" onClick={() => { setToolsOpen(false); t.run?.(); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{t.label}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {currentUser && onOpenNotification && onMarkAllNotificationsRead && (
            <NotificationBell showProject={projects.length > 1} items={notifications} unread={unreadNotifications} onOpen={onOpenNotification} onMarkAllRead={onMarkAllNotificationsRead} />
          )}
          {currentUser && (
            <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-slate-900">{currentUser.full_name.replace(/\s*\(.*\)\s*$/, '')}</p>
                <p className="text-xs text-slate-500">{currentUser.role}</p>
              </div>
              {onLogout && (
                <button onClick={onLogout} aria-label="Sign out or switch role" title="Sign out / switch role" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                  <LogOut className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
