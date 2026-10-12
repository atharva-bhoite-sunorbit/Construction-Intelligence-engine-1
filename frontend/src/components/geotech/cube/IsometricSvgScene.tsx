import React from 'react';
import { getStrataTheme } from '../../../pages/GeotechnicalReportPageConstants';
import { getStrata3DShading } from './cubeData';
import { CubeCtx } from './useIsometricCubeModel';

export const IsometricSvgScene: React.FC<{ ctx: CubeCtx }> = ({ ctx }) => {
  const { uid, viewMode, explodeFactor, showWaterTable, showMachineryOnSite, isFullscreen, activeLayers, handleSelectLayer, pFront, pLeft, pRight, pBack, layerGeometries, waterTableDepth, waterTablePixelY } = ctx;
  return (
    <div className="relative z-10 w-full max-w-[820px] flex items-center justify-center">
      <svg
        viewBox="0 0 900 760"
        className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] filter transition-all"
        style={{ maxHeight: isFullscreen ? '78vh' : '580px' }}
      >
        <defs>
          {/* Dynamic Left Face, Right Face, and Top Face Gradients for Each Layer */}
          {activeLayers.map((l, index) => {
            const shading = getStrata3DShading(l.materialKey, l.ucsMpa ? l.ucsMpa > 25 : false, l.ucsMpa);
            return (
              <React.Fragment key={`grads-${index}`}>
                {/* Left Face Illuminated Gradient */}
                <linearGradient id={`${uid}-grad-left-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={shading.leftTone} />
                  <stop offset="100%" stopColor={shading.leftToneEnd} />
                </linearGradient>

                {/* Right Face Shaded Isometric Gradient */}
                <linearGradient id={`${uid}-grad-right-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={shading.leftToneEnd} />
                  <stop offset="100%" stopColor={shading.rightTone} />
                </linearGradient>

                {/* Top Exposed Face Gradient */}
                <linearGradient id={`${uid}-grad-top-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={shading.topTone} />
                  <stop offset="100%" stopColor={shading.leftTone} />
                </linearGradient>
              </React.Fragment>
            );
          })}

          {/* Ground Surface Gradient for Natural Earth Collar */}
          <linearGradient id={`${uid}-grad-ground`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>

          {/* Asphalt texture pattern */}
          <pattern id={`${uid}-pat-asphalt`} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="none" />
            <circle cx="2" cy="3" r="1" fill="#ffffff" opacity="0.15" />
            <circle cx="10" cy="5" r="1.5" fill="#000000" opacity="0.25" />
            <circle cx="6" cy="11" r="1" fill="#ffffff" opacity="0.1" />
            <circle cx="14" cy="13" r="1.2" fill="#000000" opacity="0.2" />
          </pattern>

          {/* Granular / sand binder pattern */}
          <pattern id={`${uid}-pat-binder`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" />
            <polygon points="3,3 7,2 6,8 2,6" fill="#000000" opacity="0.2" />
            <polygon points="12,6 17,8 15,14 10,11" fill="#ffffff" opacity="0.15" />
            <circle cx="17" cy="17" r="1.8" fill="#000000" opacity="0.25" />
            <circle cx="6" cy="16" r="1.2" fill="#ffffff" opacity="0.2" />
          </pattern>

          {/* Crushed aggregate base pattern */}
          <pattern id={`${uid}-pat-aggregate`} width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="none" />
            <polygon points="4,4 10,2 8,10 2,8" fill="#ffffff" opacity="0.2" />
            <polygon points="14,3 21,7 18,14 12,10" fill="#000000" opacity="0.25" />
            <polygon points="5,15 11,13 13,21 3,20" fill="#ffffff" opacity="0.15" />
          </pattern>

          {/* Granular subbase cobbles pattern */}
          <pattern id={`${uid}-pat-subbase`} width="28" height="28" patternUnits="userSpaceOnUse">
            <rect width="28" height="28" fill="none" />
            <ellipse cx="6" cy="7" rx="5" ry="4" fill="#000000" opacity="0.2" />
            <ellipse cx="19" cy="8" rx="6" ry="5" fill="#ffffff" opacity="0.15" />
            <ellipse cx="10" cy="20" rx="7" ry="5" fill="#000000" opacity="0.25" />
          </pattern>

          {/* Compacted subgrade clay pattern */}
          <pattern id={`${uid}-pat-subgrade`} width="30" height="20" patternUnits="userSpaceOnUse">
            <rect width="30" height="20" fill="none" />
            <line x1="0" y1="5" x2="30" y2="5" stroke="#000000" strokeWidth="1" strokeDasharray="8,4" opacity="0.2" />
            <line x1="0" y1="12" x2="30" y2="12" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
          </pattern>

          {/* Bedrock boulders & fractured basalt pattern */}
          <pattern id={`${uid}-pat-bedrock`} width="48" height="40" patternUnits="userSpaceOnUse">
            <rect width="48" height="40" fill="none" />
            <path d="M0,8 L18,12 L34,6 L48,14" stroke="#ffffff" strokeWidth="1.5" opacity="0.25" fill="none" />
            <path d="M12,11 L16,28 L32,32" stroke="#000000" strokeWidth="2" opacity="0.35" fill="none" />
            <polygon points="4,18 12,16 14,24 8,26" fill="#000000" opacity="0.25" />
            <polygon points="26,14 36,12 38,22 28,24" fill="#ffffff" opacity="0.2" />
          </pattern>

          {/* Dynamic Lighting Linear Gradients */}
          <linearGradient id={`${uid}-grad-road`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          <linearGradient id={`${uid}-grad-watertable`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        {/* TOP SURFACE PERSPECTIVE (Ground Level EGL or Engineered Road) */}
        {(() => {
          const topLayerGeom = layerGeometries[0];
          const topExplode = topLayerGeom?.explodeY || 0;
          const pB = { x: pBack.x, y: pBack.y + topExplode };
          const pR = { x: pRight.x, y: pRight.y + topExplode };
          const pF = { x: pFront.x, y: pFront.y + topExplode };
          const pL = { x: pLeft.x, y: pLeft.y + topExplode };

          const centerLineStart = pB;
          const centerLineEnd = pF;

          const isBoreholeMode = viewMode === 'borehole';

          return (
            <g id="top-surface-model" className="cursor-pointer" onClick={() => handleSelectLayer(0)}>
              {/* Main Top Isometric Polygon */}
              <polygon
                points={`${pB.x},${pB.y} ${pR.x},${pR.y} ${pF.x},${pF.y} ${pL.x},${pL.y}`}
                fill={isBoreholeMode ? `url(#${uid}-grad-ground)` : `url(#${uid}-grad-road)`}
                stroke={topLayerGeom?.isTarget ? '#facc15' : '#52525b'}
                strokeWidth={topLayerGeom?.isTarget ? 3 : 1.5}
              />

              {/* Top Surface Texture Overlay */}
              <polygon
                points={`${pB.x},${pB.y} ${pR.x},${pR.y} ${pF.x},${pF.y} ${pL.x},${pL.y}`}
                fill={`url(#${uid}-pat-asphalt)`}
                opacity={isBoreholeMode ? 0.35 : 0.75}
              />

              {/* Borehole Collar Marker (in Borehole Mode) */}
              {isBoreholeMode ? (
                <g>
                  {/* Ground Grid Pattern Lines */}
                  <line
                    x1={pL.x + (pB.x - pL.x) * 0.3}
                    y1={pL.y + (pB.y - pL.y) * 0.3}
                    x2={pF.x + (pR.x - pF.x) * 0.3}
                    y2={pF.y + (pR.y - pF.y) * 0.3}
                    stroke="#34d399"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.4"
                  />
                  <line
                    x1={pL.x + (pB.x - pL.x) * 0.7}
                    y1={pL.y + (pB.y - pL.y) * 0.7}
                    x2={pF.x + (pR.x - pF.x) * 0.7}
                    y2={pF.y + (pR.y - pF.y) * 0.7}
                    stroke="#34d399"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.4"
                  />

                  {/* Concentric Borehole Collar Pin (BH-01 Target) */}
                  <g transform={`translate(${(pB.x + pF.x) / 2}, ${(pB.y + pF.y) / 2})`}>
                    <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#ca8a04" strokeWidth="2" opacity="0.95" />
                    <circle cx="0" cy="0" r="7" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="2.5" fill="#0f172a" />
                    <line x1="-20" y1="0" x2="20" y2="0" stroke="#ca8a04" strokeWidth="1" strokeDasharray="3,2" />
                    <line x1="0" y1="-20" x2="0" y2="20" stroke="#ca8a04" strokeWidth="1" strokeDasharray="3,2" />

                    {/* Collar Label Badge */}
                    <rect x="24" y="-12" width="135" height="24" rx="5" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" opacity="0.9" />
                    <text x="32" y="4" fill="#fef08a" fontSize="10" fontWeight="bold" fontFamily="monospace">
                      ⨁ BH-01 Core Collar
                    </text>
                  </g>
                </g>
              ) : (
                /* Highway Yellow Striping */
                <g opacity="0.95">
                  <line
                    x1={centerLineStart.x - 3}
                    y1={centerLineStart.y}
                    x2={centerLineEnd.x - 3}
                    y2={centerLineEnd.y}
                    stroke="#facc15"
                    strokeWidth="3"
                  />
                  <line
                    x1={centerLineStart.x + 3}
                    y1={centerLineStart.y}
                    x2={centerLineEnd.x + 3}
                    y2={centerLineEnd.y}
                    stroke="#facc15"
                    strokeWidth="3"
                  />
                </g>
              )}

              {/* Site machinery positioned on surface if enabled */}
              {showMachineryOnSite && (
                <g transform={`translate(${centerLineStart.x + 40}, ${centerLineStart.y + 45}) scale(0.85)`}>
                  <g className="filter drop-shadow-md">
                    <rect x="-24" y="8" width="48" height="9" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                    <circle cx="-16" cy="12" r="3" fill="#71717a" />
                    <circle cx="0" cy="12" r="3" fill="#71717a" />
                    <circle cx="16" cy="12" r="3" fill="#71717a" />
                    <rect x="-18" y="-6" width="36" height="15" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                    <rect x="-14" y="-4" width="14" height="9" rx="1.5" fill="#cbd5e1" opacity="0.75" />
                    <path d="M12,-2 L32,-16 L48,-6 L56,4" stroke="#d97706" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <polygon points="54,2 62,6 58,12 52,6" fill="#18181b" />
                  </g>
                  <text x="-16" y="28" fill="#fbbf24" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {isBoreholeMode ? 'DRILL RIG / JCB' : '20T EXCAVATOR'}
                  </text>
                </g>
              )}

              {/* Surface Elevation Marker */}
              <g transform={`translate(${pB.x - 30}, ${pB.y - 18})`}>
                <rect x="0" y="0" width="90" height="20" rx="4" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" opacity="0.9" />
                <text x="45" y="14" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  EGL ±0.00m
                </text>
              </g>
            </g>
          );
        })()}

        {/* RENDER ALL GEOLOGICAL STRATA LAYERS */}
        {layerGeometries.map(({ layer, index, topY, bottomY, slabHeight, explodeY, isTarget }) => {
          // Left Face 4 points:
          const tl = { x: pLeft.x, y: pLeft.y + topY + explodeY };
          const tf = { x: pFront.x, y: pFront.y + topY + explodeY };
          const bf = { x: pFront.x, y: pFront.y + bottomY + explodeY };
          const bl = { x: pLeft.x, y: pLeft.y + bottomY + explodeY };

          // Right Face 4 points:
          const tr = { x: pRight.x, y: pRight.y + topY + explodeY };
          const br = { x: pRight.x, y: pRight.y + bottomY + explodeY };

          // Top Exposed Face (visible when exploded)
          const tb = { x: pBack.x, y: pBack.y + topY + explodeY };

          const shading = getStrata3DShading(layer.materialKey, layer.ucsMpa ? layer.ucsMpa > 25 : false, layer.ucsMpa);
          const theme = getStrataTheme(layer.materialKey);

          // Pattern Fill ID according to patternType
          let patId = `${uid}-pat-asphalt`;
          if (layer.patternType === 'binder') patId = `${uid}-pat-binder`;
          else if (layer.patternType === 'base_aggregate') patId = `${uid}-pat-aggregate`;
          else if (layer.patternType === 'subbase_gravel') patId = `${uid}-pat-subbase`;
          else if (layer.patternType === 'compacted_subgrade') patId = `${uid}-pat-subgrade`;
          else if (layer.patternType === 'bedrock_boulders') patId = `${uid}-pat-bedrock`;

          return (
            <g
              key={layer.id}
              id={`layer-group-${layer.id}`}
              onClick={() => handleSelectLayer(index)}
              className="cursor-pointer transition-all duration-200 group"
            >
              {/* Exploded alignment guide dashed lines */}
              {explodeFactor > 0.1 && index > 0 && (
                <g stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" opacity="0.4">
                  <line x1={tl.x} y1={tl.y} x2={tl.x} y2={tl.y - explodeFactor * 16} />
                  <line x1={tf.x} y1={tf.y} x2={tf.x} y2={tf.y - explodeFactor * 16} />
                  <line x1={tr.x} y1={tr.y} x2={tr.x} y2={tr.y - explodeFactor * 16} />
                </g>
              )}

              {/* TOP EXPOSED FACE (Rendered when exploded) */}
              {explodeFactor > 0.05 && index > 0 && (
                <polygon
                  points={`${tb.x},${tb.y} ${tr.x},${tr.y} ${tf.x},${tf.y} ${tl.x},${tl.y}`}
                  fill={`url(#${uid}-grad-top-${index})`}
                  stroke={isTarget ? '#facc15' : shading.stroke}
                  strokeWidth={isTarget ? 2.5 : 1}
                  opacity={isTarget ? 1 : 0.9}
                />
              )}

              {/* LEFT ISOMETRIC FACE (Illuminated Geological Cross-Section Profile) */}
              <polygon
                points={`${tl.x},${tl.y} ${tf.x},${tf.y} ${bf.x},${bf.y} ${bl.x},${bl.y}`}
                fill={`url(#${uid}-grad-left-${index})`}
                stroke={isTarget ? '#facc15' : shading.stroke}
                strokeWidth={isTarget ? 3 : 1.2}
                className="transition-all"
              />

              {/* Geological Pattern Texture Overlay on Left Face */}
              <polygon
                points={`${tl.x},${tl.y} ${tf.x},${tf.y} ${bf.x},${bf.y} ${bl.x},${bl.y}`}
                fill={`url(#${patId})`}
                opacity="0.3"
                style={{ mixBlendMode: 'overlay' }}
              />

              {/* RIGHT ISOMETRIC FACE (Shaded Depth Profile Side) */}
              <polygon
                points={`${tf.x},${tf.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bf.x},${bf.y}`}
                fill={`url(#${uid}-grad-right-${index})`}
                stroke={isTarget ? '#facc15' : shading.stroke}
                strokeWidth={isTarget ? 3 : 1.2}
                className="transition-all"
              />

              {/* Geological Pattern Texture Overlay on Right Face */}
              <polygon
                points={`${tf.x},${tf.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bf.x},${bf.y}`}
                fill={`url(#${patId})`}
                opacity="0.35"
                style={{ mixBlendMode: 'overlay' }}
              />

              {/* Layer Seam Highlight Glow Lines */}
              <line
                x1={tl.x}
                y1={tl.y}
                x2={tf.x}
                y2={tf.y}
                stroke={isTarget ? '#fef08a' : '#cbd5e1'}
                strokeWidth={isTarget ? 2.5 : 0.8}
                opacity={isTarget ? 1 : 0.65}
              />
              <line
                x1={tf.x}
                y1={tf.y}
                x2={tr.x}
                y2={tr.y}
                stroke={isTarget ? '#fef08a' : '#94a3b8'}
                strokeWidth={isTarget ? 2.5 : 0.8}
                opacity={isTarget ? 1 : 0.55}
              />

              {/* LEFT FACE LAYER CALLOUT PIN (Matching Borehole Icon & Name) */}
              <g transform={`translate(${tl.x - 14}, ${(tl.y + bl.y) / 2})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={isTarget ? '7' : '5'}
                  fill={isTarget ? '#facc15' : shading.stroke}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className={isTarget ? 'animate-pulse' : ''}
                />
                <line x1="0" y1="0" x2="-24" y2="0" stroke={isTarget ? '#facc15' : shading.stroke} strokeWidth="1.5" />
                <rect
                  x="-195"
                  y="-12"
                  width="168"
                  height="25"
                  rx="5"
                  fill="#090d16"
                  stroke={isTarget ? '#facc15' : shading.stroke}
                  strokeWidth={isTarget ? '2' : '1'}
                  opacity="0.95"
                />
                <text
                  x="-111"
                  y="4"
                  fill={isTarget ? '#fef08a' : '#f1f5f9'}
                  fontSize="10"
                  fontWeight={isTarget ? '800' : '600'}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {theme.iconSymbol} {layer.name.length > 20 ? layer.name.slice(0, 18) + '…' : layer.name}
                </text>
              </g>

              {/* RIGHT FACE DEPTH & THICKNESS ANNOTATION */}
              <g transform={`translate(${tr.x + 12}, ${(tr.y + br.y) / 2})`}>
                <line x1="0" y1="0" x2="20" y2="0" stroke={isTarget ? '#facc15' : '#475569'} strokeWidth="1" strokeDasharray="2,2" />
                <text
                  x="26"
                  y="3"
                  fill={isTarget ? '#fef08a' : '#cbd5e1'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {layer.bottom_m.toFixed(1)}m ({layer.thicknessDisplay})
                </text>
              </g>
            </g>
          );
        })}

        {/* GROUNDWATER TABLE HORIZON SHIMMER PLANE */}
        {showWaterTable && (
          <g id="groundwater-plane" className="pointer-events-none">
            {(() => {
              const wtY = waterTablePixelY + (layerGeometries[Math.min(2, layerGeometries.length - 1)]?.explodeY || 0);
              const wtL = { x: pLeft.x - 20, y: pLeft.y + wtY };
              const wtF = { x: pFront.x, y: pFront.y + wtY };
              const wtR = { x: pRight.x + 20, y: pRight.y + wtY };
              const wtB = { x: pBack.x, y: pBack.y + wtY };

              return (
                <g>
                  {/* Shimmering Water Table Plane */}
                  <polygon
                    points={`${wtB.x},${wtB.y} ${wtR.x},${wtR.y} ${wtF.x},${wtF.y} ${wtL.x},${wtL.y}`}
                    fill={`url(#${uid}-grad-watertable)`}
                    stroke="#14b8a6"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    className="animate-pulse"
                  />

                  {/* Ripples */}
                  <path
                    d={`M${wtL.x},${wtL.y} Q${(wtL.x + wtF.x) / 2},${(wtL.y + wtF.y) / 2 - 4} ${wtF.x},${wtF.y} Q${(wtF.x + wtR.x) / 2},${(wtR.y + wtR.y) / 2 - 4} ${wtR.x},${wtR.y}`}
                    fill="none"
                    stroke="#ccfbf1"
                    strokeWidth="1.5"
                  />

                  {/* GWT Callout Badge */}
                  <g transform={`translate(${wtR.x + 10}, ${wtR.y - 10})`}>
                    <rect x="0" y="0" width="145" height="22" rx="4" fill="#0f766e" stroke="#14b8a6" strokeWidth="1" />
                    <text x="72" y="15" fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      🌊 GWT Horizon @ ~{waterTableDepth != null ? waterTableDepth.toFixed(1) : '3.8'}m
                    </text>
                  </g>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
};
