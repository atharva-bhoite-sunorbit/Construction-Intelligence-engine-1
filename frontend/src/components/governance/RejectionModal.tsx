import { XCircle, AlertTriangle, X } from 'lucide-react';
import { REJECTION_PRESETS } from './shared';
import { PMValidationCtx } from './usePMValidationState';

export const RejectionModal: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { loadingActivityId, rejectingActivity, setRejectingActivity, rejectionReason, setRejectionReason, customRejectionNote, setCustomRejectionNote, activeReviewerName, handleConfirmReject } = ctx;
  if (!rejectingActivity) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Reject Activity Sign-Off</h3>
              <p className="text-[11px] text-rose-100">
                {rejectingActivity.code} • {rejectingActivity.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => setRejectingActivity(null)}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Select Primary Rejection Reason:
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {REJECTION_PRESETS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Additional Corrective Remarks & Directives (Optional):
            </label>
            <textarea
              rows={3}
              value={customRejectionNote}
              onChange={(e) => setCustomRejectionNote(e.target.value)}
              placeholder="Specify deficiency location, missing submittals, or required remediation..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-[11px]"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
            <span className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Governance Notice:
            </span>
            <p>
              Rejecting this activity sets status to REJECTED and records an audit log entry signed by{' '}
              <span className="font-bold">{activeReviewerName}</span>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              onClick={() => setRejectingActivity(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={loadingActivityId !== null}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Confirm Rejection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
