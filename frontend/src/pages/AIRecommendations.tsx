import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Edit3, ShieldAlert, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import { Project, AIRecommendation } from '../types';
import { apiClient } from '../api/client';

interface AIRecommendationsPageProps {
  project: Project;
  onRefreshData: () => void;
}

export const AIRecommendationsPage: React.FC<AIRecommendationsPageProps> = ({ project, onRefreshData }) => {
  const [recs, setRecs] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [managerNotes, setManagerNotes] = useState('');

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAIRecommendations(project.id);
      setRecs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecs();
  }, [project.id]);

  const handleAction = async (id: number, status: 'APPROVED' | 'REJECTED' | 'MODIFIED') => {
    try {
      await apiClient.actOnRecommendation(id, status, managerNotes || undefined);
      setEditingId(null);
      setManagerNotes('');
      await fetchRecs();
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
        <span>Loading AI recommendations and managerial governance queue...</span>
      </div>
    );
  }

  const pending = recs.filter((r) => r.status === 'PENDING');
  const reviewed = recs.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
            AI REASONING & RECOMMENDATION ENGINE
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-wide">MANAGERIAL DECISION SUPPORT PORTAL</h1>
        <p className="text-xs text-slate-500">
          AI synthesized explanations and actionable recommendations for project manager review, approval, or modification
        </p>
      </div>

      {/* Governance Notice */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <span className="text-slate-700">
            <strong>Managerial Authority Gate:</strong> Project schedules, trade reallocations, and supplier expediting are never automatically modified without affirmative Project Manager review and approval.
          </span>
        </div>
        <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
          {pending.length} Pending Review
        </span>
      </div>

      {/* Pending Recommendations List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Awaiting Manager Decision</h3>

        {pending.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
            No pending AI recommendations at this time. All items have been reviewed.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-4 relative overflow-hidden text-xs"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    r.risk_level === 'CRITICAL'
                      ? 'bg-rose-500'
                      : r.risk_level === 'HIGH'
                      ? 'bg-amber-500'
                      : 'bg-brand-500'
                  }`}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.risk_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {r.risk_level} DELAY RISK
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{r.issue_summary}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* AI Explanation Box */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Causal Synthesis & Explanation:
                  </div>
                  <p className="text-slate-800 leading-relaxed">{r.ai_explanation}</p>

                  {r.contributing_factors?.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {r.contributing_factors.map((f, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[10px]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommended Actions */}
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Recommended Site Actions:
                  </div>
                  <ul className="space-y-1.5">
                    {r.recommended_actions?.map((act, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Notes Input if editing */}
                {editingId === r.id && (
                  <div className="pt-2">
                    <label className="block text-slate-500 mb-1">Manager Directives / Modified Instructions:</label>
                    <input
                      type="text"
                      placeholder="Add directives for the site team..."
                      value={managerNotes}
                      onChange={(e) => setManagerNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-white"
                    />
                  </div>
                )}

                {/* Action Controls */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                    className="text-slate-500 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{editingId === r.id ? 'Hide Directive Note' : 'Add Directive / Notes'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(r.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'APPROVED')}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Recommendation</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Reviewed Recommendations */}
      {reviewed.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Reviewed History</h3>
          <div className="space-y-3">
            {reviewed.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{r.issue_summary}</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-xl">{r.ai_explanation}</div>
                  {r.manager_notes && (
                    <div className="text-[11px] text-brand-300 mt-1">Directive: {r.manager_notes}</div>
                  )}
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    r.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
