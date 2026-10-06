import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAuditLogs(60);
      setLogs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">SYSTEM AUDIT TRAIL</h1>
          <p className="text-xs text-slate-500">
            Immutable log of entity modifications, CPM schedule recalculations, and AI recommendation approvals
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-brand-400" />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Entity ID</th>
                <th className="py-3 px-4">Modification Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.action.includes('CREATE')
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : l.action.includes('UPDATE')
                          ? 'bg-brand-500/20 text-brand-400'
                          : l.action.includes('DELETE')
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{l.entity_name}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">#{l.entity_id || 'N/A'}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700 truncate max-w-md">
                    {l.new_values || l.old_values || 'State recorded'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
