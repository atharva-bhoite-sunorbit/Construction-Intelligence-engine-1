import React, { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, ArrowRight, Play, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Project, Activity, ImpactAnalysisResponse } from '../types';
import { apiClient } from '../api/client';

interface ImpactAnalysisPageProps {
  project: Project;
  activities: Activity[];
  initialActivityId?: number;
}

export const ImpactAnalysisPage: React.FC<ImpactAnalysisPageProps> = ({
  project,
  activities,
  initialActivityId,
}) => {
  const [selectedActivityId, setSelectedActivityId] = useState<number>(
    initialActivityId || activities[0]?.id || 0
  );
  const [delayDays, setDelayDays] = useState<number>(3.0);
  const [impactData, setImpactData] = useState<ImpactAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    if (!selectedActivityId) return;
    setLoading(true);
    try {
      const res = await apiClient.getImpactAnalysis(project.id, selectedActivityId, delayDays);
      setImpactData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activities.length > 0) {
      runSimulation();
    }
  }, [project.id, selectedActivityId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
            DEPENDENCY IMPACT SIMULATOR
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-wide">CASCADING DELAY PROPAGATION ENGINE</h1>
        <p className="text-xs text-slate-500">
          Simulate an activity delay to project downstream schedule slippage, float absorption, and critical milestone push
        </p>
      </div>

      {/* Simulator Inputs Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Select Delayed Source Activity
            </label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-medium"
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.tower} F{a.floor}] {a.name} ({a.is_critical ? 'CRITICAL PATH' : `Float: ${a.total_float}d`})
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Simulated Delay (Days)
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={delayDays}
              onChange={(e) => setDelayDays(parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{loading ? 'Simulating...' : 'Run Impact Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Simulation Result KPIs */}
      {impactData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Activity</span>
              <div className="text-base font-bold text-slate-900 mt-1 truncate">{impactData.source_activity_name}</div>
              <div className="text-xs text-amber-400 font-mono mt-1 font-semibold">
                Simulated Delay: +{impactData.delay_days} days
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Downstream Affected</span>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {impactData.affected_activities.length} <span className="text-xs font-normal text-slate-500">activities</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Direct and indirect successors impacted</div>
            </div>

            <div className={`p-5 rounded-2xl border shadow-xs border border-slate-200 ${
              impactData.critical_path_affected ? 'bg-rose-950/20 border-rose-500/40' : 'bg-white border-slate-200'
            }`}>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Project Slippage</span>
              <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                +{impactData.project_completion_slippage_days} Days
              </div>
              <div className="text-xs text-rose-300 font-semibold mt-1">
                {impactData.critical_path_affected ? 'CRITICAL PATH IMPACTED' : 'Absorbed by schedule buffers'}
              </div>
            </div>
          </div>

          {/* Cascading Chain List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">CASCADING DOWNSTREAM IMPACT CHAIN</h3>

            {impactData.affected_activities.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No downstream activities are pushed back. All simulated delay is absorbed by schedule float.
              </div>
            ) : (
              <div className="space-y-3">
                {impactData.affected_activities.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-700 flex items-center justify-center font-mono font-bold text-[10px]">
                          {item.path_depth}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{item.affected_activity_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.impact_level === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : item.impact_level === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {item.impact_level} IMPACT
                        </span>
                      </div>

                      {/* Cascade path breadcrumb */}
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 pl-7">
                        <span className="text-slate-500">Propagation Pathway:</span>
                        {item.cascade_chain.map((c, cIdx) => (
                          <React.Fragment key={cIdx}>
                            <span className="text-slate-700 font-medium">{c}</span>
                            {cIdx < item.cascade_chain.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-7 md:pl-0">
                      <div className="text-base font-bold font-mono text-amber-400">+{item.impact_days} days slip</div>
                      <div className="text-[10px] text-slate-500">{item.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
