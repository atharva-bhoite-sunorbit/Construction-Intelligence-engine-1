import { Lock, BarChart3, Award } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const TopMgmtSubNav: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { topMgmtSubTab, setTopMgmtSubTab, projectActivities } = ctx;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setTopMgmtSubTab('summary')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            topMgmtSubTab === 'summary'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Executive Multi-Tier Matrix</span>
        </button>

        <button
          onClick={() => setTopMgmtSubTab('recorded')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            topMgmtSubTab === 'recorded'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Officially Recorded Registry (PM Verified)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
            {projectActivities.filter((a) => a.final_recorded).length}
          </span>
        </button>
      </div>

      <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
        <Lock className="w-3.5 h-3.5" />
        <span>Executive Read-Only Oversight Mode</span>
      </div>
    </div>
  );
};
