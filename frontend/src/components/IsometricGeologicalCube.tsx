import React, { useState, useId, useEffect } from 'react';
import {
  Layers, Pickaxe, Drill, Hammer, Truck, Waves,
  Sparkles, Eye, Download, Info, Rotate3d, Maximize2,
  Minimize2, ChevronRight, ShieldAlert, CheckCircle2,
  Compass, Ruler, Activity as ActivityIcon, Sliders, ExternalLink,
  Columns, Box, Grid3X3, ArrowUpDown
} from 'lucide-react';
import { StrataLayer, GeotechnicalReport } from '../types';
import { STRATA_THEMES, getStrataTheme, getExcavabilityBadge, VEHICLE_IMAGE_MAP } from '../pages/GeotechnicalReportPage';

export interface PavementLayerDefinition {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  thicknessMm: number;
  thicknessDisplay: string;
  depthRangeDisplay: string;
  materialKey: string;
  fillLeft: string;
  fillRight: string;
  fillTop?: string;
  strokeColor?: string;
  top_m: number;
  bottom_m: number;
  thickness_m: number;
  patternType: 'asphalt' | 'binder' | 'base_aggregate' | 'subbase_gravel' | 'geotextile' | 'compacted_subgrade' | 'timber_bedding' | 'bedrock_boulders';
  excavabilityClassNum: number;
  ucsMpa?: number;
  rqdPct?: number;
  sptN?: number;
  cbrPct?: number;
  bulkingFactor: number;
  description: string;
  recommendedMachinery: string[];
  specs: {
    compaction: string;
    permeability: string;
    lifespan: string;
    primaryRole: string;
  };
}

export interface Strata3DShading {
  leftTone: string;
  leftToneEnd: string;
  rightTone: string;
  topTone: string;
  stroke: string;
  textBadge: string;
  patternType: 'asphalt' | 'binder' | 'base_aggregate' | 'subbase_gravel' | 'geotextile' | 'compacted_subgrade' | 'timber_bedding' | 'bedrock_boulders';
}

