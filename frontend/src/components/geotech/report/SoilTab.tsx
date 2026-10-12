import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const SoilTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, soilData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Soil Conditions & Mechanical Properties</h3>
          <p className="text-xs text-slate-500">Overburden soil strata, SPT values, density, and shear limits.</p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Soil Type', key: 'soil_type' },
          { label: 'Soil Description', key: 'soil_description' },
          { label: 'Density / Consistency', key: 'density_consistency' },
          { label: 'SPT N Values', key: 'spt_n' },
          { label: 'Depth Range', key: 'depth_range' },
          { label: 'Cohesion', key: 'cohesion' },
          { label: 'Friction Angle', key: 'friction_angle' },
        ].map(({ label, key }) => {
          const field = soilData?.[key];
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
