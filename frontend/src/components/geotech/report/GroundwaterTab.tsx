import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const GroundwaterTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, gwData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Groundwater Levels & Chemical Characteristics</h3>
          <p className="text-xs text-slate-500">Static groundwater table, seasonal fluctuations, and water chemistry.</p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Observed Water Depth', key: 'observed_depth' },
          { label: 'Seasonal Variation', key: 'seasonal_variation' },
          { label: 'Groundwater Status', key: 'groundwater_status' },
          { label: 'Water Chemistry / Corrosivity', key: 'water_chemistry' },
        ].map(({ label, key }) => {
          const field = gwData?.[key];
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
    </div>
  );
};
