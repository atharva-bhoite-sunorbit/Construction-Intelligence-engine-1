import { Pickaxe, UploadCloud, FileText, Sparkles, Download, GitCompare, FileSpreadsheet } from 'lucide-react';
import { GeotechReportCtx } from './useGeotechReportState';

export const ReportHeader: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { reports, selectedReportId, setSelectedReportId, currentIntelDoc, setIsUploadModalOpen, setIsCompareModalOpen, handleExportPDF, handleExportExcel, handleExportJSON, handleExportStandardJSON, isSyncingBoq, handleSyncToBOQ } = ctx;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <Pickaxe className="w-5 h-5 text-amber-600" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Geotechnical Report Intelligence
              </h1>
              {currentIntelDoc && (
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  {currentIntelDoc.report_id}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Source-grounded borehole parsing, strata characterization & engineering validation
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls & Report Selector */}
      <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
        {/* Multi-report switcher */}
        {reports.length > 0 && (
          <div className="relative">
            <select
              value={selectedReportId || ''}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_id || `GT-${r.id}`}: {r.project_name || r.filename}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Report (PDF)</span>
        </button>

        {/* Compare Button */}
        <button
          onClick={() => setIsCompareModalOpen(true)}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <GitCompare className="w-3.5 h-3.5 text-slate-500" />
          <span>Compare</span>
        </button>

        {/* Sync to BOQ Button */}
        <button
          onClick={handleSyncToBOQ}
          disabled={!selectedReportId || isSyncingBoq}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          title="Sync geotechnical foundation/excavation items directly into project BOQ"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isSyncingBoq ? 'Syncing...' : 'Sync to BOQ'}</span>
        </button>

        {/* Export Dropdown / Buttons */}
        <button
          onClick={handleExportPDF}
          disabled={!currentIntelDoc}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
          title="Export Engineering PDF Report"
        >
          <FileText className="w-4 h-4 text-rose-600" />
        </button>

        <button
          onClick={handleExportExcel}
          disabled={!currentIntelDoc}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
          title="Export Multi-Sheet Excel"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        </button>

        <button
          onClick={handleExportStandardJSON}
          disabled={!currentIntelDoc}
          className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold disabled:opacity-50 transition-colors"
          title="Export Standard 5-Layers JSON"
        >
          <Download className="w-4 h-4 text-indigo-600" />
        </button>

        <button
          onClick={handleExportJSON}
          disabled={!currentIntelDoc}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
          title="Export Raw JSON"
        >
          <Download className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  );
};
