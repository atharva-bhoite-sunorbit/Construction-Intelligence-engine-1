import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const ExcavationTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, excData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Excavation Conditions & Stability</h3>
          <p className="text-xs text-slate-500">
            Pit side slopes, weathered rock cutting, groundwater ingress, and equipment recommendations.
          </p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Maximum Permissible Slope', key: 'maximum_slope' },
          { label: 'Weathered Rock (CWR)', key: 'weathered_rock_present' },
          { label: 'Hard Bedrock', key: 'hard_rock_present' },
          { label: 'Groundwater Depth', key: 'groundwater_depth' },
        ].map(({ label, key }) => {
          const field = excData?.[key];
          return (
            <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  {label}
                </span>
                <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                  {field?.display || 'Not specified in report'}
                </span>
              </div>
              <SourceBadge
                sourceType={field?.source_type}
                confidence={field?.confidence}
                page={field?.source_page}
                onViewSource={() => openFieldInspect(label, field)}
              />
            </div>
          );
        })}
      </div>

      {/* Equipment note clearly marked AI recommendation (Section 11) */}
      <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900">
            Recommended Excavation Machinery (AI / Engineering Recommendation)
          </span>
          <SourceBadge sourceType="AI_RECOMMENDATION" />
        </div>
        <p className="text-xs text-purple-800 leading-relaxed">
          Based on hard bedrock and SPT refusal, heavy 20-30 ton crawler excavators fitted with hydraulic
          breakers (chisel hammer) are recommended for bedrock breaking. Standard backhoe buckets are
          restricted to upper fill/soil layers.
        </p>
      </div>
    </div>
  );
};
