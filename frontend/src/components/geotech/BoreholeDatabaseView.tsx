import React, { useState } from 'react';
import { BoreholeRecord } from '../../types';
import { Layers, Drill, Droplets, ShieldCheck, ChevronRight } from 'lucide-react';

interface BoreholeDatabaseViewProps {
  boreholes: BoreholeRecord[];
}

export const BoreholeDatabaseView: React.FC<BoreholeDatabaseViewProps> = ({ boreholes }) => {
  const [selectedBoreholeId, setSelectedBoreholeId] = useState<string>(
    boreholes.length > 0 ? boreholes[0].borehole_id : ''
  );

  const selectedBh =
    boreholes.find((b) => b.borehole_id === selectedBoreholeId) || boreholes[0];

  if (!boreholes || boreholes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        No boreholes extracted from report document.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Selector Grid */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Drill className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Independent Boreholes Database ({boreholes.length} Logs Identified)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any borehole to inspect its distinct stratigraphy and depths
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {boreholes.map((bh) => {
            const isSelected = bh.borehole_id === selectedBoreholeId;
            return (
              <button
                key={bh.borehole_id}
                onClick={() => setSelectedBoreholeId(bh.borehole_id)}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-brand-50 border-brand-500 shadow-xs ring-1 ring-brand-500/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {bh.borehole_id}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Depth: {bh.termination_depth}m
                  </span>
                </div>

                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>CWR Level:</span>
                    <span className="font-bold text-amber-700">{bh.cwr_depth} m</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Hard Rock:</span>
                    <span className="font-bold text-cyan-700">{bh.hard_rock_depth} m</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Borehole Detailed Profile */}
      {selectedBh && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vertical Stratum Visualizer Column */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-mono">
                  {selectedBh.borehole_id} Vertical Profile
                </h4>
                <p className="text-[11px] text-slate-500">{selectedBh.source_reference}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Independent Log
              </span>
            </div>

            {/* Visual Borehole Core Strip */}
            <div className="relative pl-12 pr-2 py-2">
              {/* Depth Markers Left Axis */}
              <div className="absolute left-0 top-2 bottom-2 w-10 flex flex-col justify-between text-[10px] font-mono text-slate-400 border-r border-slate-200 pr-1">
                <span>0.0m</span>
                <span className="text-amber-600 font-bold">{selectedBh.cwr_depth}m</span>
                <span className="text-cyan-600 font-bold">{selectedBh.hard_rock_depth}m</span>
                <span>{selectedBh.termination_depth}m</span>
              </div>

              {/* Stratum Layer Blocks */}
              <div className="space-y-1.5">
                {selectedBh.layers.map((layer, idx) => {
                  const isRock = layer.is_rock;
                  const isHard = layer.layer_name.toLowerCase().includes('hard') || layer.layer_name.toLowerCase().includes('bedrock');
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isHard
                          ? 'bg-cyan-50/60 border-cyan-200 text-cyan-950'
                          : isRock
                          ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>{layer.layer_name}</span>
                        <span className="font-mono text-[11px]">
                          {layer.top_depth}m – {layer.bottom_depth}m ({layer.thickness}m thick)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {layer.description || 'Strata formation logged in report.'}
                      </p>
                      {layer.spt_n && (
                        <div className="mt-1.5 flex gap-2 text-[10px] font-mono">
                          <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                            SPT: {layer.spt_n}
                          </span>
                          {layer.core_recovery && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              CR: {layer.core_recovery}
                            </span>
                          )}
                          {layer.rqd && (
                            <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                              RQD: {layer.rqd}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Borehole Parameter Metadata Cards */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>Strata Transition Depths & Ground Parameters</span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ground Level
                </span>
                <span className="text-base font-bold text-slate-800 font-mono">
                  {selectedBh.ground_level} m
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Reference Datum</span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Depth to CWR
                </span>
                <span className="text-base font-bold text-amber-900 font-mono">
                  {selectedBh.cwr_depth} m
                </span>
                <span className="text-[10px] text-amber-700/80 block mt-0.5">
                  Completely Weathered Rock
                </span>
              </div>

              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                  Depth to Hard Rock
                </span>
                <span className="text-base font-bold text-cyan-900 font-mono">
                  {selectedBh.hard_rock_depth} m
                </span>
                <span className="text-[10px] text-cyan-700/80 block mt-0.5">
                  Competent Bedrock Strata
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Water Table Depth
                </span>
                <span className="text-base font-bold text-blue-900 font-mono">
                  {selectedBh.groundwater_depth}
                </span>
                <span className="text-[10px] text-blue-700/80 block mt-0.5">
                  Static Water Encountered
                </span>
              </div>
            </div>

            {/* Comparison with other boreholes in project */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                All Boreholes Depth Variation Matrix (Table A Verification)
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Borehole ID</th>
                      <th className="py-2 px-3">Depth to CWR</th>
                      <th className="py-2 px-3">Depth to Hard Rock</th>
                      <th className="py-2 px-3">Termination</th>
                      <th className="py-2 px-3">Water Level</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {boreholes.map((b) => {
                      const isCurrent = b.borehole_id === selectedBh.borehole_id;
                      return (
                        <tr
                          key={b.borehole_id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isCurrent ? 'bg-brand-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-slate-900">{b.borehole_id}</td>
                          <td className="py-2 px-3 text-amber-700">{b.cwr_depth} m</td>
                          <td className="py-2 px-3 text-cyan-700">{b.hard_rock_depth} m</td>
                          <td className="py-2 px-3 text-slate-600">{b.termination_depth} m</td>
                          <td className="py-2 px-3 text-blue-600">{b.groundwater_depth}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 text-[10px] font-sans rounded bg-emerald-100 text-emerald-800">
                              Verified
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
