import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'brand' | 'amber' | 'emerald' | 'rose' | 'purple';
  trend?: string;
}

const colorStyles = {
  brand: {
    bg: 'bg-brand-50',
    border: 'border-brand-200/80',
    text: 'text-brand-700',
    iconBg: 'bg-brand-100/60',
  },
  amber: {
    bg: 'bg-amber-50/60',
    border: 'border-amber-200/80',
    text: 'text-amber-800',
    iconBg: 'bg-amber-100',
  },
  emerald: {
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200/80',
    text: 'text-emerald-800',
    iconBg: 'bg-emerald-100',
  },
  rose: {
    bg: 'bg-rose-50/60',
    border: 'border-rose-200/80',
    text: 'text-rose-800',
    iconBg: 'bg-rose-100',
  },
  purple: {
    bg: 'bg-indigo-50/60',
    border: 'border-indigo-200/80',
    text: 'text-indigo-800',
    iconBg: 'bg-indigo-100',
  },
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'brand',
  trend,
}) => {
  const c = colorStyles[color];

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`rounded-lg ${c.iconBg} p-2 ${c.text}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{value}</span>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600">{trend}</span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 leading-snug">{subtitle}</p>
      )}
    </div>
  );
};
