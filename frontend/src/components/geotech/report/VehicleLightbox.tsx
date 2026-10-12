import { X } from 'lucide-react';
import { VEHICLE_IMAGE_MAP } from '../../../pages/GeotechnicalReportPageConstants';
import { GeotechReportCtx } from './useGeotechReportState';

export const VehicleLightbox: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { enlargedVehicle, setEnlargedVehicle } = ctx;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setEnlargedVehicle(null)}
    >
      <div
        className="bg-slate-900 text-white rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-72 sm:h-96 w-full bg-black">
          <img
            src={VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.src || '/vehicles/backhoe.png'}
            alt={enlargedVehicle.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />
          <button
            onClick={() => setEnlargedVehicle(null)}
            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-xs transition-colors border border-white/20"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded border shadow-xs backdrop-blur-md ${VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badgeColor || 'bg-slate-800'}`}>
                {VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badge}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-white text-slate-950 font-black shadow-xs">
                {enlargedVehicle.count} {enlargedVehicle.count === 1 ? 'Unit Required' : 'Units Required'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">{enlargedVehicle.name}</h2>
            <p className="text-slate-300 text-xs mt-0.5">{VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.label}</p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Recommended Models</span>
              <span className="font-bold text-white text-sm mt-0.5 block">{enlargedVehicle.models}</span>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Technical Specs</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{enlargedVehicle.spec}</span>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Machine Hours</span>
              <span className="font-bold text-amber-400 text-sm mt-0.5 block">{enlargedVehicle.machine_hours} Hours</span>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Deployment Timeline</span>
              <span className="font-bold text-emerald-400 text-sm mt-0.5 block">Day {enlargedVehicle.first_day} → Day {enlargedVehicle.last_day}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1.5">
            <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">Civil Engineering Justification</span>
            <p className="text-slate-200 leading-relaxed">{enlargedVehicle.why}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
