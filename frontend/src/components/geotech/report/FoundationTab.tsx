import { Calendar } from 'lucide-react';
import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const FoundationTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { setIsPushModalOpen, openFieldInspect, foundData } = ctx;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Foundation Recommendations</h3>
          <p className="text-xs text-slate-500">
            Geotechnical engineer's recommendation. Clearly distinguishes report from AI recommendations.
          </p>
        </div>
        <SourceBadge sourceType="REPORT" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Recommended Foundation Type', key: 'foundation_type' },
          { label: 'Supporting Strata Layer', key: 'supporting_layer' },
          { label: 'Net Allowable Bearing Capacity', key: 'net_allowable_bearing_capacity' },
          { label: 'Maximum Settlement Limit', key: 'maximum_settlement' },
          { label: 'Modulus of Subgrade Reaction', key: 'subgrade_reaction_modulus' },
        ].map(({ label, key }) => {
          const field = foundData?.[key];
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

      {/* Action to push to schedule */}
      <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-200 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-brand-900">Synchronize With Master Project Schedule</h4>
          <p className="text-[11px] text-brand-700">
            Generate CPM substructure and excavation activities based on these foundation layers.
          </p>
        </div>
        <button
          onClick={() => setIsPushModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Push to Schedule</span>
        </button>
      </div>
    </div>
  );
};
