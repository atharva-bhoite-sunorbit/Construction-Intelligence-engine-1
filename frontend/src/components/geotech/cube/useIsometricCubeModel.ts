import { useState, useId, useEffect } from 'react';
import { GeotechnicalReport } from '../../../types';
import { getStrataTheme } from '../../../pages/GeotechnicalReportPageConstants';
import { PavementLayerDefinition, getStrata3DShading, getRecommendedMachineryForClass, REFERENCE_HIGHWAY_LAYERS } from './cubeData';

export interface IsometricGeologicalCubeProps {
  report?: GeotechnicalReport | null;
  activeProjectName?: string;
  selectedLayerIndex?: number | null;
  onSelectLayerIndex?: (index: number) => void;
  onNavigateToFleet?: () => void;
  onNavigateToStrataTab?: () => void;
}

export const useIsometricCubeModel = ({
  report,
  activeProjectName,
  selectedLayerIndex,
  onSelectLayerIndex,
  onNavigateToFleet,
  onNavigateToStrataTab,
}: IsometricGeologicalCubeProps) => {
  const uid = useId();

  // Dynamic borehole layers derived directly from the report
  const rawLayers = report?.strata_layers || [];

  // View mode: default to 'borehole' whenever report has layers, otherwise 'borehole' or 'pavement'
  const [viewMode, setViewMode] = useState<'borehole' | 'pavement'>('borehole');

  // Presentation layout: 'dual' (Side-by-side 3D Cutaway + Borehole Core Column) or 'cube_only'
  const [layoutMode, setLayoutMode] = useState<'dual' | 'cube_only'>('dual');

  // Exploded spacing: 0 to 3 factor
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  // Internal layer selection index
  const [internalIndex, setInternalIndex] = useState<number>(0);

  // Camera perspective preset
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'steep' | 'cross_section'>('isometric');

  // Groundwater table plane toggle
  const [showWaterTable, setShowWaterTable] = useState<boolean>(true);

  // Machinery simulation toggle
  const [showMachineryOnSite, setShowMachineryOnSite] = useState<boolean>(true);

  // Fullscreen view toggle
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Switch to borehole mode automatically when report layers become available
  useEffect(() => {
    if (rawLayers.length > 0) {
      setViewMode('borehole');
    }
  }, [report?.id, rawLayers.length]);

  // Construct dynamic borehole layers matching borehole strata column 1-to-1
  const boreholeLayers: PavementLayerDefinition[] = rawLayers.map((l, idx) => {
    const theme = getStrataTheme(l.material_key);
    const shading = getStrata3DShading(l.material_key, l.is_rock, l.ucs_mpa);

    return {
      id: `borehole-${idx}`,
      name: l.material,
      subtitle: `${theme.categoryLabel} • ${l.weathering_grade || 'Stratum ' + (idx + 1)}`,
      category: l.category || (l.is_rock ? 'Rock Bedrock' : 'Overburden Soil'),
      thicknessMm: Math.round(Math.max(l.thickness_m, 0.1) * 1000),
      thicknessDisplay: `${l.thickness_m.toFixed(1)} m thick`,
      depthRangeDisplay: `${l.top_m.toFixed(1)}m – ${l.bottom_m.toFixed(1)}m EGL`,
      materialKey: l.material_key,
      fillLeft: shading.leftTone,
      fillRight: shading.rightTone,
      fillTop: shading.topTone,
      strokeColor: shading.stroke,
      top_m: l.top_m,
      bottom_m: l.bottom_m,
      thickness_m: l.thickness_m,
      patternType: shading.patternType,
      excavabilityClassNum: l.excavability_class_num,
      ucsMpa: l.ucs_mpa,
      rqdPct: l.rqd_pct,
      sptN: l.spt_n,
      cbrPct: l.spt_n ? l.spt_n * 2 : undefined,
      bulkingFactor: l.bulking_factor || 1.3,
      description: l.report_description || l.description || 'Geotechnical subsurface layer identified from borehole core investigation.',
      recommendedMachinery: getRecommendedMachineryForClass(l.excavability_class_num),
      specs: {
        compaction: l.spt_n ? `SPT N = ${l.spt_n}` : l.rqd_pct ? `RQD = ${l.rqd_pct}%` : 'In-Situ Core',
        permeability: l.below_water_table ? 'Saturated Ingress (Below GWT)' : 'Dry / Normal Formation',
        lifespan: l.is_rock ? 'Geological Bedrock Substratum' : 'In-Situ Sedimentary Horizon',
        primaryRole: l.excavation_method || (l.is_rock ? 'Founding Bedrock Strata' : 'Overburden Formation'),
      },
    };
  });

  const activeLayers = (viewMode === 'borehole' && boreholeLayers.length > 0)
    ? boreholeLayers
    : (viewMode === 'pavement' ? REFERENCE_HIGHWAY_LAYERS : (boreholeLayers.length > 0 ? boreholeLayers : REFERENCE_HIGHWAY_LAYERS));

  // Active layer index synchronization with parent
  const activeIndex = (selectedLayerIndex !== undefined && selectedLayerIndex !== null)
    ? Math.max(0, Math.min(selectedLayerIndex, activeLayers.length - 1))
    : Math.max(0, Math.min(internalIndex, activeLayers.length - 1));

  const currentLayer = activeLayers[activeIndex] || activeLayers[0];

  const handleSelectLayer = (idx: number) => {
    setInternalIndex(idx);
    onSelectLayerIndex?.(idx);
  };

  // Isometric Geometry Dimensions
  const originX = 450;
  const originY = cameraPreset === 'steep' ? 120 : cameraPreset === 'cross_section' ? 140 : 155;
  const widthX = cameraPreset === 'cross_section' ? 360 : 310;
  const depthX = cameraPreset === 'cross_section' ? 160 : 310;

  const leftAngleRad = (cameraPreset === 'steep' ? 24 : 30) * (Math.PI / 180);
  const rightAngleRad = (cameraPreset === 'steep' ? 24 : 30) * (Math.PI / 180);

  // Top Face Corner Vectors
  const pFront = { x: originX, y: originY };
  const pLeft = {
    x: originX - widthX * Math.cos(leftAngleRad),
    y: originY - widthX * Math.sin(leftAngleRad),
  };
  const pRight = {
    x: originX + depthX * Math.cos(rightAngleRad),
    y: originY - depthX * Math.sin(rightAngleRad),
  };
  const pBack = {
    x: originX - widthX * Math.cos(leftAngleRad) + depthX * Math.cos(rightAngleRad),
    y: originY - widthX * Math.sin(leftAngleRad) - depthX * Math.sin(rightAngleRad),
  };

  // Proportional thickness calculation matching actual borehole depths
  const totalModelHeightPx = 360;
  const totalThicknessM = activeLayers.reduce((acc, l) => acc + (l.thicknessMm / 1000), 0) || 8.0;

  let currentYOffset = 0;
  const layerGeometries = activeLayers.map((layer, index) => {
    const layerThicknessM = layer.thicknessMm / 1000;
    const rawH = (layerThicknessM / totalThicknessM) * totalModelHeightPx;
    // ensure each layer has a distinct visible slab height: min 32px, max 95px
    const slabHeight = Math.max(32, Math.min(95, rawH));
    const topY = currentYOffset;
    const bottomY = topY + slabHeight;
    currentYOffset = bottomY;

    // Explode vertical shift
    const explodeY = index * explodeFactor * 16;

    return {
      layer,
      index,
      topY,
      bottomY,
      slabHeight,
      explodeY,
      isTarget: index === activeIndex,
    };
  });

  // Calculate accurate Water table pixel Y based on parsed report water table depth
  const waterTableDepth = report?.water_table_depth_m;
  let waterTablePixelY = 180;
  if (waterTableDepth != null && rawLayers.length > 0) {
    const maxDepth = rawLayers[rawLayers.length - 1].bottom_m || 8.0;
    const clampedDepth = Math.max(0, Math.min(maxDepth, waterTableDepth));
    for (const geom of layerGeometries) {
      const l = geom.layer;
      if (clampedDepth >= l.top_m && clampedDepth <= l.bottom_m) {
        const ratio = l.thickness_m > 0 ? (clampedDepth - l.top_m) / l.thickness_m : 0.5;
        waterTablePixelY = geom.topY + ratio * geom.slabHeight;
        break;
      }
    }
  }

  return {
    report,
    activeProjectName,
    selectedLayerIndex,
    onSelectLayerIndex,
    onNavigateToFleet,
    onNavigateToStrataTab,
    uid,
    rawLayers,
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    explodeFactor,
    setExplodeFactor,
    internalIndex,
    setInternalIndex,
    cameraPreset,
    setCameraPreset,
    showWaterTable,
    setShowWaterTable,
    showMachineryOnSite,
    setShowMachineryOnSite,
    isFullscreen,
    setIsFullscreen,
    boreholeLayers,
    activeLayers,
    activeIndex,
    currentLayer,
    handleSelectLayer,
    originX,
    originY,
    widthX,
    depthX,
    leftAngleRad,
    rightAngleRad,
    pFront,
    pLeft,
    pRight,
    pBack,
    totalModelHeightPx,
    totalThicknessM,
    currentYOffset,
    layerGeometries,
    waterTableDepth,
    waterTablePixelY,
  };
};

export type CubeCtx = ReturnType<typeof useIsometricCubeModel>;
