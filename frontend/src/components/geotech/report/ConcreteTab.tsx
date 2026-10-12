import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const ConcreteTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, concData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Concrete & Foundation Protection (IS 456-2000)</h3>
          <p className="text-xs text-slate-500">Environmental exposure grading, cement specifications, and cover.</p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Exposure Classification', key: 'exposure_classification' },
          { label: 'Cement Type', key: 'cement_type' },
          { label: 'Minimum Concrete Grade', key: 'concrete_grade' },
          { label: 'Minimum Cement Content', key: 'minimum_cement' },
          { label: 'Maximum Water/Cement Ratio', key: 'maximum_wc_ratio' },
          { label: 'Minimum Cover to Reinforcement', key: 'minimum_cover' },
        ].map(({ label, key }) => {
          const field = concData?.[key];
          return (
            <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  {label}
                </span>
                <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
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
