import React, { useState } from 'react';
import { BoreholeRecord } from '../../types';
import { Rotate3d, Layers, Droplets, Info, Eye } from 'lucide-react';

interface ThreeDGeologicalViewProps {
  boreholes: BoreholeRecord[];
  groundwaterDepth?: string;
}

export const ThreeDGeologicalView: React.FC<ThreeDGeologicalViewProps> = ({
  boreholes,
  groundwaterDepth = '1.5–2.5 m',
}) => {
  const [pitch, setPitch] = useState(60);
  const [yaw, setYaw] = useState(35);
  const [zoom, setZoom] = useState(1);
  const [showWaterPlane, setShowWaterPlane] = useState(true);

  if (!boreholes || boreholes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        No borehole data available for 3D geological rendering.
      </div>
    );
  }

  // Borehole spatial layout coordinates (normalized 0 to 400 space)
  const bhCoords: Record<string, { x: number; y: number }> = {
    'BH-01': { x: 80, y: 80 },
    'BH-02': { x: 320, y: 90 },
    'BH-03': { x: 200, y: 200 },
    'BH-04': { x: 90, y: 310 },
    'BH-05': { x: 310, y: 310 },
  };

  const maxTerm = Math.max(...boreholes.map((b) => b.termination_depth || 12));

  return (
    <div className="space-y-4">
      {/* Top Banner with Mandatory Interpolation Badge */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Rotate3d className="w-4 h-4 text-brand-400" />
              <span>3D Subsurface Geological Strata & Borehole Model</span>
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-mono tracking-wider">
              INTERPOLATED GEOLOGICAL MODEL
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Volumetric interpolation between independently measured borehole coordinates.
            Interpolation is computational and does not represent direct subsurface measurement.
          </p>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showWaterPlane}
              onChange={(e) => setShowWaterPlane(e.target.checked)}
              className="rounded text-brand-500 focus:ring-0"
            />
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>Water Table</span>
          </label>

          <button
            onClick={() => {
              setPitch(60);
              setYaw(35);
              setZoom(1);
            }}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* 3D Isometric Viewport */}
      <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-6 overflow-hidden h-[480px] flex items-center justify-center select-none shadow-inner">
        {/* Depth Scale Legend */}
        <div className="absolute left-6 top-6 bottom-6 w-20 pointer-events-none flex flex-col justify-between text-[10px] font-mono text-slate-400 border-r border-slate-800/80 pr-2">
          <div className="text-emerald-400 font-bold">0.0m Surface</div>
          <div className="text-amber-400">1.5m–4.5m CWR</div>
          <div className="text-cyan-400">3.0m–9.0m Basalt</div>
          <div className="text-slate-500">{maxTerm}m Bedrock</div>
        </div>

        {/* Isometric 3D Stage */}
        <div
          className="relative transition-transform duration-100 ease-out"
          style={{
            transform: `perspective(1000px) rotateX(${pitch}deg) rotateZ(${yaw}deg) scale(${zoom})`,
            width: '420px',
            height: '420px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Ground Surface Plate (Datum) */}
          <div
            className="absolute inset-0 border-2 border-dashed border-emerald-500/40 bg-emerald-950/20 rounded-xl"
            style={{ transform: 'translateZ(0px)' }}
          >
            <div className="absolute top-2 left-2 text-[10px] font-mono text-emerald-400 font-bold tracking-wider">
              GROUND LEVEL (GL +0.0m)
            </div>
          </div>

          {/* Semi-transparent Groundwater Plane */}
          {showWaterPlane && (
            <div
              className="absolute inset-0 border border-cyan-400/50 bg-cyan-500/15 rounded-xl pointer-events-none"
              style={{
                transform: 'translateZ(-50px)',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
              }}
            >
              <div className="absolute bottom-2 right-2 text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-1">
                <Droplets className="w-3 h-3" />
                <span>STATIC WATER TABLE ({groundwaterDepth})</span>
              </div>
            </div>
          )}

          {/* Interpolated Bedrock Floor */}
          <div
            className="absolute inset-0 border border-cyan-700/60 bg-cyan-950/30 rounded-xl"
            style={{ transform: 'translateZ(-140px)' }}
          >
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-cyan-400 font-bold">
              HARD BASALT BEDROCK FORMATION
            </div>
          </div>

          {/* Borehole Vertical Columns */}
          {boreholes.map((bh, idx) => {
            const coord = bhCoords[bh.borehole_id] || {
              x: 60 + (idx % 3) * 140,
              y: 60 + Math.floor(idx / 3) * 140,
            };

            const cwrH = Math.round((bh.cwr_depth / maxTerm) * 180);
            const hrH = Math.round((bh.hard_rock_depth / maxTerm) * 180);
            const totalH = 180;

            return (
              <div
                key={bh.borehole_id}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${coord.x}px`,
                  top: `${coord.y}px`,
                  transform: 'translateZ(0px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Surface Pin */}
                <div className="w-3 h-3 rounded-full bg-brand-400 ring-2 ring-white shadow-lg animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-white bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700 shadow-md whitespace-nowrap mt-1">
                  {bh.borehole_id}
                </span>

                {/* 3D Vertical Cylinder / Column going down */}
                <div
                  className="w-2.5 rounded-full flex flex-col overflow-hidden shadow-2xl border border-white/20"
                  style={{
                    height: `${totalH}px`,
                    transform: 'rotateX(-90deg) translateZ(90px)',
                    transformOrigin: 'top center',
                  }}
                >
                  {/* Layer 1: Soil */}
                  <div
                    style={{ height: `${cwrH}px` }}
                    className="w-full bg-amber-500"
                    title={`Soil Layer (0 to ${bh.cwr_depth}m)`}
                  />
                  {/* Layer 2: CWR */}
                  <div
                    style={{ height: `${Math.max(15, hrH - cwrH)}px` }}
                    className="w-full bg-orange-600"
                    title={`Completely Weathered Rock (${bh.cwr_depth}m to ${bh.hard_rock_depth}m)`}
                  />
                  {/* Layer 3: Hard Bedrock */}
                  <div
                    className="w-full bg-cyan-600 flex-1"
                    title={`Hard Basalt Bedrock (${bh.hard_rock_depth}m to ${bh.termination_depth}m)`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Legend Bottom Right */}
        <div className="absolute right-6 bottom-6 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Soil Overburden (Fill / Clay)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
            <span>Completely Weathered Rock (CWR)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
            <span>Massive Hard Basalt Bedrock</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Static Groundwater Surface</span>
          </div>
        </div>
      </div>
    </div>
  );
};
