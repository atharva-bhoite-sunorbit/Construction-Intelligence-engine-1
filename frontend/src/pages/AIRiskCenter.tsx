import React, { useState, useEffect } from 'react';
import { Flame, AlertTriangle, ShieldAlert, ArrowRight, Eye, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Project, RiskItem } from '../types';
import { apiClient } from '../api/client';

interface AIRiskCenterProps {
  project: Project;
  onNavigateToImpact: (activityId: number) => void;
}

export const AIRiskCenter: React.FC<AIRiskCenterProps> = ({ project, onNavigateToImpact }) => {
  const [riskData, setRiskData] = useState<{
    risk_counts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    critical_risks: RiskItem[];
    high_risks: RiskItem[];
    medium_risks: RiskItem[];
    low_risks: RiskItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  const fetchRisks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getRiskCenter(project.id);
      setRiskData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, [project.id]);

  if (loading || !riskData) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
        <span>Evaluating multi-dimensional risk surfaces with ML Delay Engine...</span>
      </div>
    );
  }

  const allRisks = [
    ...riskData.critical_risks,
    ...riskData.high_risks,
    ...riskData.medium_risks,
    ...riskData.low_risks,
  ];

  const filtered = filterLevel === 'ALL' ? allRisks : allRisks.filter((r) => r.risk_level === filterLevel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest">
              AI RISK CENTER
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">CONSTRUCTION PROJECT RISK RADAR</h1>
          <p className="text-xs text-slate-500">
            Categorized risk probability, causal factor explanations, downstream sensitivity, and recommended investigations
          </p>
        </div>

        <button
          onClick={fetchRisks}
          className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-brand-400" />
          <span>Refresh Risk Radar</span>
        </button>
      </div>

      {/* 4 Risk Severity Tally Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { level: 'CRITICAL', count: riskData.risk_counts.CRITICAL, border: 'border-rose-500/40', text: 'text-rose-400', bg: 'bg-rose-500/10' },
          { level: 'HIGH', count: riskData.risk_counts.HIGH, border: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-500/10' },
          { level: 'MEDIUM', count: riskData.risk_counts.MEDIUM, border: 'border-yellow-500/40', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { level: 'LOW', count: riskData.risk_counts.LOW, border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((item) => (
          <div
            key={item.level}
            onClick={() => setFilterLevel(filterLevel === item.level ? 'ALL' : (item.level as any))}
            className={`p-4 rounded-2xl border ${item.border} ${item.bg} cursor-pointer transition-all hover:scale-[1.02] shadow-lg ${
              filterLevel === item.level ? 'ring-2 ring-white/20' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold font-mono tracking-wider ${item.text}`}>
                {item.level} RISKS
              </span>
              <span className={`text-xl font-black font-mono ${item.text}`}>{item.count}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {item.level === 'CRITICAL'
                ? 'Zero float & delay probability > 70%'
                : item.level === 'HIGH'
                ? 'Project finish impact probable'
                : item.level === 'MEDIUM'
                ? 'Float buffer absorbing delays'
                : 'Execution within normal tolerances'}
            </div>
          </div>
        ))}
      </div>

      {/* Risk Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filtered.length} risk items ({filterLevel} filter)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((r) => (
            <div
              key={r.activity_id}
              className={`p-5 rounded-2xl bg-white border shadow-xs border border-slate-200 space-y-4 relative overflow-hidden transition-all hover:border-slate-200 ${
                r.risk_level === 'CRITICAL'
                  ? 'border-rose-500/40'
                  : r.risk_level === 'HIGH'
                  ? 'border-amber-500/40'
                  : 'border-slate-200'
              }`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  r.risk_level === 'CRITICAL'
                    ? 'bg-rose-500'
                    : r.risk_level === 'HIGH'
                    ? 'bg-amber-500'
                    : 'bg-yellow-500'
                }`}
              />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.risk_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : r.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      }`}
                    >
                      {r.risk_level} RISK
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {r.tower} • Floor {r.floor}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{r.activity_name}</h3>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black font-mono text-rose-400">
                    {Math.round(r.delay_probability * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Delay Probability</div>
                </div>
              </div>

              {/* Reason & Potential Impact */}
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Root Causal Drivers:
                  </div>
                  <p className="text-slate-700 leading-relaxed">{r.reason}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Downstream Potential Impact:
                  </div>
                  <p className="text-slate-500 leading-relaxed">{r.potential_impact}</p>
                </div>

                <div className="p-3 bg-brand-950/40 border border-brand-500/20 rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">
                    Recommended Investigation:
                  </div>
                  <p className="text-brand-200/90 leading-relaxed">{r.recommended_investigation}</p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="font-mono text-slate-500">
                  Predicted Slippage: <span className="font-bold text-amber-400">+{r.predicted_delay_days} days</span>
                </div>

                <button
                  onClick={() => onNavigateToImpact(r.activity_id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-brand-600 hover:text-white text-slate-700 font-medium flex items-center gap-1.5 transition-all text-xs"
                >
                  <span>Simulate Cascading Impact</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