export const getStrata3DShading = (materialKey?: string, isRock?: boolean, ucs?: number): Strata3DShading => {
  const k = (materialKey || '').toLowerCase();

  if (k.includes('topsoil')) {
    return {
      leftTone: '#10b981',
      leftToneEnd: '#059669',
      rightTone: '#064e3b',
      topTone: '#34d399',
      stroke: '#6ee7b7',
      textBadge: 'text-emerald-300',
      patternType: 'asphalt',
    };
  }
  if (k.includes('fill') || k.includes('debris') || k.includes('made')) {
    return {
      leftTone: '#71717a',
      leftToneEnd: '#52525b',
      rightTone: '#27272a',
      topTone: '#a1a1aa',
      stroke: '#d4d4d8',
      textBadge: 'text-zinc-300',
      patternType: 'asphalt',
    };
  }
  if (k.includes('sandstone')) {
    return {
      leftTone: '#f59e0b',
      leftToneEnd: '#d97706',
      rightTone: '#78350f',
      topTone: '#fbbf24',
      stroke: '#fde68a',
      textBadge: 'text-amber-200',
      patternType: 'base_aggregate',
    };
  }
  if (k.includes('sand') || k.includes('silt')) {
    return {
      leftTone: '#eab308',
      leftToneEnd: '#ca8a04',
      rightTone: '#713f12',
      topTone: '#fde047',
      stroke: '#fef08a',
      textBadge: 'text-yellow-200',
      patternType: 'binder',
    };
  }
  if (k.includes('black_cotton')) {
    return {
      leftTone: '#44403c',
      leftToneEnd: '#292524',
      rightTone: '#1c1917',
      topTone: '#78716c',
      stroke: '#a8a29e',
      textBadge: 'text-stone-300',
      patternType: 'compacted_subgrade',
    };
  }
  if (k.includes('clay')) {
    return {
      leftTone: '#b45309',
      leftToneEnd: '#9a3412',
      rightTone: '#431407',
      topTone: '#d97706',
      stroke: '#fed7aa',
      textBadge: 'text-orange-200',
      patternType: 'compacted_subgrade',
    };
  }
  if (k.includes('murrum')) {
    return {
      leftTone: '#ea580c',
      leftToneEnd: '#c2410c',
      rightTone: '#7c2d12',
      topTone: '#f97316',
      stroke: '#fdba74',
      textBadge: 'text-orange-200',
      patternType: 'subbase_gravel',
    };
  }
  if (k.includes('laterite')) {
    return {
      leftTone: '#dc2626',
      leftToneEnd: '#b91c1c',
      rightTone: '#7f1d1d',
      topTone: '#ef4444',
      stroke: '#fca5a5',
      textBadge: 'text-red-200',
      patternType: 'subbase_gravel',
    };
  }
  if (k.includes('gravel') || k.includes('pebble')) {
    return {
      leftTone: '#64748b',
      leftToneEnd: '#475569',
      rightTone: '#1e293b',
      topTone: '#94a3b8',
      stroke: '#cbd5e1',
      textBadge: 'text-slate-300',
      patternType: 'subbase_gravel',
    };
  }
  if (k.includes('weathered') || k.includes('sdr')) {
    return {
      leftTone: '#ca8a04',
      leftToneEnd: '#a16207',
      rightTone: '#451a03',
      topTone: '#eab308',
      stroke: '#fde047',
      textBadge: 'text-yellow-300',
      patternType: 'base_aggregate',
    };
  }
  if (k.includes('basalt')) {
    return {
      leftTone: '#0891b2',
      leftToneEnd: '#0e7490',
      rightTone: '#083344',
      topTone: '#22d3ee',
      stroke: '#67e8f9',
      textBadge: 'text-cyan-300',
      patternType: 'bedrock_boulders',
    };
  }
  if (k.includes('granite')) {
    return {
      leftTone: '#9333ea',
      leftToneEnd: '#7e22ce',
      rightTone: '#3b0764',
      topTone: '#c084fc',
      stroke: '#e9d5ff',
      textBadge: 'text-purple-300',
      patternType: 'bedrock_boulders',
    };
  }
  if (k.includes('gneiss')) {
    return {
      leftTone: '#4f46e5',
      leftToneEnd: '#4338ca',
      rightTone: '#1e1b4b',
      topTone: '#818cf8',
      stroke: '#c7d2fe',
      textBadge: 'text-indigo-300',
      patternType: 'bedrock_boulders',
    };
  }
  if (k.includes('quartzite')) {
    return {
      leftTone: '#06b6d4',
      leftToneEnd: '#0891b2',
      rightTone: '#164e63',
      topTone: '#67e8f9',
      stroke: '#a5f3fc',
      textBadge: 'text-cyan-300',
      patternType: 'bedrock_boulders',
    };
  }
  if (k.includes('boulder')) {
    return {
      leftTone: '#78716c',
      leftToneEnd: '#57534e',
      rightTone: '#292524',
      topTone: '#a8a29e',
      stroke: '#e7e5e4',
      textBadge: 'text-stone-300',
      patternType: 'subbase_gravel',
    };
  }
  if (isRock || (ucs && ucs > 25)) {
    return {
      leftTone: '#2563eb',
      leftToneEnd: '#1d4ed8',
      rightTone: '#172554',
      topTone: '#60a5fa',
      stroke: '#93c5fd',
      textBadge: 'text-blue-300',
      patternType: 'bedrock_boulders',
    };
  }
  return {
    leftTone: '#854d0e',
    leftToneEnd: '#713f12',
    rightTone: '#451a03',
    topTone: '#a16207',
    stroke: '#fef08a',
    textBadge: 'text-amber-300',
    patternType: 'compacted_subgrade',
  };
};

const getRecommendedMachineryForClass = (classNum: number): string[] => {
  switch (classNum) {
    case 1:
      return ['backhoe', 'excavator_20t', 'tipper'];
    case 2:
      return ['excavator_20t', 'backhoe', 'tipper'];
    case 3:
      return ['excavator_ripper', 'excavator_20t', 'breaker', 'tipper'];
    case 4:
      return ['breaker', 'excavator_rock', 'compressor', 'tipper'];
    case 5:
    default:
      return ['drill_rig', 'heavy_breaker', 'compressor', 'excavator_rock', 'tipper'];
  }
};

