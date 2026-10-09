export const VEHICLE_IMAGE_MAP: Record<string, { src: string; label: string; badge: string; badgeColor: string; description: string }> = {
  backhoe: {
    src: '/vehicles/backhoe.png',
    label: 'JCB Backhoe Loader (3DX Super / 4DX)',
    badge: 'Soft Dig & Trimming',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Versatile rubber-tired machine with front loading shovel and rear boom for utility trenching, bench shaping, and soft dig.',
  },
  excavator_20t: {
    src: '/vehicles/excavator_20t.png',
    label: '20-22 Ton Heavy Hydraulic Excavator',
    badge: 'Rock Bucket & Bulk Mucking',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    description: 'Tracked heavy crawler excavator fitted with heavy-duty rock bucket and penetration teeth for dense strata and blasted rock loading.',
  },
  breaker: {
    src: '/vehicles/breaker.png',
    label: 'Hydraulic Rock Breaker / Hammer',
    badge: 'Rock Fracturing & Splitting',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'Excavator-mounted high-impact hydraulic chisel for breaking massive boulders and sound rock where conventional blasting is restricted.',
  },
  drill_rig: {
    src: '/vehicles/drill_rig.png',
    label: 'Crawler DTH Blast-Hole Drill Rig',
    badge: 'Class V Bedrock Drilling',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    description: 'Crawler blast-hole drill rig with heavy vertical mast for drilling 89-115 mm blast holes or non-explosive demolition expansive grout holes.',
  },
  tipper: {
    src: '/vehicles/tipper.png',
    label: '10-Wheel Heavy Tipper / Dumper Truck',
    badge: 'High-Capacity Spoil Haulage',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Heavy 16-20 tonne multi-axle dump trucks hauling excavated rock and soil muck to designated dumping yards.',
  },
  compressor: {
    src: '/vehicles/compressor.png',
    label: 'Portable High-Pressure Air Compressor',
    badge: '600 CFM Air Supply',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    description: 'Mobile diesel rotary screw compressor supplying 450-600 CFM at 10-17 bar for DTH hammer drilling and pneumatic jackhammers.',
  },
  pump: {
    src: '/vehicles/pump.png',
    label: 'Submersible Dewatering Slurry Pump',
    badge: 'Groundwater Ingress Control',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    description: 'Heavy-duty non-clogging submersible slurry pumps for lowering groundwater table and keeping the excavation base dry.',
  },
  plate_compactor: {
    src: '/vehicles/plate_compactor.png',
    label: 'Heavy Formation Plate Compactor',
    badge: 'Subgrade Compaction',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    description: 'Mechanical vibratory plate compactor for dressing and compacting formation founding level before blinding PCC.',
  },
};

export interface StrataVisualTheme {
  gradient: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentColor: string;
  iconSymbol: string;
  categoryLabel: string;
}

export const STRATA_THEMES: Record<string, StrataVisualTheme> = {
  topsoil: {
    gradient: 'from-emerald-700 via-green-600 to-emerald-800',
    borderColor: 'border-emerald-400',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-950',
    badgeBorder: 'border-emerald-300',
    accentColor: '#10b981',
    iconSymbol: '🌿',
    categoryLabel: 'Organic Topsoil'
  },
  fill: {
    gradient: 'from-stone-600 via-neutral-600 to-stone-700',
    borderColor: 'border-stone-400',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-900',
    badgeBorder: 'border-stone-400',
    accentColor: '#78716c',
    iconSymbol: '🧱',
    categoryLabel: 'Engineered / Made Ground'
  },
  sand: {
    gradient: 'from-amber-600 via-yellow-600 to-amber-700',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    accentColor: '#d97706',
    iconSymbol: '🏖️',
    categoryLabel: 'Cohesionless Sand'
  },
  clay: {
    gradient: 'from-amber-800 via-yellow-800 to-stone-800',
    borderColor: 'border-amber-700',
    badgeBg: 'bg-amber-200',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-400',
    accentColor: '#92400e',
    iconSymbol: '🏺',
    categoryLabel: 'Cohesive Plastic Clay'
  },
  murrum: {
    gradient: 'from-orange-700 via-red-700 to-amber-800',
    borderColor: 'border-orange-500',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-950',
    badgeBorder: 'border-orange-300',
    accentColor: '#c2410c',
    iconSymbol: '🪨',
    categoryLabel: 'Dense Murrum / Saprolite'
  },
  soft_rock: {
    gradient: 'from-orange-800 via-amber-900 to-stone-800',
    borderColor: 'border-orange-600',
    badgeBg: 'bg-orange-200',
    badgeText: 'text-orange-950',
    badgeBorder: 'border-orange-400',
    accentColor: '#9a3412',
    iconSymbol: '⛏️',
    categoryLabel: 'Soft Disintegrated Rock (SDR)'
  },
  hard_rock: {
    gradient: 'from-cyan-900 via-slate-900 to-blue-950',
    borderColor: 'border-cyan-500',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-950',
    badgeBorder: 'border-cyan-400',
    accentColor: '#0891b2',
    iconSymbol: '💎',
    categoryLabel: 'Massive Hard Bedrock'
  }
};

export function getStrataTheme(categoryOrKey?: string): StrataVisualTheme {
  const k = (categoryOrKey || '').toLowerCase();
  if (k.includes('topsoil') || k.includes('organic')) return STRATA_THEMES.topsoil;
  if (k.includes('fill') || k.includes('made')) return STRATA_THEMES.fill;
  if (k.includes('sand') || k.includes('silt')) return STRATA_THEMES.sand;
  if (k.includes('clay')) return STRATA_THEMES.clay;
  if (k.includes('murrum') || k.includes('gravel') || k.includes('saprolite') || k.includes('cwr')) return STRATA_THEMES.murrum;
  if (k.includes('soft') || k.includes('weathered') || k.includes('sdr')) return STRATA_THEMES.soft_rock;
  if (k.includes('hard') || k.includes('basalt') || k.includes('rock') || k.includes('bedrock')) return STRATA_THEMES.hard_rock;
  return STRATA_THEMES.murrum;
}

export function getExcavabilityBadge(classNum: number | string) {
  const num = typeof classNum === 'string' ? parseInt(classNum, 10) || 1 : classNum;
  switch (num) {
    case 1:
      return {
        label: 'Class I - Easy Digging',
        desc: 'Backhoe loader / direct bucket excavation',
        bg: 'bg-emerald-600 text-white',
        pill: 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
      };
    case 2:
      return {
        label: 'Class II - Medium Digging',
        desc: 'Standard hydraulic crawler excavator',
        bg: 'bg-teal-600 text-white',
        pill: 'border-teal-700 bg-teal-950/40 text-teal-300'
      };
    case 3:
      return {
        label: 'Class III - Hard Digging / Ripping',
        desc: 'Heavy crawler excavator with ripper tooth',
        bg: 'bg-amber-600 text-white',
        pill: 'border-amber-700 bg-amber-950/40 text-amber-300'
      };
    case 4:
      return {
        label: 'Class IV - Hydraulic Rock Breaking',
        desc: 'Hydraulic breaker hammer mounted on 20t excavator',
        bg: 'bg-orange-600 text-white',
        pill: 'border-orange-700 bg-orange-950/40 text-orange-300'
      };
    case 5:
    default:
      return {
        label: 'Class V - Controlled Rock Blasting / Expanding Grout',
        desc: 'Drilling & blasting or chemical soundless cracking',
        bg: 'bg-rose-600 text-white',
        pill: 'border-rose-700 bg-rose-950/40 text-rose-300'
      };
  }
}
