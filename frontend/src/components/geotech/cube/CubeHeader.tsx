import React from 'react';
import { Drill, Truck, Waves, Rotate3d, Maximize2, Minimize2, Compass, Sliders, Columns, Box } from 'lucide-react';
import { CubeCtx } from './useIsometricCubeModel';

export const CubeHeader: React.FC<{ ctx: CubeCtx }> = ({ ctx }) => {
  const { viewMode, setViewMode, layoutMode, setLayoutMode, explodeFactor, setExplodeFactor, cameraPreset, setCameraPreset, showWaterTable, setShowWaterTable, showMachineryOnSite, setShowMachineryOnSite, isFullscreen, setIsFullscreen, boreholeLayers, handleSelectLayer } = ctx;
  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
          <Rotate3d className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              3D Geological Subsurface Cutaway Visualizer
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
              100% Synced With Borehole Core
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Interactive 3D structural model matching borehole stratigraphy depths, thicknesses, rock properties and JCB/breaker fleet sizing.
          </p>
        </div>
      </div>

      {/* View Mode & Preset Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Layout Mode (Dual Side-by-Side vs 3D Cube Only) */}
        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs">
          <button
            onClick={() => setLayoutMode('dual')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              layoutMode === 'dual'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="View 3D Visual and Borehole Column side-by-side"
          >
            <Columns className="w-3.5 h-3.5" />
            Side-by-Side Dual View
          </button>
          <button
            onClick={() => setLayoutMode('cube_only')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              layoutMode === 'cube_only'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Expanded 3D Isometric View"
          >
            <Box className="w-3.5 h-3.5" />
            3D Cube Focus
          </button>
        </div>

        {/* Stratum Layer Mode Switcher */}
        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shadow-inner text-xs">
          <button
            onClick={() => {
              setViewMode('borehole');
              handleSelectLayer(0);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'borehole'
                ? 'bg-emerald-600 text-white shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Drill className="w-3.5 h-3.5" />
            Borehole Strata ({boreholeLayers.length > 0 ? `${boreholeLayers.length} Layers` : 'Active'})
          </button>
          <button
            onClick={() => {
              setViewMode('pavement');
              handleSelectLayer(0);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'pavement'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Highway Pavement Stack
          </button>
        </div>

        {/* Explode 3D Separation Slider */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Explode:</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            aria-label="Explode 3D strata separation"
            className="w-20 accent-amber-400 cursor-pointer"
          />
          <span className="text-[10px] font-mono font-bold text-amber-300 w-8 text-right">
            {Math.round(explodeFactor * 33)}%
          </span>
        </div>

        {/* Camera Angles */}
        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs">
          <button
            onClick={() => setCameraPreset('isometric')}
            title="Isometric 30° view"
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              cameraPreset === 'isometric' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Iso 30°
          </button>
          <button
            onClick={() => setCameraPreset('steep')}
            title="Top-down perspective"
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              cameraPreset === 'steep' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Top-Down
          </button>
          <button
            onClick={() => setCameraPreset('cross_section')}
            title="Front Cutaway focus"
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              cameraPreset === 'cross_section' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Section
          </button>
        </div>

        {/* Water Table Toggle */}
        <button
          onClick={() => setShowWaterTable(!showWaterTable)}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showWaterTable
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-xs'
              : 'bg-slate-950 text-slate-500 border-slate-800'
          }`}
          title="Toggle Groundwater Table plane"
        >
          <Waves className="w-3.5 h-3.5 text-teal-400" />
          GWT
        </button>

        {/* Heavy Machinery Toggle */}
        <button
          onClick={() => setShowMachineryOnSite(!showMachineryOnSite)}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showMachineryOnSite
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
              : 'bg-slate-950 text-slate-500 border-slate-800'
          }`}
          title="Toggle site machinery simulation"
        >
          <Truck className="w-3.5 h-3.5 text-amber-400" />
          Fleet
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
