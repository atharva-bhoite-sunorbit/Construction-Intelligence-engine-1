import React, { useEffect } from 'react';

/** Small shared pieces for the simple everyday screens (tasks, overview, schedule). */

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Not started',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Sent back',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Done',
  NOT_STARTED: 'Not started',
  DELAYED: 'Late',
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  BLOCKED: 'bg-rose-100 text-rose-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  DELAYED: 'bg-rose-100 text-rose-800',
};

export const StatusChip: React.FC<{ status: string; label?: string }> = ({ status, label }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-700'}`}>
    {label ?? STATUS_LABEL[status] ?? status}
  </span>
);

export const ProgressBar: React.FC<{ value: number; className?: string; tone?: 'blue' | 'green' | 'red' }> = ({ value, className = '', tone = 'blue' }) => {
  const pct = Math.max(0, Math.min(100, value || 0));
  const color = tone === 'green' ? 'bg-emerald-500' : tone === 'red' ? 'bg-rose-500' : 'bg-blue-600';
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string; action?: React.ReactNode }> = ({ title, hint, action }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    <p className="text-base font-medium text-slate-800">{title}</p>
    {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 ${className}`}
  />
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  />
);

export const errorText = (err: any): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return err?.message || 'Something went wrong. Please try again.';
};

export const formatDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Close a dialog or side panel with the Escape key. */
export const useEscape = (onClose: () => void) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
};

/** "just now", "3 h ago", "2 days ago" */
export const timeAgo = (iso: string): string => {
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};
