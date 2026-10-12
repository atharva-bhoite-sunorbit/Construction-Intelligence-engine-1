import React from 'react';
import { Drill } from 'lucide-react';
import { getStrataTheme, getExcavabilityBadge } from '../../../pages/GeotechnicalReportPageConstants';
import { CubeCtx } from './useIsometricCubeModel';

export const StrataColumn: React.FC<{ ctx: CubeCtx }> = ({ ctx }) => {
  const { activeLayers, activeIndex, handleSelectLayer } = ctx;
  return (
    <div className="lg:col-span-3 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto max-h-[780px]">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Drill className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider block font-mono">
                Borehole Core Column
              </span>
              <span className="text-[10px] text-slate-400">Vertical Core Profile (Synced)</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-300 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            0.0m → {activeLayers[activeLayers.length - 1]?.bottom_m.toFixed(1)}m
          </span>
        </div>

        {/* Dual-Track Visualizer: Depth Scale + Colored Stratum Blocks */}
        <div className="mt-4 flex gap-2.5 relative">
          {/* Depth Scale Ruler */}
          <div className="w-11 shrink-0 flex flex-col justify-between py-1 text-[10px] font-mono text-slate-400 border-r border-slate-800 pr-1.5 select-none">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-bold">0.0m</span>
              <span className="text-slate-600">-</span>
            </div>
            {activeLayers.map((l, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-slate-300">{l.bottom_m.toFixed(1)}m</span>
                <span className="text-slate-600">-</span>
              </div>
            ))}
          </div>

          {/* Stacked Colorful Geological Layers matching 3D Model 100% */}
          <div className="flex-1 space-y-2 relative">
            {activeLayers.map((layer, idx) => {
              const isSelected = activeIndex === idx;
              const theme = getStrataTheme(layer.materialKey);
              const clsBadge = getExcavabilityBadge(layer.excavabilityClassNum);

              return (
                <div
                  key={layer.id}
                  onClick={() => handleSelectLayer(idx)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group ${
                    isSelected
                      ? `ring-4 ring-amber-400 border-white shadow-xl scale-[1.02] bg-gradient-to-r ${theme.gradient}`
                      : `border-slate-700/80 hover:border-slate-500 hover:shadow-md bg-gradient-to-r ${theme.gradient} opacity-90 hover:opacity-100`
                  }`}
                  style={{
                    minHeight: `${Math.max(68, (layer.thickness_m || 1) * 32)}px`,
                  }}
                >
                  <div className="absolute inset-0 bg-black/15 pointer-events-none" />

                  <div className="flex items-start justify-between relative z-10 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base drop-shadow-sm shrink-0">{theme.iconSymbol}</span>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-white drop-shadow-md truncate tracking-tight">
                          {layer.name}
                        </h4>
                        <span className="text-[9px] text-white/80 font-medium block truncate">
                          {theme.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono font-bold text-white bg-black/50 px-1.5 py-0.5 rounded border border-white/20">
                        {layer.depthRangeDisplay.replace(' EGL', '')}
                      </span>
                      <span className="text-[9px] text-white/80 font-mono block mt-0.5">
                        ({layer.thicknessDisplay})
                      </span>
                    </div>
                  </div>

                  {/* Layer parameters footer */}
                  <div className="mt-2 flex items-center justify-between gap-1 relative z-10 pt-1.5 border-t border-white/20 text-white">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs ${clsBadge.bg}`}>
                      Class {layer.excavabilityClassNum}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/90">
                      {layer.ucsMpa && (
                        <span className="bg-black/40 px-1 py-0.5 rounded border border-white/20">
                          UCS {layer.ucsMpa}M
                        </span>
                      )}
                      {layer.bulkingFactor && (
                        <span className="bg-black/40 px-1 py-0.5 rounded border border-white/20">
                          {layer.bulkingFactor}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="text-amber-400 font-medium">▲ Ground Level 0.0m</span>
        <span className="text-slate-300 font-bold">Bedrock Refusal ▼</span>
      </div>
    </div>
  );
};
