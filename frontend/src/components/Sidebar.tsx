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
  pendingRecsCount?: number;
  openBlockersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingRecsCount = 0,
  openBlockersCount = 0,
}) => {
  const navSections = [
    {
      title: 'EXECUTIVE',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'All Projects', icon: Building2 },
      ],
    },
    {
      title: 'PLANNING & SCHEDULE',
      items: [
        { id: 'activities', label: 'Activities Hierarchy', icon: ActivityIcon },
        {
          id: 'pm-validation',
          label: 'PM Section Validation',
          icon: ShieldCheck,
          badge: 'YES/NO',
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
        { id: 'monitoring', label: 'Daily Site Control', icon: ShieldCheck },
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
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-3.5 flex flex-col justify-between shadow-xs">
      <div className="space-y-5">
        {navSections.map((sec, idx) => (
          <div key={idx}>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider px-3 mb-1.5 uppercase font-mono">
              {sec.title}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200/60 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-brand-600 text-white' : item.badgeColor
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

      {/* System Status Footnote */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
        <div className="flex items-center justify-between font-semibold text-slate-800">
          <span>Engine Status</span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ML Online
          </span>
        </div>
        <div className="text-[10px] text-slate-500 leading-tight">
          Deterministic CPM + Multi-Model Prediction Engine v1.0
        </div>
      </div>
    </aside>
  );
};
