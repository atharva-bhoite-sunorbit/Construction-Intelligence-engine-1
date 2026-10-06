import React, { useState, useId } from 'react';
import {
  Layers, Pickaxe, Drill, Hammer, Truck, Waves,
  Sparkles, Eye, Download, Info, Rotate3d, Maximize2,
  Minimize2, ChevronRight, ShieldAlert, CheckCircle2,
  Compass, Ruler, Activity as ActivityIcon, Sliders, ExternalLink
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
  patternType: 'asphalt' | 'binder' | 'base_aggregate' | 'subbase_gravel' | 'geotextile' | 'compacted_subgrade' | 'timber_bedding' | 'bedrock_boulders';
  excavabilityClassNum: number;
  ucsMpa?: number;
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

// 8 Engineering layers matching the user's reference cutaway image exactly
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

interface IsometricGeologicalCubeProps {
  report?: GeotechnicalReport | null;
  activeProjectName?: string;
  onNavigateToFleet?: () => void;
}

export const IsometricGeologicalCube: React.FC<IsometricGeologicalCubeProps> = ({
  report,
  activeProjectName,
  onNavigateToFleet,
}) => {
  const uid = useId();
  // View mode: 'pavement' (matching reference photo) or 'borehole' (dynamic from loaded report)
  const [viewMode, setViewMode] = useState<'pavement' | 'borehole'>('pavement');
  // Exploded spacing: 0 to 45px vertical separation
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  // Selected layer ID/Index
  const [selectedLayerId, setSelectedLayerId] = useState<string>('layer-geotextile');
  // Camera perspective preset
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'steep' | 'cross_section'>('isometric');
  // Water table plane toggle
  const [showWaterTable, setShowWaterTable] = useState<boolean>(true);
  // Construction machinery simulation toggle
  const [showMachineryOnSite, setShowMachineryOnSite] = useState<boolean>(true);
  // Fullscreen view toggle
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Generate dynamic borehole layers if report is provided and in borehole mode
  const rawLayers = report?.strata_layers || [];
  const boreholeLayers: PavementLayerDefinition[] = rawLayers.map((l, idx) => {
    const theme = getStrataTheme(l.material_key);
    let pattern: PavementLayerDefinition['patternType'] = 'compacted_subgrade';
    if (l.is_rock && (l.ucs_mpa || 0) > 40) pattern = 'bedrock_boulders';
    else if (l.is_rock) pattern = 'base_aggregate';
    else if (l.material_key.includes('gravel')) pattern = 'subbase_gravel';
    else if (l.material_key.includes('sand')) pattern = 'binder';
    else if (l.material_key.includes('fill') || l.material_key.includes('topsoil')) pattern = 'asphalt';

    return {
      id: `borehole-${idx}`,
      name: l.material,
      subtitle: `${theme.categoryLabel} • ${l.weathering_grade || 'Stratum ' + (idx + 1)}`,
      category: l.category || (l.is_rock ? 'Rock Bedrock' : 'Overburden Soil'),
      thicknessMm: Math.round(l.thickness_m * 1000),
      thicknessDisplay: `${l.thickness_m.toFixed(2)} m thick`,
      depthRangeDisplay: `${l.top_m.toFixed(1)}m – ${l.bottom_m.toFixed(1)}m EGL`,
      materialKey: l.material_key,
      fillLeft: theme.accentColor,
      fillRight: '#0f172a',
      patternType: pattern,
      excavabilityClassNum: l.excavability_class_num,
      ucsMpa: l.ucs_mpa,
      bulkingFactor: l.bulking_factor || 1.3,
      description: l.report_description || l.description || 'Geotechnical subsurface layer identified from borehole core investigation.',
      recommendedMachinery: l.excavability_class_num >= 4 ? ['breaker', 'drill_rig', 'excavator_20t', 'tipper'] : ['backhoe', 'excavator_20t', 'tipper'],
      specs: {
        compaction: l.spt_n ? `SPT N = ${l.spt_n}` : 'N/A',
        permeability: l.below_water_table ? 'Saturated Ingress' : 'Dry/Damp',
        lifespan: 'In-Situ Horizon',
        primaryRole: l.excavation_method || 'Subsurface formation',
      },
    };
  });

  const activeLayers = viewMode === 'pavement' || boreholeLayers.length === 0
    ? REFERENCE_HIGHWAY_LAYERS
    : boreholeLayers;

  const currentLayer = activeLayers.find((l) => l.id === selectedLayerId) || activeLayers[0];

  // Isometric Geometry Dimensions
  // SVG Canvas viewport: 900 x 780
  const originX = 450;
  const originY = cameraPreset === 'steep' ? 120 : cameraPreset === 'cross_section' ? 140 : 155;
  const widthX = cameraPreset === 'cross_section' ? 360 : 310; // Left face projection
  const depthX = cameraPreset === 'cross_section' ? 160 : 310; // Right face projection

  // Angles
  const leftAngleRad = (cameraPreset === 'steep' ? 24 : 30) * (Math.PI / 180);
  const rightAngleRad = (cameraPreset === 'steep' ? 24 : 30) * (Math.PI / 180);

  // Corner vectors for Top Face:
  // Front Center point:
  const pFront = { x: originX, y: originY };
  // Left point:
  const pLeft = {
    x: originX - widthX * Math.cos(leftAngleRad),
    y: originY - widthX * Math.sin(leftAngleRad),
  };
  // Right point:
  const pRight = {
    x: originX + depthX * Math.cos(rightAngleRad),
    y: originY - depthX * Math.sin(rightAngleRad),
  };
  // Back point:
  const pBack = {
    x: originX - widthX * Math.cos(leftAngleRad) + depthX * Math.cos(rightAngleRad),
    y: originY - widthX * Math.sin(leftAngleRad) - depthX * Math.sin(rightAngleRad),
  };

  // Calculate cumulative heights for each layer in SVG pixels
  const totalModelHeightPx = 360;
  const totalThickness = activeLayers.reduce((acc, l) => acc + Math.max(l.thicknessMm, 40), 0);

  let currentYOffset = 0;
  const layerGeometries = activeLayers.map((layer, index) => {
    const rawH = (Math.max(layer.thicknessMm, 40) / totalThickness) * totalModelHeightPx;
    // ensure each layer has a distinct visible slab height
    const slabHeight = Math.max(28, Math.min(75, rawH));
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
      isTarget: layer.id === currentLayer.id,
    };
  });

  // Water table depth (approx 45% down or custom)
  const waterTablePixelY = (activeLayers.length >= 5 ? layerGeometries[4].topY : 180);

  return (
    <div className={`bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl flex flex-col' : 'relative'}`}>
      {/* Visualizer Top Bar & Control Ribbon */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
            <Layers className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                3D Isometric Geological & Subsurface Cutaway
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                BIM / Geo-Stratum 3D
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive 3D structural cross-section showing road pavement courses, geotextile grid, subgrade, and foundation bedrock.
            </p>
          </div>
        </div>

        {/* View Mode & Preset Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shadow-inner text-xs">
            <button
              onClick={() => {
                setViewMode('pavement');
                setSelectedLayerId(REFERENCE_HIGHWAY_LAYERS[4].id);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'pavement'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Highway Pavement Block
            </button>
            <button
              onClick={() => {
                setViewMode('borehole');
                if (boreholeLayers.length > 0) setSelectedLayerId(boreholeLayers[0].id);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'borehole'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Drill className="w-3.5 h-3.5" />
              Borehole Core Stratum ({boreholeLayers.length > 0 ? boreholeLayers.length : 'Live'})
            </button>
          </div>

          {/* Explode 3D Separation Slider */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Explode 3D:</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
              aria-label="Explode 3D layers separation"
              className="w-24 accent-amber-400 cursor-pointer"
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
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                cameraPreset === 'isometric' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Iso 30°
            </button>
            <button
              onClick={() => setCameraPreset('steep')}
              title="High angle overview"
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                cameraPreset === 'steep' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Top-Down
            </button>
            <button
              onClick={() => setCameraPreset('cross_section')}
              title="Front Cutaway focus"
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                cameraPreset === 'cross_section' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cutaway Cut
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

      {/* Main Visualizer Body: Left 3D Viewport + Right Engineering Detail HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-hidden">
        {/* 3D Isometric Viewport */}
        <div className="lg:col-span-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex flex-col items-center justify-center relative select-none overflow-hidden min-h-[540px]">
          {/* Subtle Isometric Grid Background Lines */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 30%, #38bdf8 0%, transparent 60%), radial-gradient(#334155 1px, transparent 1px)`,
              backgroundSize: '100% 100%, 28px 28px',
            }}
          />

          {/* Atmospheric Road Background Silhouette & Machinery Context */}
          <div className="absolute top-2 left-6 right-6 flex items-center justify-between text-[11px] text-slate-500 pointer-events-none z-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-slate-400 uppercase tracking-wider">
                LIVE 3D STRATUM MODEL • {activeLayers.length} DISCRETE LAYERS
              </span>
            </div>
            <div className="font-mono text-slate-400">
              EGL 0.00m → Founding Bedrock Refusal
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
                {/* Asphalt texture pattern */}
                <pattern id={`${uid}-pat-asphalt`} width="16" height="16" patternUnits="userSpaceOnUse">
                  <rect width="16" height="16" fill="#18181b" />
                  <circle cx="2" cy="3" r="1" fill="#3f3f46" />
                  <circle cx="10" cy="5" r="1.5" fill="#27272a" />
                  <circle cx="6" cy="11" r="1" fill="#52525b" />
                  <circle cx="14" cy="13" r="1.2" fill="#3f3f46" />
                </pattern>

                {/* Binder course pattern */}
                <pattern id={`${uid}-pat-binder`} width="20" height="20" patternUnits="userSpaceOnUse">
                  <rect width="20" height="20" fill="#78350f" />
                  <polygon points="3,3 7,2 6,8 2,6" fill="#b45309" />
                  <polygon points="12,6 17,8 15,14 10,11" fill="#92400e" />
                  <polygon points="5,14 8,18 3,19" fill="#d97706" />
                  <circle cx="17" cy="17" r="2" fill="#451a03" />
                </pattern>

                {/* Crushed aggregate base pattern */}
                <pattern id={`${uid}-pat-aggregate`} width="24" height="24" patternUnits="userSpaceOnUse">
                  <rect width="24" height="24" fill="#475569" />
                  <polygon points="4,4 10,2 8,10 2,8" fill="#94a3b8" />
                  <polygon points="14,3 21,7 18,14 12,10" fill="#64748b" />
                  <polygon points="5,15 11,13 13,21 3,20" fill="#cbd5e1" />
                  <polygon points="16,16 22,18 20,23 15,21" fill="#334155" />
                </pattern>

                {/* Granular subbase cobbles pattern */}
                <pattern id={`${uid}-pat-subbase`} width="28" height="28" patternUnits="userSpaceOnUse">
                  <rect width="28" height="28" fill="#78716c" />
                  <ellipse cx="6" cy="7" rx="5" ry="4" fill="#a8a29e" />
                  <ellipse cx="19" cy="8" rx="6" ry="5" fill="#57534e" />
                  <ellipse cx="10" cy="20" rx="7" ry="5" fill="#d6d3d1" />
                  <ellipse cx="23" cy="21" rx="4" ry="4" fill="#44403c" />
                </pattern>

                {/* Geotextile cyan engineered grid pattern */}
                <pattern id={`${uid}-pat-geotextile`} width="18" height="14" patternUnits="userSpaceOnUse">
                  <rect width="18" height="14" fill="#0284c7" />
                  <line x1="0" y1="0" x2="18" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="0" y1="7" x2="18" y2="7" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="2,2" />
                  <line x1="0" y1="0" x2="0" y2="14" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="9" y1="0" x2="9" y2="14" stroke="#7dd3fc" strokeWidth="1" />
                  {/* Subtle brick interlock */}
                  <rect x="2" y="2" width="5" height="3" fill="#0369a1" opacity="0.6" />
                  <rect x="11" y="9" width="5" height="3" fill="#0c4a6e" opacity="0.6" />
                </pattern>

                {/* Compacted subgrade clay pattern */}
                <pattern id={`${uid}-pat-subgrade`} width="30" height="20" patternUnits="userSpaceOnUse">
                  <rect width="30" height="20" fill="#3f1f0a" />
                  <line x1="0" y1="5" x2="30" y2="5" stroke="#78350f" strokeWidth="1" strokeDasharray="8,4" />
                  <line x1="0" y1="12" x2="30" y2="12" stroke="#261005" strokeWidth="1.5" />
                  <line x1="0" y1="18" x2="30" y2="18" stroke="#54240a" strokeWidth="0.8" strokeDasharray="4,6" />
                  <circle cx="7" cy="8" r="1.5" fill="#92400e" />
                  <circle cx="22" cy="15" r="1.2" fill="#78350f" />
                </pattern>

                {/* Timber cribbing / geocell pattern */}
                <pattern id={`${uid}-pat-timber`} width="36" height="24" patternUnits="userSpaceOnUse">
                  <rect width="36" height="24" fill="#92400e" />
                  <rect x="0" y="0" width="36" height="11" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                  <rect x="0" y="12" width="36" height="12" fill="#a16207" stroke="#713f12" strokeWidth="1" />
                  <line x1="18" y1="0" x2="18" y2="11" stroke="#451a03" strokeWidth="1.5" />
                  <line x1="9" y1="12" x2="9" y2="24" stroke="#451a03" strokeWidth="1.5" />
                  <line x1="27" y1="12" x2="27" y2="24" stroke="#451a03" strokeWidth="1.5" />
                </pattern>

                {/* Bedrock boulders & fractured basalt pattern */}
                <pattern id={`${uid}-pat-bedrock`} width="48" height="40" patternUnits="userSpaceOnUse">
                  <rect width="48" height="40" fill="#090d16" />
                  {/* Joint planes and crack fissures */}
                  <path d="M0,8 L18,12 L34,6 L48,14" stroke="#1e293b" strokeWidth="2" fill="none" />
                  <path d="M12,11 L16,28 L32,32" stroke="#334155" strokeWidth="1.5" fill="none" />
                  <path d="M28,6 L38,20 L48,22" stroke="#0f172a" strokeWidth="2.5" fill="none" />
                  {/* Embedded boulder shapes */}
                  <polygon points="4,18 12,16 14,24 8,26" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <polygon points="26,14 36,12 38,22 28,24" fill="#334155" stroke="#475569" strokeWidth="1" />
                  <polygon points="16,28 26,30 24,38 12,36" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                </pattern>

                {/* Dynamic Lighting Linear Gradients */}
                <linearGradient id={`${uid}-grad-road`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#27272a" />
                  <stop offset="50%" stopColor="#18181b" />
                  <stop offset="100%" stopColor="#09090b" />
                </linearGradient>

                <linearGradient id={`${uid}-grad-highlight`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.2" />
                </linearGradient>

                <linearGradient id={`${uid}-grad-watertable`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.65" />
                </linearGradient>
              </defs>

              {/* TOP ROADSURFACING & PAVEMENT PERSPECTIVE */}
              {(() => {
                const topLayerGeom = layerGeometries[0];
                const topExplode = topLayerGeom?.explodeY || 0;
                const pB = { x: pBack.x, y: pBack.y + topExplode };
                const pR = { x: pRight.x, y: pRight.y + topExplode };
                const pF = { x: pFront.x, y: pFront.y + topExplode };
                const pL = { x: pLeft.x, y: pLeft.y + topExplode };

                // Highway center line coordinates (from midpoint of Left-Back to Front-Right, or along the diagonal)
                // In reference photo: Road runs from back edge to front edge!
                const roadBackMid = {
                  x: (pB.x + pL.x) / 2,
                  y: (pB.y + pL.y) / 2,
                };
                const roadFrontMid = {
                  x: (pR.x + pF.x) / 2,
                  y: (pR.y + pF.y) / 2,
                };

                // Or along the centerline from pB to pF:
                const centerLineStart = pB;
                const centerLineEnd = pF;

                return (
                  <g id="top-highway-surface" className="cursor-pointer" onClick={() => setSelectedLayerId(topLayerGeom?.layer.id || '')}>
                    {/* Main Top Isometric Polygon (Road Pavement) */}
                    <polygon
                      points={`${pB.x},${pB.y} ${pR.x},${pR.y} ${pF.x},${pF.y} ${pL.x},${pL.y}`}
                      fill={`url(#${uid}-grad-road)`}
                      stroke="#52525b"
                      strokeWidth="1.5"
                    />

                    {/* Asphalt Texture Overlay */}
                    <polygon
                      points={`${pB.x},${pB.y} ${pR.x},${pR.y} ${pF.x},${pF.y} ${pL.x},${pL.y}`}
                      fill={`url(#${uid}-pat-asphalt)`}
                      opacity="0.75"
                    />

                    {/* Left Road Shoulder Boundary Strip */}
                    <line
                      x1={pL.x + (pB.x - pL.x) * 0.15}
                      y1={pL.y + (pB.y - pL.y) * 0.15}
                      x2={pF.x + (pR.x - pF.x) * 0.15}
                      y2={pF.y + (pR.y - pF.y) * 0.15}
                      stroke="#f1f5f9"
                      strokeWidth="2.5"
                      strokeDasharray="14,6"
                      opacity="0.85"
                    />

                    {/* Right Road Shoulder Boundary Strip */}
                    <line
                      x1={pB.x + (pR.x - pB.x) * 0.85}
                      y1={pB.y + (pR.y - pB.y) * 0.85}
                      x2={pL.x + (pF.x - pL.x) * 0.85}
                      y2={pL.y + (pF.y - pL.y) * 0.85}
                      stroke="#f1f5f9"
                      strokeWidth="2.5"
                      strokeDasharray="14,6"
                      opacity="0.85"
                    />

                    {/* Dual Solid Yellow Centerline Lines (Exact match to reference image!) */}
                    <g opacity="0.95">
                      {/* Left yellow line */}
                      <line
                        x1={centerLineStart.x - 3}
                        y1={centerLineStart.y}
                        x2={centerLineEnd.x - 3}
                        y2={centerLineEnd.y}
                        stroke="#facc15"
                        strokeWidth="3"
                      />
                      {/* Right yellow line */}
                      <line
                        x1={centerLineStart.x + 3}
                        y1={centerLineStart.y}
                        x2={centerLineEnd.x + 3}
                        y2={centerLineEnd.y}
                        stroke="#facc15"
                        strokeWidth="3"
                      />
                    </g>

                    {/* Road Surface Depth Perception Perspective Lines */}
                    <line
                      x1={pB.x}
                      y1={pB.y}
                      x2={pF.x}
                      y2={pF.y}
                      stroke="#ca8a04"
                      strokeWidth="1"
                      strokeDasharray="4,8"
                      opacity="0.4"
                    />

                    {/* Site machinery positioned on top if enabled */}
                    {showMachineryOnSite && (
                      <g transform={`translate(${centerLineStart.x + 30}, ${centerLineStart.y + 40}) scale(0.85)`}>
                        {/* Mini Excavator Graphic */}
                        <g className="filter drop-shadow-md">
                          {/* Machine tracks */}
                          <rect x="-24" y="8" width="48" height="9" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                          <circle cx="-16" cy="12" r="3" fill="#71717a" />
                          <circle cx="0" cy="12" r="3" fill="#71717a" />
                          <circle cx="16" cy="12" r="3" fill="#71717a" />
                          {/* Cabin & Body */}
                          <rect x="-18" y="-6" width="36" height="15" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                          <rect x="-14" y="-4" width="14" height="9" rx="1.5" fill="#38bdf8" opacity="0.75" />
                          {/* Boom & Arm */}
                          <path d="M12,-2 L32,-16 L48,-6 L56,4" stroke="#d97706" strokeWidth="4" strokeLinecap="round" fill="none" />
                          <polygon points="54,2 62,6 58,12 52,6" fill="#18181b" />
                        </g>
                        <text x="-12" y="28" fill="#fbbf24" fontSize="9" fontWeight="bold" fontFamily="monospace">
                          20T EXCAVATOR
                        </text>
                      </g>
                    )}

                    {/* Surface Elevation Marker */}
                    <g transform={`translate(${pB.x - 25}, ${pB.y - 15})`}>
                      <rect x="0" y="0" width="80" height="20" rx="4" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" opacity="0.9" />
                      <text x="40" y="14" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                        EGL ±0.00m
                      </text>
                    </g>
                  </g>
                );
              })()}

              {/* RENDER ALL GEOLOGICAL & PAVEMENT LAYERS (STACKED / EXPLODED) */}
              {layerGeometries.map(({ layer, index, topY, bottomY, slabHeight, explodeY, isTarget }) => {
                // Left Face 4 points:
                // Top-Left corner:
                const tl = { x: pLeft.x, y: pLeft.y + topY + explodeY };
                // Top-Front corner:
                const tf = { x: pFront.x, y: pFront.y + topY + explodeY };
                // Bottom-Front corner:
                const bf = { x: pFront.x, y: pFront.y + bottomY + explodeY };
                // Bottom-Left corner:
                const bl = { x: pLeft.x, y: pLeft.y + bottomY + explodeY };

                // Right Face 4 points:
                // Top-Front: tf
                // Top-Right:
                const tr = { x: pRight.x, y: pRight.y + topY + explodeY };
                // Bottom-Right:
                const br = { x: pRight.x, y: pRight.y + bottomY + explodeY };
                // Bottom-Front: bf

                // Top Exposed Face (visible when exploded or for layer > 0)
                const tb = { x: pBack.x, y: pBack.y + topY + explodeY };

                // Pattern Fill ID according to patternType
                let patId = `${uid}-pat-asphalt`;
                if (layer.patternType === 'binder') patId = `${uid}-pat-binder`;
                else if (layer.patternType === 'base_aggregate') patId = `${uid}-pat-aggregate`;
                else if (layer.patternType === 'subbase_gravel') patId = `${uid}-pat-subbase`;
                else if (layer.patternType === 'geotextile') patId = `${uid}-pat-geotextile`;
                else if (layer.patternType === 'compacted_subgrade') patId = `${uid}-pat-subgrade`;
                else if (layer.patternType === 'timber_bedding') patId = `${uid}-pat-timber`;
                else if (layer.patternType === 'bedrock_boulders') patId = `${uid}-pat-bedrock`;

                const isGeotextile = layer.patternType === 'geotextile';

                return (
                  <g
                    key={layer.id}
                    id={`layer-group-${layer.id}`}
                    onClick={() => setSelectedLayerId(layer.id)}
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

                    {/* TOP FACE (Rendered when exploded so the internal surface is visible!) */}
                    {explodeFactor > 0.05 && index > 0 && (
                      <polygon
                        points={`${tb.x},${tb.y} ${tr.x},${tr.y} ${tf.x},${tf.y} ${tl.x},${tl.y}`}
                        fill={`url(#${patId})`}
                        stroke={isTarget ? '#f59e0b' : '#64748b'}
                        strokeWidth={isTarget ? 2 : 1}
                        opacity={isTarget ? 1 : 0.85}
                      />
                    )}

                    {/* LEFT ISOMETRIC FACE (Cross-Section Profile) */}
                    <polygon
                      points={`${tl.x},${tl.y} ${tf.x},${tf.y} ${bf.x},${bf.y} ${bl.x},${bl.y}`}
                      fill={`url(#${patId})`}
                      stroke={isTarget ? '#fbbf24' : isGeotextile ? '#38bdf8' : '#334155'}
                      strokeWidth={isTarget ? 2.5 : isGeotextile ? 2 : 1}
                      className="transition-all"
                    />

                    {/* Left Face Shading Gradient Overlay (Ambient light from top-left) */}
                    <polygon
                      points={`${tl.x},${tl.y} ${tf.x},${tf.y} ${bf.x},${bf.y} ${bl.x},${bl.y}`}
                      fill={layer.fillLeft}
                      opacity={isGeotextile ? 0.35 : 0.25}
                      style={{ mixBlendMode: 'multiply' }}
                    />

                    {/* RIGHT ISOMETRIC FACE (Depth Profile & Measurement Side) */}
                    <polygon
                      points={`${tf.x},${tf.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bf.x},${bf.y}`}
                      fill={`url(#${patId})`}
                      stroke={isTarget ? '#fbbf24' : isGeotextile ? '#0284c7' : '#1e293b'}
                      strokeWidth={isTarget ? 2.5 : isGeotextile ? 2 : 1}
                      className="transition-all"
                    />

                    {/* Right Face Darker Shadow Overlay */}
                    <polygon
                      points={`${tf.x},${tf.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bf.x},${bf.y}`}
                      fill="#000000"
                      opacity={isTarget ? 0.2 : 0.45}
                    />

                    {/* Layer Seam Highlight Line */}
                    <line
                      x1={tl.x}
                      y1={tl.y}
                      x2={tf.x}
                      y2={tf.y}
                      stroke={isTarget ? '#fef08a' : '#94a3b8'}
                      strokeWidth={isTarget ? 2 : 0.75}
                      opacity={0.8}
                    />
                    <line
                      x1={tf.x}
                      y1={tf.y}
                      x2={tr.x}
                      y2={tr.y}
                      stroke={isTarget ? '#fef08a' : '#64748b'}
                      strokeWidth={isTarget ? 2 : 0.75}
                      opacity={0.6}
                    />

                    {/* LEFT FACE LAYER CALLOUT LABEL (Interactive Pin) */}
                    <g transform={`translate(${tl.x - 12}, ${(tl.y + bl.y) / 2})`}>
                      <circle
                        cx="0"
                        cy="0"
                        r={isTarget ? '7' : '5'}
                        fill={isTarget ? '#f59e0b' : '#38bdf8'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className={isTarget ? 'animate-pulse' : ''}
                      />
                      {/* Connection leader line */}
                      <line x1="0" y1="0" x2="-28" y2="0" stroke={isTarget ? '#f59e0b' : '#64748b'} strokeWidth="1.5" />
                      <rect
                        x="-175"
                        y="-12"
                        width="145"
                        height="24"
                        rx="4"
                        fill="#090d16"
                        stroke={isTarget ? '#f59e0b' : '#334155'}
                        strokeWidth={isTarget ? '1.5' : '1'}
                        opacity="0.95"
                      />
                      <text
                        x="-102"
                        y="4"
                        fill={isTarget ? '#fef08a' : '#f1f5f9'}
                        fontSize="10"
                        fontWeight={isTarget ? '800' : '600'}
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {layer.name.length > 21 ? layer.name.slice(0, 19) + '…' : layer.name}
                      </text>
                    </g>

                    {/* RIGHT FACE DEPTH & THICKNESS ANNOTATION */}
                    <g transform={`translate(${tr.x + 12}, ${(tr.y + br.y) / 2})`}>
                      <line x1="0" y1="0" x2="22" y2="0" stroke={isTarget ? '#f59e0b' : '#475569'} strokeWidth="1" strokeDasharray="2,2" />
                      <text
                        x="28"
                        y="3"
                        fill={isTarget ? '#fef08a' : '#94a3b8'}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {layer.thicknessDisplay}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* GROUNDWATER TABLE HORIZON SHIMMER PLANE */}
              {showWaterTable && (
                <g id="groundwater-plane" className="pointer-events-none">
                  {(() => {
                    const wtY = waterTablePixelY + (layerGeometries[3]?.explodeY || 0);
                    const wtL = { x: pLeft.x - 20, y: pLeft.y + wtY };
                    const wtF = { x: pFront.x, y: pFront.y + wtY };
                    const wtR = { x: pRight.x + 20, y: pRight.y + wtY };
                    const wtB = { x: pBack.x, y: pBack.y + wtY };

                    return (
                      <g>
                        {/* Translucent water table plane */}
                        <polygon
                          points={`${wtB.x},${wtB.y} ${wtR.x},${wtR.y} ${wtF.x},${wtF.y} ${wtL.x},${wtL.y}`}
                          fill={`url(#${uid}-grad-watertable)`}
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="6,4"
                          className="animate-pulse"
                        />

                        {/* Water level ripple waves */}
                        <path
                          d={`M${wtL.x},${wtL.y} Q${(wtL.x + wtF.x) / 2},${(wtL.y + wtF.y) / 2 - 4} ${wtF.x},${wtF.y} Q${(wtF.x + wtR.x) / 2},${(wtF.y + wtR.y) / 2 - 4} ${wtR.x},${wtR.y}`}
                          fill="none"
                          stroke="#e0f2fe"
                          strokeWidth="1.5"
                        />

                        {/* GWT Callout Badge */}
                        <g transform={`translate(${wtR.x + 10}, ${wtR.y - 10})`}>
                          <rect x="0" y="0" width="130" height="22" rx="4" fill="#0369a1" stroke="#38bdf8" strokeWidth="1" />
                          <text x="65" y="15" fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            🌊 GWT Horizon @ ~3.8m
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
                ACTIVE FOCUS:
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
              <span className="text-slate-500">Click any layer in 3D block to inspect</span>
            </div>
          </div>
        </div>

        {/* Right Engineering Detail HUD & Equipment Specifications */}
        <div className="lg:col-span-4 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col justify-between overflow-y-auto max-h-[780px]">
          <div className="space-y-5">
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

              <h3 className="text-lg font-black text-white mt-1.5 leading-snug">
                {currentLayer.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
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
                  Strength / CBR / UCS
                </span>
                <div className="text-sm font-black text-emerald-400 mt-0.5 font-mono">
                  {currentLayer.ucsMpa ? `${currentLayer.ucsMpa} MPa UCS` : currentLayer.cbrPct ? `CBR ${currentLayer.cbrPct}%` : 'Standard Soil'}
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                  Permeability / GWT
                </span>
                <div className="text-sm font-black text-cyan-400 mt-0.5 font-mono truncate" title={currentLayer.specs.permeability}>
                  {currentLayer.specs.permeability}
                </div>
              </div>
            </div>

            {/* Engineering Description */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-300 block mb-1">
                Technical Specification & Geological Matrix:
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
                          // fallback if image fails
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
                    onClick={() => setSelectedLayerId(l.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                      l.id === currentLayer.id
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

          {/* Bottom Export / Snapshot actions */}
          <div className="pt-4 border-t border-slate-800 mt-5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Scale: 1:50 True Isometric BIM
            </span>
            <button
              onClick={() => {
                window.print();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Export 3D CAD/Report View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
