import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const StratigraphyTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, stratList } = ctx;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Geological Stratigraphy Profile (Verbatim Preserved Terminology)
          </h3>
          <p className="text-xs text-slate-500">
            Actual terminology from the report is preserved. Never auto-renamed.
          </p>
        </div>
        <SourceBadge sourceType="REPORT" confidence="HIGH" />
      </div>

      <div className="space-y-3">
        {stratList.map((layer, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl border bg-white border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                  layer.material_type === 'Rock' ? 'bg-teal-600' : 'bg-amber-600'
                }`}
              >
                {idx + 1}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  {layer.layer_title}
                </span>
                <h4 className="text-sm font-bold text-slate-900">{layer.layer_name}</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">{layer.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono self-end md:self-auto">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-sans">Depth Range</span>
                <span className="font-bold text-slate-800">
                  {layer.top_depth}m – {layer.bottom_depth}m
                </span>
              </div>
              <SourceBadge
                sourceType="REPORT"
                confidence={layer.confidence}
                page={layer.source_page}
                onViewSource={() =>
                  openFieldInspect(layer.layer_name, {
                    display: `${layer.top_depth}m to ${layer.bottom_depth}m`,
                    source_type: 'REPORT',
                    source_page: layer.source_page,
                    source_text: layer.source_text,
                    confidence: layer.confidence,
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
