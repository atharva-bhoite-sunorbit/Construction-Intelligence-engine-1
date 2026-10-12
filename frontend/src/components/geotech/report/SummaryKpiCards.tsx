
import { GeotechReportCtx } from './useGeotechReportState';

export const SummaryKpiCards: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { invInfo, bhList, rockData, gwData, foundData, cwrRange, hrRange } = ctx;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {/* Boreholes Count */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
          Boreholes
        </span>
        <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
          {bhList.length > 0 ? bhList.length : invInfo?.number_of_boreholes?.display || '0'}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">
          {bhList.map((b) => b.borehole_id).join(', ') || 'None identified'}
        </span>
      </div>

      {/* Investigation Depth */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
          Invest. Depth
        </span>
        <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
          {invInfo?.investigation_depth_m?.display || 'Not specified'}
        </div>
        <span className="text-[10px] text-slate-500 block">Termination datum</span>
      </div>

      {/* Groundwater Depth */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
          Groundwater
        </span>
        <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
          {gwData?.observed_depth?.display || 'Not specified'}
        </div>
        <span className="text-[10px] text-slate-500 block">Below Ground Level</span>
      </div>

      {/* CWR Depth Range */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block font-mono">
          CWR Strata
        </span>
        <div className="text-lg font-bold text-amber-900 mt-1 font-mono">
          {cwrRange}
        </div>
        <span className="text-[10px] text-amber-700/80 block">Completely Weathered</span>
      </div>

      {/* Hard Rock Depth Range */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block font-mono">
          Hard Rock
        </span>
        <div className="text-lg font-bold text-cyan-900 mt-1 font-mono">
          {hrRange}
        </div>
        <span className="text-[10px] text-cyan-700/80 block truncate">
          {rockData?.rock_type?.display || 'Bedrock formation'}
        </span>
      </div>

      {/* Bearing Capacity */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block font-mono">
          Bearing Capacity
        </span>
        <div className="text-lg font-bold text-emerald-900 mt-1 font-mono">
          {foundData?.net_allowable_bearing_capacity?.display || 'Not specified'}
        </div>
        <span className="text-[10px] text-emerald-700/80 block">Net Safe Capacity</span>
      </div>

      {/* Maximum Settlement */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
          Settlement
        </span>
        <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
          {foundData?.maximum_settlement?.display || 'Not specified'}
        </div>
        <span className="text-[10px] text-slate-500 block">Design Limit</span>
      </div>
    </div>
  );
};
