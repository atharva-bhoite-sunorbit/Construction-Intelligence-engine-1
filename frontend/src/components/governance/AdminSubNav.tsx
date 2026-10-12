import { ShieldCheck, CheckCheck } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const AdminSubNav: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { activities, adminSubTab, setAdminSubTab } = ctx;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setAdminSubTab('geotech_queue')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            adminSubTab === 'geotech_queue'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Awaiting Admin Verification Queue (Geotech & Excavation)</span>
          {activities.filter(
            (a) =>
              !a.final_recorded &&
              (a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
                (a.stage1_status === 'APPROVED' &&
                  (a.assigned_role === 'Site Engineer' || (a.code || '').toUpperCase().startsWith('GX-'))))
          ).length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-extrabold text-[10px]">
              {
                activities.filter(
                  (a) =>
                    !a.final_recorded &&
                    (a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
                      (a.stage1_status === 'APPROVED' &&
                        (a.assigned_role === 'Site Engineer' || (a.code || '').toUpperCase().startsWith('GX-'))))
                ).length
              }
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminSubTab('statutory')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            adminSubTab === 'statutory'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Admin Statutory & Compliance Tasks</span>
        </button>
      </div>
      <div className="text-[11px] text-slate-500 font-medium">
        {adminSubTab === 'geotech_queue'
          ? 'Site Engineer validated tasks awaiting your final statutory & geotechnical sign-off'
          : 'Direct administrative permits, clearances, and handover milestones'}
      </div>
    </div>
  );
};
