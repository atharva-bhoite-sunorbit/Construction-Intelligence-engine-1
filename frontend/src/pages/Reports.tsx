import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, FileText, Calendar, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { Project, AIManagementSummary } from '../types';
import { apiClient } from '../api/client';

interface ReportsPageProps {
  project: Project;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ project }) => {
  const [summary, setSummary] = useState<AIManagementSummary | null>(null);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [delayReport, setDelayReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [sumRes, dailyRes, delayRes] = await Promise.all([
        apiClient.getManagementSummary(project.id),
        apiClient.getDailyReport(project.id),
        apiClient.getDelayReport(project.id),
      ]);
      setSummary(sumRes);
      setDailyReport(dailyRes);
      setDelayReport(delayRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [project.id]);

  const handleDownloadExcel = () => {
    window.open(apiClient.exportExcelUrl(project.id), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">EXECUTIVE REPORTS & EXPORT</h1>
          <p className="text-xs text-slate-500">
            Generate and export daily progress dossiers, delay analyses, and complete multi-sheet Excel workbooks
          </p>
        </div>

        <button
          onClick={handleDownloadExcel}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Multi-Sheet Excel Workbook</span>
        </button>
      </div>

      {/* AI Daily Management Summary Card (Section 31 requirement) */}
      {summary && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-slate-900 text-base">PROJECT DAILY MANAGEMENT EXECUTIVE SUMMARY</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Date: {new Date(summary.summary_date).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Cumulative Progress</span>
              <span className="text-xl font-bold text-slate-900">{summary.overall_progress}%</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Activities Completed</span>
              <span className="text-xl font-bold text-emerald-400">{summary.activities_completed}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">High-Risk Activities</span>
              <span className="text-xl font-bold text-amber-400">{summary.high_risk_activities}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Potential Slippage</span>
              <span className="text-xl font-bold text-rose-400">{summary.potential_slippage_days} days</span>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Risk Explanation & Synthesis:
              </div>
              <p className="text-slate-700">{summary.risk_explanation}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Recommended Strategic Actions:
                </div>
                <ul className="space-y-1 text-slate-700">
                  {summary.recommended_actions?.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-brand-400 font-bold">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Next-Day Site Priorities:
                </div>
                <ul className="space-y-1 text-slate-700">
                  {summary.next_day_priorities?.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Progress Dossier */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider">Today's Daily Progress Log</h4>
            <span className="text-slate-500 font-mono">{dailyReport?.entries_count || 0} entries</span>
          </div>

          <div className="divide-y divide-slate-100">
            {dailyReport?.items?.map((item: any, i: number) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{item.activity_name}</div>
                  <div className="text-[11px] text-slate-500">
                    Productivity: {item.productivity}/hr • Weather: {item.weather}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-slate-800">
                    {item.actual_qty} / {item.planned_qty}
                  </div>
                  <span className={`text-[10px] font-bold ${item.variance_pct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {item.variance_pct}% var
                  </span>
                </div>
              </div>
            ))}
            {(!dailyReport?.items || dailyReport.items.length === 0) && (
              <div className="py-6 text-center text-slate-500">No logs for today yet.</div>
            )}
          </div>
        </div>

        {/* Delay Report */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider">Delayed Activities Report</h4>
            <span className="text-rose-400 font-mono font-bold">
              {delayReport?.delayed_activities_count || 0} Delayed
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {delayReport?.activities?.map((item: any, i: number) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{item.name}</div>
                  <div className="text-[11px] text-rose-400">Risk: {item.delay_risk}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-amber-400">+{item.predicted_delay_days}d slip</div>
                  <div className="text-[10px] text-slate-500">
                    {item.is_critical ? 'Critical Path' : `Float: ${item.total_float}d`}
                  </div>
                </div>
              </div>
            ))}
            {(!delayReport?.activities || delayReport.activities.length === 0) && (
              <div className="py-6 text-center text-slate-500">No activities currently delayed.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
