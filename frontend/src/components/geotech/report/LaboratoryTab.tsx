import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const LaboratoryTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { labList } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Laboratory Test Results</h3>
          <p className="text-xs text-slate-500">Structured laboratory tables preserving original units and limits.</p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      {labList.length > 0 ? (
        <div className="space-y-4">
          {labList.map((test, idx) => (
            <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{test.test_category}</h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Sample: {test.sample_id} • Depth: {test.depth_m}
                  </span>
                </div>
                <SourceBadge sourceType="REPORT" page={test.source_page} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {test.parameters.map((p, pIdx) => (
                  <div key={pIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block truncate">{p.name}</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">
                      {p.value} {p.unit}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Limit: {p.limit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          No laboratory tables parsed in this document.
        </div>
      )}
    </div>
  );
};
