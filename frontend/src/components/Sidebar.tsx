import React, { useState } from 'react';
import { AlertTriangle, Building2, CalendarDays, ChevronDown, ClipboardList, Box, CalendarCheck, LayoutDashboard, ListChecks, FileSpreadsheet } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role?: string;
  mobileOpen?: boolean;
  /** Hidden on large screens (the user folded it away). */
  collapsed?: boolean;
  isSyncing?: boolean;
  isSyncError?: boolean;
  lastSyncAt?: Date | null;
  /** True when the signed-in user belongs to more than one project. */
  multiProject?: boolean;
  /** Small counts shown next to a menu item, e.g. problems waiting for review. */
  badges?: Record<string, number>;
}

type NavItem = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

const PORTFOLIO: NavItem = { id: 'portfolio', label: 'All projects', icon: Building2 };
const OVERVIEW: NavItem = { id: 'overview', label: 'Overview', icon: LayoutDashboard };
const BUILDING: NavItem = { id: 'building', label: '3D view', icon: Box };
const TODAY: NavItem = { id: 'today', label: 'Today', icon: CalendarCheck };
const TASKS: NavItem = { id: 'tasks', label: 'Tasks', icon: ListChecks };
const MY_TASKS: NavItem = { id: 'tasks', label: 'My tasks', icon: ListChecks };
const PROBLEMS: NavItem = { id: 'problems', label: 'Problems', icon: AlertTriangle };
const SCHEDULE: NavItem = { id: 'schedule', label: 'Schedule', icon: CalendarDays };
const REPORTS: NavItem = { id: 'reports', label: 'Reports', icon: FileSpreadsheet };

/** Everything that used to be on the main menu. Still available, just out of the way. */
const MORE_TOOLS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Detailed dashboard' },
  { id: 'structure-lifecycle', label: 'Structure plan' },
  { id: 'activities', label: 'Activities (detailed)' },
  { id: 'gantt', label: 'Gantt chart' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'pm-validation', label: 'Activity sign-off' },
  { id: 'geotechnical', label: 'Geotechnical' },
  { id: 'resources', label: 'Resources' },
  { id: 'monitoring', label: 'Daily site control' },
  { id: 'blockers', label: 'Blockers' },
  { id: 'risks', label: 'AI risk centre' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'impact', label: 'Impact analysis' },
  { id: 'forecast', label: 'Completion forecast' },
  { id: 'recommendations', label: 'AI recommendations' },
  { id: 'reports', label: 'Reports' },
  { id: 'audit', label: 'Audit trail' },
  { id: 'projects', label: 'Project settings' },
];

export const primaryNav = (role?: string, multiProject = false): NavItem[] => {
  if (role === 'Admin' || role === 'Project Manager') return [...(multiProject ? [PORTFOLIO] : []), OVERVIEW, TODAY, BUILDING, TASKS, PROBLEMS, SCHEDULE];
  if (role === 'Top Management') return [PORTFOLIO, OVERVIEW, BUILDING, PROBLEMS, SCHEDULE, REPORTS];
  return [TODAY, MY_TASKS, PROBLEMS, SCHEDULE]; // site engineers and site managers
};

/** Where a user lands after signing in: directors start from their list of projects. */
export const defaultTabFor = (role?: string): string => (role === 'Top Management' ? 'portfolio' : primaryNav(role)[0].id);

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab, onSelectTab, role, mobileOpen = false, collapsed = false, isSyncing = false, isSyncError = false, lastSyncAt, badges = {}, multiProject = false,
}) => {
  const items = primaryNav(role, multiProject);
  const showMore = role === 'Admin' || role === 'Project Manager';
  const moreTools = MORE_TOOLS.filter((t) => t.id !== 'blockers' || role === 'Admin');
  const inMore = showMore && !items.some((i) => i.id === currentTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const open = moreOpen || inMore;
  const sync = isSyncError ? { text: 'Connection problem', cls: 'text-rose-700' } : isSyncing ? { text: 'Updating…', cls: 'text-slate-500' }
    : lastSyncAt ? { text: `Updated ${lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, cls: 'text-slate-500' } : null;

  return (
    <aside
      aria-label="Main menu"
      className={`${mobileOpen ? 'fixed inset-y-16 left-0 z-40 flex w-64 shadow-xl' : 'hidden'} h-[calc(100vh-4rem)] min-h-0 flex-shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200 bg-white p-4 lg:relative lg:inset-auto lg:z-auto ${collapsed ? 'lg:hidden' : 'lg:flex'} lg:w-60 lg:shadow-none`}
    >
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id + item.label}
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {(badges[item.id] ?? 0) > 0 && (
                <span className="min-w-[1.25rem] rounded-full bg-amber-500 px-1.5 text-center text-xs font-semibold leading-5 text-white" aria-label={`${badges[item.id]} waiting`}>
                  {badges[item.id]}
                </span>
              )}
            </button>
          );
        })}

        {showMore && (
          <div className="pt-4">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={open}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <span className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-slate-400" />More tools</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <ul className="mt-1 space-y-0.5 border-l border-slate-200 pl-3 ml-5">
                {moreTools.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => onSelectTab(t.id)}
                      aria-current={currentTab === t.id ? 'page' : undefined}
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${currentTab === t.id ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>
      {sync && <p className={`px-3 pt-4 text-xs ${sync.cls}`} role="status">{sync.text}</p>}
    </aside>
  );
};
