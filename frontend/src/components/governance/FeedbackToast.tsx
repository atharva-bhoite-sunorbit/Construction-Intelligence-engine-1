import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const FeedbackToast: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { feedbackToast } = ctx;
  if (!feedbackToast) return null;
  return (
    <div
      className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-4 ${
        feedbackToast.type === 'success'
          ? 'bg-emerald-950 text-emerald-100 border-emerald-500/50 shadow-emerald-900/20'
          : feedbackToast.type === 'error'
          ? 'bg-rose-950 text-rose-100 border-rose-500/50 shadow-rose-900/20'
          : 'bg-amber-950 text-amber-100 border-amber-500/50 shadow-amber-900/20'
      }`}
    >
      {feedbackToast.type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : feedbackToast.type === 'error' ? (
        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span>{feedbackToast.message}</span>
    </div>
  );
};