// 8 Engineering layers for optional reference highway stack
export const REFERENCE_HIGHWAY_LAYERS: PavementLayerDefinition[] = [
  {
    id: 'layer-wearing',
    name: 'Asphalt Concrete Wearing Course',
    subtitle: 'Bituminous Surface Friction Layer',
    category: 'Pavement Surface',
    thicknessMm: 50,
    thicknessDisplay: '50 mm (0.05 m)',
    depthRangeDisplay: '0.00 m - 0.05 m EGL',
    materialKey: 'sand',
    fillLeft: '#1e293b',
    fillRight: '#0f172a',
    top_m: 0.0,
    bottom_m: 0.05,
    thickness_m: 0.05,
    patternType: 'asphalt',
    excavabilityClassNum: 1,
    ucsMpa: 4.5,
    cbrPct: 95,
    bulkingFactor: 1.15,
    description: 'High-density asphaltic concrete formulated with modified polymer bitumen (PMB-40) and 13.2mm basalt aggregate for skid resistance and waterproofing.',
    recommendedMachinery: ['tipper', 'plate_compactor'],
    specs: {
      compaction: '98% Marshall Density',
      permeability: 'Impermeable (< 10⁻⁷ m/s)',
      lifespan: '12-15 Years',
      primaryRole: 'Traffic contact, tire friction & rainwater shedding',
    },
  },
  {
    id: 'layer-binder',
    name: 'Dense Bituminous Macadam (DBM)',
    subtitle: 'High-Modulus Binder Course',
    category: 'Asphalt Base',
    thicknessMm: 80,
    thicknessDisplay: '80 mm (0.08 m)',
    depthRangeDisplay: '0.05 m - 0.13 m EGL',
    materialKey: 'fill',
    fillLeft: '#78350f',
    fillRight: '#572205',
    top_m: 0.05,
    bottom_m: 0.13,
    thickness_m: 0.08,
    patternType: 'binder',
    excavabilityClassNum: 2,
    ucsMpa: 8.0,
    cbrPct: 90,
    bulkingFactor: 1.20,
    description: 'Coarse structural asphalt layer with 26.5mm graded crushed stone designed to resist heavy axle load rutting and bottom-up fatigue cracking.',
    recommendedMachinery: ['tipper', 'backhoe'],
    specs: {
      compaction: '97.5% Marshall Density',
      permeability: 'Low Permeability',
      lifespan: '20+ Years',
      primaryRole: 'Axle load dissipation & fatigue resistance',
    },
  },
  {
    id: 'layer-base',
    name: 'Wet Mix Macadam (WMM) Base',
    subtitle: 'Interlocked Crushed Stone Base',
    category: 'Granular Base',
    thicknessMm: 250,
    thicknessDisplay: '250 mm (0.25 m)',
    depthRangeDisplay: '0.13 m - 0.38 m EGL',
    materialKey: 'gravel',
    fillLeft: '#64748b',
    fillRight: '#475569',
    top_m: 0.13,
    bottom_m: 0.38,
    thickness_m: 0.25,
    patternType: 'base_aggregate',
    excavabilityClassNum: 2,
    cbrPct: 85,
    bulkingFactor: 1.25,
    description: 'Dense mechanically interlocked angular crushed granite/basalt rock (45mm down) with optimum moisture content rolled to refusal.',
    recommendedMachinery: ['backhoe', 'plate_compactor', 'tipper'],
    specs: {
      compaction: '98% Modified Proctor (MDD)',
      permeability: '10⁻⁴ m/s (Semi-free draining)',
      lifespan: '30+ Years',
      primaryRole: 'Primary bending stiffness & load distribution',
    },
  },
  {
    id: 'layer-subbase',
    name: 'Granular Sub-Base (GSB) Course',
    subtitle: 'Coarse Gravel & Rounded Cobbles',
    category: 'Sub-Base',
    thicknessMm: 300,
    thicknessDisplay: '300 mm (0.30 m)',
    depthRangeDisplay: '0.38 m - 0.68 m EGL',
    materialKey: 'sandstone',
    fillLeft: '#a8a29e',
    fillRight: '#78716c',
    top_m: 0.38,
    bottom_m: 0.68,
    thickness_m: 0.30,
    patternType: 'subbase_gravel',
    excavabilityClassNum: 2,
    cbrPct: 35,
    bulkingFactor: 1.30,
    description: 'Natural river gravel, crushed slag, and coarse stone aggregates forming an open-graded drainage blanket to prevent capillary rise.',
    recommendedMachinery: ['excavator_20t', 'backhoe', 'tipper'],
    specs: {
      compaction: '95% Modified Proctor',
      permeability: '10⁻² m/s (Free draining layer)',
      lifespan: 'Design Life of Highway',
      primaryRole: 'Capillary cutoff & frost/drainage protection',
    },
  },
  {
    id: 'layer-geotextile',
    name: 'Engineered Geotextile & Geogrid Membrane',
    subtitle: 'High-Tensile Biaxial Reinforcement & Filtration',
    category: 'Geosynthetic Layer',
    thicknessMm: 60,
    thicknessDisplay: 'Structural Grid & Membrane (Cyan)',
    depthRangeDisplay: '0.68 m - 0.74 m EGL',
    materialKey: 'quartzite',
    fillLeft: '#0284c7',
    fillRight: '#0369a1',
    top_m: 0.68,
    bottom_m: 0.74,
    thickness_m: 0.06,
    patternType: 'geotextile',
    excavabilityClassNum: 1,
    cbrPct: 150,
    bulkingFactor: 1.0,
    description: 'High-modulus polypropylene biaxial geogrid bonded to a non-woven continuous needle-punched geotextile separator. Prevents subgrade stone migration.',
    recommendedMachinery: ['backhoe'],
    specs: {
      compaction: 'Mechanical Anchor Tensioning',
      permeability: 'Apparent Opening Size 0.15mm',
      lifespan: '100+ Years',
      primaryRole: 'Tensile interlock, stone migration prevention & shear stabilization',
    },
  },
  {
    id: 'layer-subgrade',
    name: 'Stabilized Compacted Subgrade',
    subtitle: 'Dense Cohesive Soil Matrix (500mm)',
    category: 'Earthwork Formation',
    thicknessMm: 450,
    thicknessDisplay: '450 mm (0.45 m)',
    depthRangeDisplay: '0.74 m - 1.19 m EGL',
    materialKey: 'clay',
    fillLeft: '#451a03',
    fillRight: '#290e02',
    top_m: 0.74,
    bottom_m: 1.19,
    thickness_m: 0.45,
    patternType: 'compacted_subgrade',
    excavabilityClassNum: 2,
    cbrPct: 10,
    bulkingFactor: 1.25,
    description: 'Selected cohesive soil / sandy clay treated with 3% lime/cement stabilization, compacted in 150mm layers at optimum moisture content.',
    recommendedMachinery: ['excavator_20t', 'backhoe', 'plate_compactor'],
    specs: {
      compaction: '97% Heavy Proctor',
      permeability: 'Low (10⁻⁸ m/s)',
      lifespan: 'Permanent Formation',
      primaryRole: 'Founding platform for pavement structure',
    },
  },
  {
    id: 'layer-bedding',
    name: 'Engineered Geocell / Timber Crib Bedding',
    subtitle: 'Striated Soil Reinforcement Retaining Grid',
    category: 'Structural Retaining Base',
    thicknessMm: 350,
    thicknessDisplay: '350 mm (0.35 m)',
    depthRangeDisplay: '1.19 m - 1.54 m EGL',
    materialKey: 'murrum',
    fillLeft: '#b45309',
    fillRight: '#78350f',
    top_m: 1.19,
    bottom_m: 1.54,
    thickness_m: 0.35,
    patternType: 'timber_bedding',
    excavabilityClassNum: 3,
    cbrPct: 40,
    bulkingFactor: 1.35,
    description: 'Cellular confinement system filled with high-friction angular ballast, providing horizontal shear interlock and differential settlement buffering.',
    recommendedMachinery: ['excavator_20t', 'breaker'],
    specs: {
      compaction: 'Vibratory Tamp & Anchor Pins',
      permeability: '10⁻³ m/s',
      lifespan: '75+ Years',
      primaryRole: 'Horizontal lateral confinement & load spreading',
    },
  },
  {
    id: 'layer-bedrock',
    name: 'Competent Foundation Bedrock & Boulder Strata',
    subtitle: 'Massive Basalt / Granite Geological Horizon',
    category: 'Natural Bedrock Foundation',
    thicknessMm: 800,
    thicknessDisplay: 'Deep Foundation (> 2.0 m)',
    depthRangeDisplay: '1.54 m → Bedrock Refusal',
    materialKey: 'basalt',
    fillLeft: '#1e293b',
    fillRight: '#090d16',
    top_m: 1.54,
    bottom_m: 2.34,
    thickness_m: 0.80,
    patternType: 'bedrock_boulders',
    excavabilityClassNum: 5,
    ucsMpa: 125.0,
    cbrPct: 200,
    bulkingFactor: 1.65,
    description: 'Fresh to slightly weathered crystalline igneous bedrock (Class V Excavability). Unconfined compressive strength 110-140 MPa with high bearing capacity.',
    recommendedMachinery: ['excavator_20t', 'breaker', 'drill_rig', 'compressor'],
    specs: {
      compaction: 'Natural In-Situ Rock',
      permeability: 'Negligible (Fracture flow only)',
      lifespan: 'Infinite Geological Substratum',
      primaryRole: 'Ultimate geotechnical bearing strata (> 1000 kPa)',
    },
  },
];

