import React from 'react';
import { useIsometricCubeModel } from './geotech/cube/useIsometricCubeModel';
import { CubeViewport } from './geotech/cube/CubeViewport';
import { StrataColumn } from './geotech/cube/StrataColumn';
import { DetailHud } from './geotech/cube/DetailHud';
import { CubeHeader } from './geotech/cube/CubeHeader';
import type { IsometricGeologicalCubeProps } from './geotech/cube/useIsometricCubeModel';
export type { IsometricGeologicalCubeProps };
export { getStrata3DShading, REFERENCE_HIGHWAY_LAYERS } from './geotech/cube/cubeData';
export type { PavementLayerDefinition, Strata3DShading } from './geotech/cube/cubeData';

export const IsometricGeologicalCube: React.FC<IsometricGeologicalCubeProps> = (props) => {
  const ctx = useIsometricCubeModel(props);
  const { layoutMode, isFullscreen } = ctx;

  return (
    <div className={`bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl flex flex-col' : 'relative'}`}>
      {/* Top Visualizer Header Bar */}
      <CubeHeader ctx={ctx} />

      {/* Main Visualizer Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-hidden">
        {/* 3D Isometric Viewport */}
        <CubeViewport ctx={ctx} />

        {/* SIDE-BY-SIDE BOREHOLE STRATA COLUMN (Visible in Dual View Mode) */}
        {layoutMode === 'dual' && <StrataColumn ctx={ctx} />}

        {/* Right Engineering Detail HUD & Machinery Specifications */}
        <DetailHud ctx={ctx} />
      </div>
    </div>
  );
};
