import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert, Clock } from 'lucide-react';
import { Project, CompletionForecast } from '../types';
import { apiClient } from '../api/client';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';

interface CompletionForecastPageProps {
  project: Project;
}

export const CompletionForecastPage: React.FC<CompletionForecastPageProps> = ({ project }) => {
  const [forecast, setForecast] = useState<CompletionForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getCompletionForecast(project.id);
      setForecast(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [project.id]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await apiClient.recalculateForecast(project.id);
      setForecast(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading || !forecast) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <TrendingUp className="w-5 h-5 text-brand-400 animate-pulse" />
        <span>Evaluating CPM, progress variance, and ML delay intervals...</span>
      </div>
    );
  }

  const baselineDate = new Date(forecast.baseline_completion_date);
  const predictedDate = new Date(forecast.predicted_completion_date);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-brand-400 uppercase tracking-widest">
              DYNAMIC SCHEDULE FORECASTING ENGINE
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">PROJECT COMPLETION FORECAST</h1>
          <p className="text-xs text-slate-500">
            Synthesizes Baseline Schedule + Actual Progress + ML Duration Predictions + Delay Probabilities + CPM Network
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          <span>{recalculating ? 'Forecasting...' : 'Recalculate Dynamic Forecast'}</span>
        </button>
      </div>

      {/* Primary Forecast Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Baseline Target Date</span>
          <div className="text-xl font-black font-mono text-white mt-1">
            {baselineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <p className="text-[11px] text-slate-500">Contractual completion milestone</p>
        </div>

        <div className={`p-5 rounded-2xl border shadow-xs border border-slate-200 space-y-1 ${
          forecast.slippage_days > 0 ? 'bg-white border-amber-500/40' : 'bg-white border-emerald-500/40'
        }`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ML Predicted Date</span>
          <div className="text-xl font-black font-mono text-amber-400 mt-1">
            {predictedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Confidence: ±{forecast.confidence_interval_days} days</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Forecast Slippage</span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {forecast.slippage_days > 0 ? `+${forecast.slippage_days} Days` : 'On Schedule'}
          </div>
          <p className="text-[11px] text-slate-500">Cumulative downstream delay</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule Health</span>
          <div className="text-2xl font-black font-mono text-brand-400 mt-1">
            {forecast.schedule_health_score} <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500">Critical path float integrity</p>
        </div>
      </div>

      {/* Forecast Trend Chart */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Completion Date Slippage Evolution</h3>
            <p className="text-xs text-slate-500">Projected delay progression over recent site updates</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={forecast.history || [
                { date: 'Initial', slippage_days: 0, health_score: 100 },
                { date: 'Update 1', slippage_days: 2, health_score: 93 },
                { date: 'Update 2', slippage_days: 4, health_score: 86 },
                { date: 'Current', slippage_days: forecast.slippage_days, health_score: forecast.schedule_health_score },
              ]}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="slipGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="slippage_days" stroke="#f59e0b" strokeWidth={2} fill="url(#slipGradient)" name="Slippage (Days)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Methodology Notes */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
        <span className="font-bold text-slate-700 uppercase tracking-wider">Methodology & Inference Notes:</span>
        <p className="text-slate-500 leading-relaxed font-mono text-[11px]">{forecast.methodology_notes}</p>
      </div>
    </div>
  );
};
