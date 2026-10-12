import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const RockTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, rockData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Rock Characterization & Bedrock Quality</h3>
          <p className="text-xs text-slate-500">
            Core recovery, RQD, unconfined compressive strength ranges, and calculated MPa conversion.
          </p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Rock Type', key: 'rock_type' },
          { label: 'Rock Depth Range', key: 'depth_range' },
          { label: 'Core Recovery (CR)', key: 'core_recovery' },
          { label: 'Rock Quality Designation (RQD)', key: 'rqd' },
          { label: 'Compressive Strength (UCS)', key: 'compressive_strength' },
          { label: 'Equivalent MPa (Unit Conversion)', key: 'compressive_strength_mpa_equivalent' },
        ].map(({ label, key }) => {
          const field = rockData?.[key];
          return (
            <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  {label}
                </span>
                <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                  {field?.display || 'Not specified in report'}
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                <SourceBadge
                  sourceType={field?.source_type}
                  confidence={field?.confidence}
                  page={field?.source_page}
                  onViewSource={() => openFieldInspect(label, field)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
