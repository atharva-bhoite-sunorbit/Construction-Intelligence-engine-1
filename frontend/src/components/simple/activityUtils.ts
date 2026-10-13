import { Activity } from '../../types';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Planned finish has passed and the work is not done. */
export const isLate = (a: Activity, today: string = todayIso()): boolean =>
  a.status !== 'COMPLETED' && (a.progress_percent ?? 0) < 100 && !!a.end_date && a.end_date < today;

export const daysLate = (a: Activity, today: string = todayIso()): number => {
  if (!isLate(a, today)) return 0;
  const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${a.end_date}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
};

/** Overall progress weighted by planned days, so a 40-day activity counts more than a 1-day one. */
export const weightedProgress = (activities: Activity[]): number => {
  const weight = (a: Activity) => Math.max(a.planned_duration || 0, 1);
  const total = activities.reduce((sum, a) => sum + weight(a), 0);
  if (!total) return 0;
  return activities.reduce((sum, a) => sum + (a.progress_percent || 0) * weight(a), 0) / total;
};

export const displayStatus = (a: Activity): string => {
  if (a.status === 'COMPLETED') return 'COMPLETED';
  if (isLate(a)) return 'DELAYED';
  if (a.status === 'IN_PROGRESS' || (a.progress_percent ?? 0) > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
};
