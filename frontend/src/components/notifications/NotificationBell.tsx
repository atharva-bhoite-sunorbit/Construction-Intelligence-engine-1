import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { AppNotification } from '../../types';
import { timeAgo } from '../simple/ui';

interface Props {
  showProject?: boolean;
  items: AppNotification[];
  unread: number;
  onOpen: (n: AppNotification) => void;
  onMarkAllRead: () => void;
}

export const NotificationBell: React.FC<Props> = ({ items, unread, onOpen, onMarkAllRead, showProject = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} aria-haspopup="dialog"
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {unread > 0 && <button onClick={onMarkAllRead} className="text-xs text-blue-700 hover:underline">Mark all as read</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => { setOpen(false); onOpen(n); }} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-blue-50/50'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-600'}`} aria-hidden />
                    <span className="min-w-0">
                      <span className={`block text-sm ${n.read ? 'text-slate-700' : 'font-medium text-slate-900'}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>}
                      <span className="mt-1 block text-xs text-slate-400">{showProject && n.project_name ? `${n.project_name} · ` : ''}{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
