import React, { useState } from 'react';
import { X, GitCompare, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/client';

interface GeotechnicalCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableReports: Array<{ id: number; report_id: string; project_name: string; filename: string }>;
}

export const GeotechnicalCompareModal: React.FC<GeotechnicalCompareModalProps> = ({
  isOpen,
  onClose,
  availableReports,
}) => {
  const [reportAId, setReportAId] = useState<string>(
    availableReports.length > 0 ? availableReports[0].report_id : ''
  );
  const [reportBId, setReportBId] = useState<string>(
    availableReports.length > 1 ? availableReports[1].report_id : ''
  );
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleRunComparison = async () => {
    if (!reportAId || !reportBId) return;
    setIsLoading(true);
    try {
      const resp = await apiClient.compareGeotechReports(reportAId, reportBId);
      setComparisonData(resp.comparison);
    } catch (err) {
      console.error('Comparison error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Compare Geotechnical Reports</h3>
              <p className="text-[11px] text-slate-500">
                Independent side-by-side comparison without merging geological parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Selector header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                PROJECT A (Report Document)
              </label>
              <select
                value={reportAId}
                onChange={(e) => setReportAId(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white"
              >
                {availableReports.map((r) => (
                  <option key={r.report_id} value={r.report_id}>
                    {r.report_id}: {r.project_name} ({r.filename})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                PROJECT B (Report Document)
              </label>
              <select
                value={reportBId}
                onChange={(e) => setReportBId(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white"
              >
                {availableReports.map((r) => (
                  <option key={r.report_id} value={r.report_id}>
                    {r.report_id}: {r.project_name} ({r.filename})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleRunComparison}
              disabled={isLoading || !reportAId || !reportBId || reportAId === reportBId}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors"
            >
              {isLoading ? 'Comparing...' : 'Compare Side by Side'}
            </button>
            {reportAId === reportBId && (
              <span className="text-[11px] text-amber-600 block mt-1">
                Please select two different reports to compare.
              </span>
            )}
          </div>

          {/* Comparison Results */}
          {comparisonData && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider font-mono">
                    PROJECT A: {comparisonData.report_a.id}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {comparisonData.report_a.project_name}
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1 font-mono pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_a.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Boreholes:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_a.boreholes_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bedrock Type:</span>
                      <span className="font-bold text-cyan-700">{comparisonData.report_a.primary_rock}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Water Table:</span>
                      <span className="font-bold text-blue-700">{comparisonData.report_a.groundwater}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bearing Capacity:</span>
                      <span className="font-bold text-emerald-700">{comparisonData.report_a.bearing_capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Max Settlement:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_a.settlement}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider font-mono">
                    PROJECT B: {comparisonData.report_b.id}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {comparisonData.report_b.project_name}
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1 font-mono pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_b.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Boreholes:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_b.boreholes_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bedrock Type:</span>
                      <span className="font-bold text-cyan-700">{comparisonData.report_b.primary_rock}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Water Table:</span>
                      <span className="font-bold text-blue-700">{comparisonData.report_b.groundwater}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bearing Capacity:</span>
                      <span className="font-bold text-emerald-700">{comparisonData.report_b.bearing_capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Max Settlement:</span>
                      <span className="font-bold text-slate-800">{comparisonData.report_b.settlement}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
