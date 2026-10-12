import React from 'react';
import { Pickaxe, Truck, Download, ChevronRight } from 'lucide-react';
import { getStrataTheme, getExcavabilityBadge, VEHICLE_IMAGE_MAP } from '../../../pages/GeotechnicalReportPageConstants';
import { CubeCtx } from './useIsometricCubeModel';

export const DetailHud: React.FC<{ ctx: CubeCtx }> = ({ ctx }) => {
  const { onNavigateToFleet, onNavigateToStrataTab, layoutMode, activeLayers, activeIndex, currentLayer, handleSelectLayer } = ctx;
  return (
    <div className={`${layoutMode === 'dual' ? 'lg:col-span-4' : 'lg:col-span-4'} bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col justify-between overflow-y-auto max-h-[780px]`}>
      <div className="space-y-4">
        {/* Header of selected layer */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              {currentLayer.category}
            </span>
            <span className="text-xs font-mono font-extrabold text-slate-400">
              {currentLayer.depthRangeDisplay}
            </span>
          </div>

          <h3 className="text-lg font-black text-white mt-1.5 leading-snug flex items-center gap-2">
            <span>{getStrataTheme(currentLayer.materialKey).iconSymbol}</span>
            <span>{currentLayer.name}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            {currentLayer.subtitle}
          </p>
        </div>

        {/* Excavability Class Badge */}
        {(() => {
          const cls = getExcavabilityBadge(currentLayer.excavabilityClassNum);
          return (
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${cls.pill} bg-opacity-20`}>
              <div className="flex items-center gap-2">
                <Pickaxe className="w-4 h-4 shrink-0 text-amber-500" />
                <div>
                  <div className="font-extrabold text-xs text-white">{cls.label}</div>
                  <div className="text-[10px] text-slate-300">{cls.desc}</div>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-xs ${cls.bg}`}>
                Class {currentLayer.excavabilityClassNum}
              </span>
            </div>
          );
        })()}

        {/* Engineering Parameters Matrix */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Layer Thickness
            </span>
            <div className="text-sm font-black text-white mt-0.5 font-mono">
              {currentLayer.thicknessDisplay}
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Bulking Factor
            </span>
            <div className="text-sm font-black text-amber-400 mt-0.5 font-mono">
              {currentLayer.bulkingFactor}x Multiplier
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Strength / UCS / SPT
            </span>
            <div className="text-sm font-black text-emerald-400 mt-0.5 font-mono">
              {currentLayer.ucsMpa ? `${currentLayer.ucsMpa} MPa UCS` : currentLayer.specs.compaction || 'In-Situ Core'}
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Water Horizon
            </span>
            <div className="text-sm font-black text-cyan-400 mt-0.5 font-mono truncate" title={currentLayer.specs.permeability}>
              {currentLayer.specs.permeability}
            </div>
          </div>
        </div>

        {/* Engineering Description */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-300 block mb-1">
            Technical Specification & Borelog Notes:
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentLayer.description}
          </p>
        </div>

        {/* Recommended Machinery for this Layer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Excavation & Fleet Deployment:
            </span>
            {onNavigateToFleet && (
              <button
                onClick={onNavigateToFleet}
                className="text-[10px] font-bold text-brand-400 hover:text-brand-300 flex items-center gap-0.5"
              >
                Fleet Planner <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {currentLayer.recommendedMachinery.map((mKey) => {
              const v = VEHICLE_IMAGE_MAP[mKey] || {
                label: mKey.replace('_', ' ').toUpperCase(),
                badge: 'Heavy Plant Equipment',
                badgeColor: 'bg-slate-800 text-slate-200 border-slate-700',
                src: '/vehicles/backhoe.png',
                description: 'Heavy civil construction machinery assigned to this stratum.',
              };

              return (
                <div
                  key={mKey}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3 hover:border-slate-700 transition-colors"
                >
                  <img
                    src={v.src}
                    alt={v.label}
                    className="w-12 h-10 object-cover rounded-lg border border-slate-700 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{v.label}</div>
                    <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold border ${v.badgeColor}`}>
                      {v.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Layer Switcher Pills */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
            Stratum Hierarchy ({activeLayers.length} Layers):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeLayers.map((l, i) => (
              <button
                key={l.id}
                onClick={() => handleSelectLayer(i)}
                className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                  i === activeIndex
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                L{i + 1}: {l.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Export & Tab Navigation actions */}
      <div className="pt-4 border-t border-slate-800 mt-5 flex items-center justify-between">
        {onNavigateToStrataTab ? (
          <button
            onClick={onNavigateToStrataTab}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
          >
            Full Borehole Log Table <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono">
            1:50 True Isometric BIM
          </span>
        )}

        <button
          onClick={() => {
            window.print();
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          Export 3D Strata View
        </button>
      </div>
    </div>
  );
};
