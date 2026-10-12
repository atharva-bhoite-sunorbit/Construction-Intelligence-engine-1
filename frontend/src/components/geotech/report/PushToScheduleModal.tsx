import { X } from 'lucide-react';
import { GeotechReportCtx } from './useGeotechReportState';

export const PushToScheduleModal: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { setIsPushModalOpen, replaceExisting, setReplaceExisting, isPushing, pushSuccessMsg, handlePushToSchedule } = ctx;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800">Push to Master Schedule</h3>
          <button
            onClick={() => setIsPushModalOpen(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          This will create geotechnical excavation activities in the master project schedule with CPM
          predecessors and resource allocations.
        </p>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="rounded text-brand-600"
          />
          <span>Replace any previously generated excavation activities</span>
        </label>

        {pushSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            {pushSuccessMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setIsPushModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handlePushToSchedule}
            disabled={isPushing}
            className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs"
          >
            {isPushing ? 'Synchronizing...' : 'Confirm & Push'}
          </button>
        </div>
      </div>
    </div>
  );
};
