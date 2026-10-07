import React from 'react';
import { X, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SourceBadge } from './SourceBadge';

interface ViewSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fieldData: any;
}

export const ViewSourceModal: React.FC<ViewSourceModalProps> = ({
  isOpen,
  onClose,
  title,
  fieldData,
}) => {
  if (!isOpen || !fieldData) return null;

  const isReport = fieldData.source_type === 'REPORT';
  const isCalc = fieldData.source_type === 'CALCULATED';
  const isAI = fieldData.source_type?.startsWith('AI');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              <p className="text-[11px] text-slate-500">Source Grounding & Verification Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Extracted Value
              </span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {fieldData.display || fieldData.value || 'Not specified in report'}
              </span>
            </div>
            <SourceBadge
              sourceType={fieldData.source_type}
              confidence={fieldData.confidence}
              page={fieldData.source_page}
            />
          </div>

          {isReport && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Document Location:</span>
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                  Page {fieldData.source_page || 1} • {fieldData.source_section || 'Report Body'}
                </span>
              </div>

              <div className="text-xs font-semibold text-slate-700">Verbatim Document Excerpt:</div>
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-xs text-amber-950 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {fieldData.source_text || fieldData.snippet || fieldData.display || 'No excerpt available.'}
              </div>
            </div>
          )}

          {isCalc && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-blue-900">Engineering Formula Applied:</div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-mono">
                {fieldData.formula || 'Formula not provided.'}
              </div>
              {fieldData.inputs && fieldData.inputs.length > 0 && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-700 block">Calculation Inputs:</span>
                  {fieldData.inputs.map((inp: any, i: number) => (
                    <div key={i} className="flex justify-between bg-slate-50 p-1.5 rounded border border-slate-100">
                      <span>{inp.parameter}</span>
                      <span className="font-mono font-bold text-slate-800">{inp.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAI && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>AI Engineering Interpretation Basis</span>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                {fieldData.note || 'Generated based on geotechnical soil-structure interaction principles.'}
              </div>
              <div className="text-[11px] text-slate-500 italic">
                * Note: AI recommendations are advisory and do not replace certified geotechnical design.
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Extraction Method: {fieldData.method || 'RULE_REGEX'}</span>
            <span>Status: {fieldData.status || 'FOUND'}</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
