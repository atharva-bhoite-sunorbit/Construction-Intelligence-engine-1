import { ShieldCheck, CheckCircle2, Clock, HardHat, CheckCheck, BarChart3, ArrowRight, Award, Pickaxe } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const ExecutiveSummary: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { project, setTopMgmtSubTab, governanceSummary } = ctx;
  if (!governanceSummary) return null;
  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Executive KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Governed Activities
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {governanceSummary.total_activities}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Structural & handover scope</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Officially Recorded
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {governanceSummary.final_recorded_count}
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold">
            {governanceSummary.recorded_percentage}% Certified Master
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-teal-200 shadow-xs">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Awaiting Admin (Substructure)
          </span>
          <div className="text-2xl font-black text-teal-600 mt-1">
            {governanceSummary.awaiting_admin_count ?? 0}
          </div>
          <span className="text-[10px] text-teal-700 font-medium">
            Site Engineer validated foundation / excavation records
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Awaiting PM (Ops/Admin)
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {governanceSummary.awaiting_pm_count}
          </div>
          <span className="text-[10px] text-amber-700 font-medium">
            Stage 1 Approved by Manager/Admin
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending Stage 1
          </span>
          <div className="text-2xl font-black text-slate-750 mt-1">
            {governanceSummary.pending_stage1_count}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Awaiting SE / SM / Admin</span>
        </div>
      </div>

      {/* 4-Tier Multi-Role Breakdown Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Governance Pipeline Matrix by Owner Role
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Project: {project.code} • {project.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 lg:divide-x divide-slate-200">
          {/* Site Engineer Stats */}
          {governanceSummary.roles['Site Engineer'] && (
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <Pickaxe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Site Engineer Geotech</h4>
                    <span className="text-[10px] text-slate-400">Liam Chen</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  {governanceSummary.roles['Site Engineer'].total} Activities
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Officially Recorded (Admin Verified):</span>
                  <strong className="text-teal-700">
                    {governanceSummary.roles['Site Engineer'].final_recorded}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Awaiting Admin Verification:</span>
                  <strong className="text-amber-600">
                    {governanceSummary.roles['Site Engineer'].awaiting_admin_verification ?? 0}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pending Stage 1 Review:</span>
                  <span className="text-slate-800 font-medium">
                    {governanceSummary.roles['Site Engineer'].pending_validation}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rejected:</span>
                  <span className="text-rose-600 font-medium">
                    {governanceSummary.roles['Site Engineer'].rejected}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Recording Completion</span>
                  <span className="font-bold text-slate-900">
                    {governanceSummary.roles['Site Engineer'].recorded_percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all"
                    style={{ width: `${governanceSummary.roles['Site Engineer'].recorded_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Site Manager Stats */}
          {governanceSummary.roles['Site Manager'] && (
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Site Manager Operations</h4>
                    <span className="text-[10px] text-slate-400">Elena Rostova</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {governanceSummary.roles['Site Manager'].total} Activities
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Officially Recorded (PM Verified):</span>
                  <strong className="text-emerald-700">
                    {governanceSummary.roles['Site Manager'].final_recorded}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Awaiting PM Countersign:</span>
                  <strong className="text-amber-600">
                    {governanceSummary.roles['Site Manager'].awaiting_pm_verification}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pending Stage 1 Validation:</span>
                  <span className="text-slate-800 font-medium">
                    {governanceSummary.roles['Site Manager'].pending_validation}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rejected:</span>
                  <span className="text-rose-600 font-medium">
                    {governanceSummary.roles['Site Manager'].rejected}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Recording Completion</span>
                  <span className="font-bold text-slate-900">
                    {governanceSummary.roles['Site Manager'].recorded_percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${governanceSummary.roles['Site Manager'].recorded_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Admin Stats */}
          {governanceSummary.roles['Admin'] && (
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Admin Statutory & Mobilization</h4>
                    <span className="text-[10px] text-slate-400">Alexander Vance</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {governanceSummary.roles['Admin'].total} Activities
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Officially Recorded (PM Verified):</span>
                  <strong className="text-amber-700">
                    {governanceSummary.roles['Admin'].final_recorded}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Awaiting PM Countersign:</span>
                  <strong className="text-amber-600">
                    {governanceSummary.roles['Admin'].awaiting_pm_verification}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pending Stage 1 Validation:</span>
                  <span className="text-slate-800 font-medium">
                    {governanceSummary.roles['Admin'].pending_validation}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rejected:</span>
                  <span className="text-rose-600 font-medium">
                    {governanceSummary.roles['Admin'].rejected}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Recording Completion</span>
                  <span className="font-bold text-slate-900">
                    {governanceSummary.roles['Admin'].recorded_percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${governanceSummary.roles['Admin'].recorded_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Project Manager Stats */}
          {governanceSummary.roles['Project Manager'] && (
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    <CheckCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">PM Structural Milestones</h4>
                    <span className="text-[10px] text-slate-400">Marcus Brody</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-800 border border-slate-200">
                  {governanceSummary.roles['Project Manager'].total} Activities
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Direct PM Recorded:</span>
                  <strong className="text-slate-700">
                    {governanceSummary.roles['Project Manager'].final_recorded}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pending Direct PM Sign-Off:</span>
                  <span className="text-slate-800 font-medium">
                    {governanceSummary.roles['Project Manager'].pending_validation}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>PM Verified Queue (All Roles):</span>
                  <strong className="text-emerald-700">
                    {governanceSummary.final_recorded_count} Total Recorded
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rejected:</span>
                  <span className="text-rose-600 font-medium">
                    {governanceSummary.roles['Project Manager'].rejected}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Recording Completion</span>
                  <span className="font-bold text-slate-900">
                    {governanceSummary.roles['Project Manager'].recorded_percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-500 h-2 rounded-full transition-all"
                    style={{ width: `${governanceSummary.roles['Project Manager'].recorded_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent PM Verifications Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
              Recent Project Manager Verifications & Audit Provenance
            </h3>
          </div>
          <button
            onClick={() => setTopMgmtSubTab('recorded')}
            className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            <span>View All Recorded Activities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {governanceSummary.recent_verifications.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No activities verified yet. Site Manager & Admin must approve Stage 1, followed by PM verification.
            </div>
          ) : (
            governanceSummary.recent_verifications.map((item) => (
              <div key={item.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700">{item.code || `ACT-${item.id}`}</span>
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        item.assigned_role === 'Site Manager'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.assigned_role === 'Admin'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {item.assigned_role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3">
                    {item.stage1_validated_by && (
                      <span>Stage 1: {item.stage1_validated_by}</span>
                    )}
                    {item.pm_verified_by && (
                      <span className="font-semibold text-emerald-700">
                        PM Verification: {item.pm_verified_by}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {item.final_recorded ? (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      OFFICIALLY RECORDED
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300">
                      AWAITING PM
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
