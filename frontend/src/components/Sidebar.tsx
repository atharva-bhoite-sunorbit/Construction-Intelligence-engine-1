import React from 'react';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Network,
  Users,
  AlertTriangle,
  GitBranch,
  TrendingUp,
  Brain,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Flame,
  Camera,
  Activity as ActivityIcon,
  Pickaxe
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isAdmin?: boolean;
  pendingRecsCount?: number;
  openBlockersCount?: number;
  mobileOpen?: boolean;
  isSyncing?: boolean;
  isSyncError?: boolean;
  lastSyncAt?: Date | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isAdmin = false,
  pendingRecsCount = 0,
  openBlockersCount = 0,
  mobileOpen = false,
  isSyncing = false,
  isSyncError = false,
  lastSyncAt,
}) => {
  const syncLabel = isSyncing ? 'Syncing' : isSyncError ? 'Connection issue' : lastSyncAt ? 'Synced' : 'Waiting';
  const syncColor = isSyncError
    ? 'text-rose-700'
    : isSyncing
      ? 'text-amber-700'
      : 'text-emerald-700';
  const navSections = [
    {
      title: 'EXECUTIVE',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: '41 ZOY Project', icon: Building2 },
      ],
    },
    {
      title: 'PLANNING & SCHEDULE',
      items: [
        {
          id: 'structure-lifecycle',
          label: 'Structure & Handover Plan',
          icon: Building2,
          badge: 'Progress & Daily',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
        },
        { id: 'activities', label: 'Activities Hierarchy', icon: ActivityIcon },
        {
          id: 'pm-validation',
          label: 'Activity Governance Gate',
          icon: ShieldCheck,
          badge: 'Multi-Tier',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        },
        {
          id: 'geotechnical',
          label: 'Geotechnical & 3D Cutaway',
          icon: Pickaxe,
          badge: '3D Cutaway',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        },
        { id: 'gantt', label: 'Interactive Gantt', icon: CalendarDays },
        { id: 'dependencies', label: 'Dependency Graph', icon: Network },
      ],
    },
    {
      title: 'RESOURCES & MONITORING',
      items: [
        { id: 'resources', label: 'Resource Planning', icon: Users },
        {
          id: 'monitoring',
          label: 'Daily Tasks & Site Control',
          icon: ShieldCheck,
          badge: 'Live Muster',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
        },
        {
          id: 'blockers',
          label: 'Blockers & Photos',
          icon: Camera,
          badge: openBlockersCount > 0 ? `${openBlockersCount}` : undefined,
          badgeColor: 'bg-rose-100 text-rose-700 border border-rose-200',
        },
      ],
    },
    {
      title: 'AI / ML INTELLIGENCE',
      items: [
        { id: 'risks', label: 'AI Risk Center', icon: Flame },
        { id: 'predictions', label: 'ML Predictions', icon: Brain },
        { id: 'impact', label: 'Cascading Impact', icon: GitBranch },
        { id: 'forecast', label: 'Completion Forecast', icon: TrendingUp },
        {
          id: 'recommendations',
          label: 'AI Recommendations',
          icon: AlertTriangle,
          badge: pendingRecsCount > 0 ? `${pendingRecsCount}` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800 border border-amber-200',
        },
      ],
    },
    {
      title: 'REPORTS & GOVERNANCE',
      items: [
        { id: 'reports', label: 'Executive Reports & Excel', icon: FileSpreadsheet },
        { id: 'audit', label: 'Audit Trail', icon: History },
      ],
    },
  ];

  return (
    <aside className={`${mobileOpen ? 'fixed inset-y-16 left-0 z-40 flex w-72 shadow-xl' : 'hidden'} h-[calc(100vh-4rem)] min-h-0 flex-shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200/90 bg-white p-3.5 lg:relative lg:inset-auto lg:z-auto lg:flex lg:w-64 lg:shadow-none`}>
      <div className="space-y-4">
        {navSections.map((sec, idx) => (
          <div key={idx}>
            <div className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {sec.title}
            </div>
            <div className="space-y-0.5">
              {sec.items.filter((item) => isAdmin || item.id !== 'blockers').map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const isCountBadge = item.id === 'blockers' || item.id === 'recommendations';
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-all ${
                      isActive
                        ? 'border border-slate-200/90 bg-slate-100 text-slate-900 font-semibold shadow-sm'
                        : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-amber-700' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`${isCountBadge ? 'inline-flex' : 'hidden xl:inline-flex'} rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          isActive ? 'bg-slate-900 text-white' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
          <span>Project data</span>
          <span className={`flex items-center gap-1.5 font-mono text-xs ${syncColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isSyncError ? 'bg-rose-600' : isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'}`} />
            {syncLabel}
          </span>
        </div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">
          {lastSyncAt
            ? `Last updated ${lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Waiting for the first project sync'}
        </div>
      </div>
    </aside>
  );
};
