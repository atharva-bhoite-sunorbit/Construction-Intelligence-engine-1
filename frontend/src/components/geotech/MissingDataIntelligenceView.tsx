import React from 'react';
import { HelpCircle, UploadCloud, Database, ArrowRight, FileCode } from 'lucide-react';
import { SourceBadge } from './SourceBadge';

interface MissingDataIntelligenceViewProps {
  missingItems?: Array<{
    parameter: string;
    category: string;
    status: string;
    why_needed: string;
    recommended_source: string;
    action_type: string;
  }>;
  onNavigatePlanning?: () => void;
}

export const MissingDataIntelligenceView: React.FC<MissingDataIntelligenceViewProps> = ({
  missingItems = [],
  onNavigatePlanning,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>Information Not Available in Geotechnical Report</span>
          </h3>
          <p className="text-xs text-slate-500">
            These parameters cannot be extracted from a soil report alone and require structural drawings or BIM models.
          </p>
        </div>
        <SourceBadge sourceType="REQUIRES_DATA" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {missingItems.map((item, idx) => (
          <div
            key={idx}
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {item.category}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Requires Project Data
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-800">{item.parameter}</h4>
              <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">{item.why_needed}</p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-[10px] text-slate-500 mb-2">
                <span className="font-semibold text-slate-700">Required Source: </span>
                {item.recommended_source}
              </div>

              {item.action_type === 'UPLOAD_DWG' || item.action_type === 'UPLOAD_BIM' ? (
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Upload Structural DWG / BIM</span>
                </button>
              ) : (
                <button
                  onClick={onNavigatePlanning}
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Enter Project Parameters</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
