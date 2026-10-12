import { Truck, CheckCircle2, ZoomIn, Eye } from 'lucide-react';
import { SourceBadge } from '../SourceBadge';
import { VEHICLE_IMAGE_MAP } from '../../../pages/GeotechnicalReportPageConstants';
import { GeotechReportCtx } from './useGeotechReportState';

export const MachineryTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { setEnlargedVehicle, setIsPushModalOpen, machineryList } = ctx;
  return (
    <div className="space-y-6">
      {/* Header and Sync Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-4 h-4 text-brand-600" />
            <span>Construction Fleet & Machinery Sizing Engine</span>
          </h3>
          <p className="text-xs text-slate-500">
            Sized from stratum rock hardness (UCS), bulking expansion, haul lead times & Indian site productivity norms.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPushModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Push Plan to Master Schedule
          </button>
          <SourceBadge sourceType="CALCULATED" />
        </div>
      </div>

      {/* Fleet Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Total Machine Hours
          </span>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
            {machineryList.reduce((acc, m) => acc + (m.machine_hours || 0), 0)} Hours
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Across all scheduled tasks</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Peak Fleet Size
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {machineryList.reduce((acc, m) => acc + (m.count || 0), 0)} Units
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Heavy earthmoving equipment</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Working Shifts
          </span>
          <div className="text-xl font-bold text-brand-700 mt-1 font-mono">
            1 Shift (8 hrs)
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Day shift operation norm</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Excavation Window
          </span>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
            {Math.max(...machineryList.map((m) => m.last_day || 30))} Days
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Day 1 to Pit Handover</span>
        </div>
      </div>

      {/* Grid of Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {machineryList.map((mach, idx) => {
          const vMeta = VEHICLE_IMAGE_MAP[mach.key] || {
            src: '/vehicles/backhoe.png',
            label: mach.name,
            badge: mach.role,
            badgeColor: 'bg-slate-100 text-slate-900 border-slate-300',
            description: mach.why,
          };
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group"
            >
              <div>
                {/* Vehicle Image Header with Zoom Trigger */}
                <div
                  className="h-44 relative overflow-hidden bg-slate-900 cursor-pointer"
                  onClick={() => setEnlargedVehicle(mach)}
                >
                  <img
                    src={vMeta.src}
                    alt={mach.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-xs backdrop-blur-md ${vMeta.badgeColor}`}>
                      {vMeta.badge}
                    </span>
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <span className="p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors block">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between text-white">
                    <div>
                      <h4 className="font-extrabold text-sm leading-tight drop-shadow-md">
                        {mach.name}
                      </h4>
                      <span className="text-[10px] text-slate-300 drop-shadow-sm block">
                        {mach.models || vMeta.label}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-white text-slate-900 font-black shadow-xs shrink-0">
                      {mach.count} {mach.count === 1 ? 'Unit' : 'Units'}
                    </span>
                  </div>
                </div>

                {/* Specifications Body */}
                <div className="p-4 space-y-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">
                      Technical Spec
                    </span>
                    <p className="text-slate-700 font-medium text-[11px] leading-relaxed">
                      {mach.spec}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-mono text-[11px]">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block font-sans uppercase">Total Machine Hrs</span>
                      <span className="font-bold text-amber-700">{mach.machine_hours} hrs</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block font-sans uppercase">Timeline</span>
                      <span className="font-bold text-emerald-700">Day {mach.first_day}–{mach.last_day}</span>
                    </div>
                  </div>

                  {/* Civil Engineering Justification */}
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-950 leading-relaxed">
                    <strong className="block text-[10px] text-amber-800 uppercase tracking-wider mb-0.5">
                      Justification
                    </strong>
                    {mach.why}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => setEnlargedVehicle(mach)}
                  className="text-brand-600 hover:text-brand-700 font-semibold text-[11px] flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  View Specs & Photo
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {mach.deployment_days || (mach.last_day - mach.first_day + 1)} Days Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
