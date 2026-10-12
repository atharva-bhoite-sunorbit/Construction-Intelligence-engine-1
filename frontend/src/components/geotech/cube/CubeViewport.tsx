import React from 'react';
import { Sparkles } from 'lucide-react';
import { IsometricSvgScene } from './IsometricSvgScene';
import { CubeCtx } from './useIsometricCubeModel';

export const CubeViewport: React.FC<{ ctx: CubeCtx }> = ({ ctx }) => {
  const { viewMode, layoutMode, activeLayers, currentLayer } = ctx;
  return (
    <div className={`${layoutMode === 'dual' ? 'lg:col-span-5' : 'lg:col-span-8'} bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex flex-col items-center justify-center relative select-none overflow-hidden min-h-[540px]`}>
      {/* Subtle Isometric Grid Background Lines */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, #38bdf8 0%, transparent 60%), radial-gradient(#334155 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 28px 28px',
        }}
      />

      {/* Top Status Banner */}
      <div className="absolute top-2 left-6 right-6 flex items-center justify-between text-[11px] text-slate-500 pointer-events-none z-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-mono text-slate-300 uppercase tracking-wider font-semibold">
            {viewMode === 'borehole' ? 'BOREHOLE STRATA CORE 3D' : 'HIGHWAY PAVEMENT 3D'} • {activeLayers.length} LAYERS
          </span>
        </div>
        <div className="font-mono text-amber-400 font-bold">
          0.0m → {activeLayers[activeLayers.length - 1]?.bottom_m.toFixed(1) || '8.0'}m Depth
        </div>
      </div>

      {/* Interactive SVG 3D Isometric Engine */}
      <IsometricSvgScene ctx={ctx} />

      {/* Bottom Interactive Legend / Status Ribbon */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-300 flex items-center gap-1.5 font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            ACTIVE 3D LAYER:
          </span>
          <span className="font-extrabold text-amber-400 font-mono">
            {currentLayer.name}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {currentLayer.category}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>Depth: <strong className="text-white">{currentLayer.depthRangeDisplay}</strong></span>
          <span>•</span>
          <span>Thickness: <strong className="text-amber-300">{currentLayer.thicknessDisplay}</strong></span>
          <span>•</span>
          <span className="text-slate-500">Click any layer in 3D or Borehole column to select</span>
        </div>
      </div>
    </div>
  );
};
