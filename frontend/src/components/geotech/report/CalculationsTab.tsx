import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const CalculationsTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { calcList } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Report Calculations</h3>
          <p className="text-xs text-slate-500">
            Engineering equations and intermediate calculations detected in report.
          </p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      {calcList.length > 0 ? (
        <div className="space-y-4">
          {calcList.map((calc, idx) => (
            <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{calc.calculation_name}</h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Section: {calc.source_section}
                  </span>
                </div>
                <SourceBadge sourceType="REPORT" page={calc.source_page} />
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 font-mono text-xs text-amber-900">
                Formula: {calc.formula}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(calc.input_parameters).map(([k, v]) => (
                  <div key={k} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">{k}</span>
                    <span className="font-bold text-slate-800 font-mono">{v}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs font-mono font-bold text-emerald-900">
                Result: {calc.result}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          No explicit calculation sheets present in document.
        </div>
      )}
    </div>
  );
};
