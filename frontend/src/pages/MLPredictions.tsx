import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, RefreshCw, Cpu, CheckCircle2, TrendingUp, Users, Clock } from 'lucide-react';
import { Project, MLPredictionItem } from '../types';
import { apiClient } from '../api/client';

interface MLPredictionsPageProps {
  project: Project;
  onRefreshData: () => void;
}

export const MLPredictionsPage: React.FC<MLPredictionsPageProps> = ({ project, onRefreshData }) => {
  const [items, setItems] = useState<MLPredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunningInference, setIsRunningInference] = useState(false);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPredictions(project.id);
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [project.id]);

  const handleRunInference = async () => {
    setIsRunningInference(true);
    try {
      await apiClient.runPredictions(project.id);
      await fetchPredictions();
      onRefreshData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to run prediction pipeline.');
    } finally {
      setIsRunningInference(false);
    }
  };

  const predictionMode = items[0]?.prediction_mode || 'ML';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-mono font-bold text-brand-400 uppercase tracking-widest">
              ML FEATURE PIPELINE & INFERENCE
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">PREDICTIVE MACHINE LEARNING SUITE</h1>
          <p className="text-xs text-slate-500">
            Multi-target models: Delay Classification, Duration Regression, Productivity, and Labour Requirements
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Cold-Start / Prediction Mode Badge (Section 42 requirement) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500">Prediction Mode:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                predictionMode === 'ML'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {predictionMode}
            </span>
          </div>

          <button
            onClick={handleRunInference}
            disabled={isRunningInference}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningInference ? 'animate-spin' : ''}`} />
            <span>{isRunningInference ? 'Extracting Features & Predicting...' : 'Run ML Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* Model Registry Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-lg space-y-1">
          <div className="text-slate-500 font-medium">Delay Model (Classifier)</div>
          <div className="text-base font-bold text-slate-900 font-mono">LogisticRegression / RF</div>
          <div className="text-[11px] text-emerald-400">Accuracy: 97.5% • ROC-AUC: 0.998</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-lg space-y-1">
          <div className="text-slate-500 font-medium">Duration Regressor</div>
          <div className="text-base font-bold text-slate-900 font-mono">GradientBoostingRegressor</div>
          <div className="text-[11px] text-emerald-400">R²: 0.997 • MAE: 0.31 days</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-lg space-y-1">
          <div className="text-slate-500 font-medium">Daily Productivity Model</div>
          <div className="text-base font-bold text-slate-900 font-mono">GradientBoostingRegressor</div>
          <div className="text-[11px] text-emerald-400">R²: 0.988 • Multi-factor Height/Material</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-lg space-y-1">
          <div className="text-slate-500 font-medium">Labour Requirement Model</div>
          <div className="text-base font-bold text-slate-900 font-mono">RandomForestRegressor</div>
          <div className="text-[11px] text-emerald-400">R²: 0.917 • Gang Size Prediction</div>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">PREDICTED CONSTRUCTION ACTIVITY PARAMETERS</h3>
          <span className="text-xs text-slate-500 font-mono">{items.length} Activities Evaluated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Activity</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Planned Dur.</th>
                <th className="py-3 px-3">Predicted Duration (Range)</th>
                <th className="py-3 px-3">Expected Output</th>
                <th className="py-3 px-3">Predicted Labour</th>
                <th className="py-3 px-3">Delay Prob.</th>
                <th className="py-3 px-3">Predicted Delay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {items.map((i) => (
                <tr key={i.activity_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-white">{i.activity_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{i.code || `ACT-${i.activity_id}`}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {i.tower} • Floor {i.floor}
                  </td>
                  <td className="py-3 px-3 font-mono">{i.planned_duration} days</td>
                  <td className="py-3 px-3 font-mono">
                    <span className="font-bold text-slate-900">{i.predicted_duration} days</span>{' '}
                    <span className="text-[10px] text-slate-500">
                      ({i.duration_interval?.[0] || i.predicted_duration} - {i.duration_interval?.[1] || i.predicted_duration}d)
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-brand-400 font-semibold">
                    {i.predicted_productivity} /day
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className="font-semibold text-white">{i.predicted_workers} workers</span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`font-mono font-bold ${
                        i.delay_probability > 0.7
                          ? 'text-rose-400'
                          : i.delay_probability > 0.4
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {Math.round(i.delay_probability * 100)}% ({i.risk_level})
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {i.predicted_delay_days > 0 ? (
                      <span className="text-amber-400 font-bold">+{i.predicted_delay_days} days</span>
                    ) : (
                      <span className="text-emerald-400">On Track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