export interface IsometricGeologicalCubeProps {
  report?: GeotechnicalReport | null;
  activeProjectName?: string;
  selectedLayerIndex?: number | null;
  onSelectLayerIndex?: (index: number) => void;
  onNavigateToFleet?: () => void;
  onNavigateToStrataTab?: () => void;
}

export const IsometricGeologicalCube: React.FC<IsometricGeologicalCubeProps> = ({
  report,
  activeProjectName,
  selectedLayerIndex,
  onSelectLayerIndex,
  onNavigateToFleet,
  onNavigateToStrataTab,
}) => {
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

  return (
    <div className={`bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl flex flex-col' : 'relative'}`}>
      {/* Top Visualizer Header Bar */}
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
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
            title="Toggle Groundwater Table plane"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
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

      {/* Main Visualizer Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-hidden">
        {/* 3D Isometric Viewport */}
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
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.65" />
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
                          <rect x="-14" y="-4" width="14" height="9" rx="1.5" fill="#38bdf8" opacity="0.75" />
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
                      <g stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.4">
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
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="6,4"
                          className="animate-pulse"
                        />

                        {/* Ripples */}
                        <path
                          d={`M${wtL.x},${wtL.y} Q${(wtL.x + wtF.x) / 2},${(wtL.y + wtF.y) / 2 - 4} ${wtF.x},${wtF.y} Q${(wtF.x + wtR.x) / 2},${(wtR.y + wtR.y) / 2 - 4} ${wtR.x},${wtR.y}`}
                          fill="none"
                          stroke="#e0f2fe"
                          strokeWidth="1.5"
                        />

                        {/* GWT Callout Badge */}
                        <g transform={`translate(${wtR.x + 10}, ${wtR.y - 10})`}>
                          <rect x="0" y="0" width="145" height="22" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1" />
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

        {/* SIDE-BY-SIDE BOREHOLE STRATA COLUMN (Visible in Dual View Mode) */}
        {layoutMode === 'dual' && (
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
        )}

        {/* Right Engineering Detail HUD & Machinery Specifications */}
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
                    src: '/vehicles/backhoe.jpg',
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
      </div>
    </div>
  );
};
