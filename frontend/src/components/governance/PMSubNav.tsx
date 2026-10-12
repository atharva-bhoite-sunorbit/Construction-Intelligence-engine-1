import { Layers, CheckCheck, Building2 } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const PMSubNav: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { activities, pmSubTab, setPmSubTab } = ctx;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPmSubTab('queue')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            pmSubTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Awaiting PM Verification Queue</span>
          {activities.filter(
            (a) =>
              !a.final_recorded &&
              (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
                (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
          ).length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-extrabold text-[10px]">
              {
                activities.filter(
                  (a) =>
                    !a.final_recorded &&
                    (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
                      (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
                ).length
              }
            </span>
          )}
        </button>

        <button
          onClick={() => setPmSubTab('direct')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            pmSubTab === 'direct'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>PM Direct Structural Activities</span>
          <span className="text-[10px] text-slate-500">
            ({activities.filter((a) => a.assigned_role === 'Project Manager').length})
          </span>
        </button>

        <button
          onClick={() => setPmSubTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            pmSubTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Project Activities</span>
          <span className="text-[10px] text-slate-500">({activities.length})</span>
        </button>
      </div>

      {pmSubTab === 'queue' && (
        <div className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
          ⚡ Action: Countersign verified items to officially record them.
        </div>
      )}
    </div>
  );
};
