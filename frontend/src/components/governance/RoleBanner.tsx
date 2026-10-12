import { ShieldCheck, Info, Layers, HardHat, CheckCheck, Eye } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const RoleBanner: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { activeRole, setActiveRole, activeReviewerName } = ctx;
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl border border-slate-700/60 p-6 text-white shadow-xl shadow-slate-950/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-700/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40 flex items-center gap-1 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-brand-400" />
              Multi-Tier Governance Architecture
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
              Two-Tier Verification Gate
            </span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Activity Validation & Verification Hub</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Every role owns distinct activities. Geotechnical & excavation activities validated by{' '}
            <span className="font-semibold text-teal-300">Site Engineer</span> are forwarded to{' '}
            <span className="font-semibold text-blue-300">Admin</span> for final verification. Field operations validated by{' '}
            <span className="font-semibold text-emerald-300">Site Manager</span> are verified by the{' '}
            <span className="font-semibold text-indigo-300">Project Manager</span>. Finally,{' '}
            <span className="font-semibold text-purple-300">Top Management</span> maintains executive visibility.
          </p>
        </div>

        {/* Active Reviewer Card */}
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center gap-3 shrink-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
              activeRole === 'Site Engineer'
                ? 'bg-teal-600'
                : activeRole === 'Site Manager'
                ? 'bg-emerald-600'
                : activeRole === 'Admin'
                ? 'bg-blue-600'
                : activeRole === 'Project Manager'
                ? 'bg-indigo-600'
                : 'bg-purple-600'
            }`}
          >
            {activeRole === 'Site Engineer' && <Layers className="w-5 h-5" />}
            {activeRole === 'Site Manager' && <HardHat className="w-5 h-5" />}
            {activeRole === 'Admin' && <ShieldCheck className="w-5 h-5" />}
            {activeRole === 'Project Manager' && <CheckCheck className="w-5 h-5" />}
            {activeRole === 'Top Management' && <Eye className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Active View & Authority
            </div>
            <div className="text-xs font-extrabold text-white">{activeReviewerName}</div>
            <div className="text-[10px] text-slate-400 font-mono">Role: {activeRole}</div>
          </div>
        </div>
      </div>

      {/* 5 Interactive Role Switcher Tabs */}
      <div className="pt-5">
        <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center justify-between">
          <span>Switch Role Perspective (Test All Users Individually):</span>
          <span className="text-[10px] text-slate-400 font-normal">
            Click any role to see their exclusive activities and verification gate
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* 1. Site Engineer */}
          <button
            onClick={() => setActiveRole('Site Engineer')}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeRole === 'Site Engineer'
                ? 'bg-teal-600/20 border-teal-500 shadow-md shadow-teal-950 text-white'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Site Engineer
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-extrabold">
                Geotech Gate
              </span>
            </div>
            <div className="font-bold text-xs truncate">Liam Chen</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Borelogs, SPT, Excavation, Shoring
            </div>
          </button>

          {/* 2. Site Manager */}
          <button
            onClick={() => setActiveRole('Site Manager')}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeRole === 'Site Manager'
                ? 'bg-emerald-600/20 border-emerald-500 shadow-md shadow-emerald-950 text-white'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <HardHat className="w-3.5 h-3.5" />
                Site Manager
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold">
                Stage 1 Gate
              </span>
            </div>
            <div className="font-bold text-xs truncate">Elena Rostova</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Masonry, MEP, Finishes, Rough-ins
            </div>
          </button>

          {/* 3. Admin */}
          <button
            onClick={() => setActiveRole('Admin')}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeRole === 'Admin'
                ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-950 text-white'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold">
                Geotech Verifier
              </span>
            </div>
            <div className="font-bold text-xs truncate">Alexander Vance</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Permits & Final Geotech Verifier
            </div>
          </button>

          {/* 4. Project Manager */}
          <button
            onClick={() => setActiveRole('Project Manager')}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeRole === 'Project Manager'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-950 text-white'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" />
                Project Manager
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-extrabold">
                Master Verifier
              </span>
            </div>
            <div className="font-bold text-xs truncate">Marcus Brody</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Structural Path & PM Verifier
            </div>
          </button>

          {/* 5. Top Management */}
          <button
            onClick={() => setActiveRole('Top Management')}
            className={`p-3 rounded-xl border text-left transition-all col-span-2 md:col-span-1 ${
              activeRole === 'Top Management'
                ? 'bg-purple-600/20 border-purple-500 shadow-md shadow-purple-950 text-white'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                Top Management
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-extrabold">
                Executive View
              </span>
            </div>
            <div className="font-bold text-xs truncate">Sophia Sterling</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Certified Records & Oversight
            </div>
          </button>
        </div>
      </div>

      {/* Dynamic Role Guidance Alert */}
      <div className="mt-4 p-3 rounded-xl text-xs flex items-start gap-2.5 bg-slate-800/80 border border-slate-700">
        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-slate-300 text-[11px] leading-relaxed">
          {activeRole === 'Site Engineer' && (
            <p>
              <strong className="text-white">Site Engineer Geotechnical & Excavation Scope:</strong> You validate geotechnical soil investigations, borelog profiles, SPT test records, bulk excavation earthworks, pit shoring, and dewatering. Clicking{' '}
              <span className="text-teal-300 font-bold">Validate (YES)</span> approves Stage 1 and forwards the task directly to{' '}
              <span className="text-blue-300 font-bold">Admin for Final Verification</span>. The task will{' '}
              <strong className="text-amber-300">ONLY be officially recorded once verified by Admin</strong>.
            </p>
          )}
          {activeRole === 'Site Manager' && (
            <p>
              <strong className="text-white">Site Manager Scope:</strong> You can only validate Site Manager activities (masonry, finishes, MEP). Clicking{' '}
              <span className="text-emerald-300 font-bold">Validate (YES)</span> approves Stage 1 and forwards the activity into the{' '}
              <span className="text-indigo-300 font-bold">Awaiting PM Verification</span> queue. It will{' '}
              <strong className="text-amber-300">ONLY be recorded once verified by the Project Manager</strong>.
            </p>
          )}
          {activeRole === 'Admin' && (
            <p>
              <strong className="text-white">Admin Scope & Final Verification Gate:</strong> (1) You validate administrative statutory tasks (surveys, licenses, handover) which forward to PM. (2){' '}
              <strong className="text-blue-300">Final Verification Authority:</strong> You perform Stage 2 Final Verification on Site Engineer's Geotechnical & Excavation activities in the verification queue below—countersigning and officially recording them into the master project ledger.
            </p>
          )}
          {activeRole === 'Project Manager' && (
            <p>
              <strong className="text-white">Project Manager Dual Authority:</strong> (1) You directly validate core structural milestones (slabs, columns, cranes) which become recorded immediately. (2){' '}
              <strong className="text-indigo-300">Mandatory Countersign Gate:</strong> You verify and countersign activities submitted by Site Manager and Admin in the queue below—only upon your verification are they officially recorded.
            </p>
          )}
          {activeRole === 'Top Management' && (
            <p>
              <strong className="text-white">Top Management Executive Portal:</strong> Read-only executive oversight. Displays real-time recording completion rates, role-by-role compliance matrices across all operational gates, and the master certified registry of all recorded activities.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
