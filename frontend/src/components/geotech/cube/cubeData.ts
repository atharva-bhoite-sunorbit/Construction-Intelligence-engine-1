

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
      leftTone: '#0f766e',
      leftToneEnd: '#115e59',
      rightTone: '#134e4a',
      topTone: '#2dd4bf',
      stroke: '#5eead4',
      textBadge: 'text-teal-300',
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
      leftTone: '#475569',
      leftToneEnd: '#334155',
      rightTone: '#1e293b',
      topTone: '#94a3b8',
      stroke: '#cbd5e1',
      textBadge: 'text-slate-300',
      patternType: 'bedrock_boulders',
    };
  }
  if (k.includes('quartzite')) {
    return {
      leftTone: '#0f766e',
      leftToneEnd: '#115e59',
      rightTone: '#134e4a',
      topTone: '#2dd4bf',
      stroke: '#99f6e4',
      textBadge: 'text-teal-300',
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
      leftTone: '#475569',
      leftToneEnd: '#334155',
      rightTone: '#1e293b',
      topTone: '#94a3b8',
      stroke: '#cbd5e1',
      textBadge: 'text-amber-300',
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

export const getRecommendedMachineryForClass = (classNum: number): string[] => {
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
    thicknessDisplay: 'Structural Grid & Membrane (Slate)',
    depthRangeDisplay: '0.68 m - 0.74 m EGL',
    materialKey: 'quartzite',
    fillLeft: '#64748b',
    fillRight: '#475569',
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
