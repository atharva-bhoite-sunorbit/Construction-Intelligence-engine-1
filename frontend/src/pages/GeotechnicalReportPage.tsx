import React, { useState, useEffect } from 'react';
import {
  Layers, Pickaxe, Drill, Hammer, Truck, Waves,
  UploadCloud, FileText, CheckCircle2, AlertTriangle, ShieldAlert,
  Calendar, Clock, ArrowRight, RefreshCw, ChevronRight,
  Sparkles, Download, Info, Play, Trash2, ShieldCheck, Activity as ActivityIcon,
  ZoomIn, X, Eye, Rotate3d
} from 'lucide-react';
import { Project, GeotechnicalReport, SampleGeotechReport, StrataLayer, MachineryRecommendation, PlannedActivity } from '../types';
import { apiClient } from '../api/client';
import { IsometricGeologicalCube } from '../components/IsometricGeologicalCube';

export const VEHICLE_IMAGE_MAP: Record<string, { src: string; label: string; badge: string; badgeColor: string; description: string }> = {
  backhoe: {
    src: '/vehicles/backhoe.jpg',
    label: 'JCB Backhoe Loader (3DX Super / 4DX)',
    badge: 'Soft Dig & Trimming',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Versatile rubber-tired machine with front loading shovel and rear boom for utility trenching, bench shaping, and soft dig.',
  },
  excavator_20t: {
    src: '/vehicles/excavator_20t.jpg',
    label: '20-22 Ton Heavy Hydraulic Excavator',
    badge: 'Rock Bucket & Bulk Mucking',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    description: 'Tracked heavy crawler excavator fitted with heavy-duty rock bucket and penetration teeth for dense strata and blasted rock loading.',
  },
  breaker: {
    src: '/vehicles/breaker.jpg',
    label: 'Hydraulic Rock Breaker / Hammer',
    badge: 'Rock Fracturing & Splitting',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'Excavator-mounted high-impact hydraulic chisel for breaking massive boulders and sound rock where conventional blasting is restricted.',
  },
  drill_rig: {
    src: '/vehicles/drill_rig.jpg',
    label: 'Crawler DTH Blast-Hole Drill Rig',
    badge: 'Class V Bedrock Drilling',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    description: 'Crawler blast-hole drill rig with heavy vertical mast for drilling 89-115 mm blast holes or non-explosive demolition expansive grout holes.',
  },
  tipper: {
    src: '/vehicles/tipper.jpg',
    label: '10-Wheel Heavy Tipper / Dumper Truck',
    badge: 'High-Capacity Spoil Haulage',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Heavy 16-20 tonne multi-axle dump trucks hauling excavated rock and soil muck to designated dumping yards.',
  },
  compressor: {
    src: '/vehicles/compressor.jpg',
    label: 'Portable High-Pressure Air Compressor',
    badge: '600 CFM Air Supply',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    description: 'Mobile diesel rotary screw compressor supplying 450-600 CFM at 10-17 bar for DTH hammer drilling and pneumatic jackhammers.',
  },
  pump: {
    src: '/vehicles/pump.jpg',
    label: 'Submersible Dewatering Slurry Pump',
    badge: 'Groundwater Ingress Control',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    description: 'Heavy-duty non-clogging submersible slurry pumps for lowering groundwater table and keeping the excavation base dry.',
  },
  plate_compactor: {
    src: '/vehicles/backhoe.jpg',
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
    categoryLabel: 'Made Ground / Fill'
  },
  sand: {
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
    borderColor: 'border-yellow-400',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-950',
    badgeBorder: 'border-yellow-300',
    accentColor: '#eab308',
    iconSymbol: '🏖️',
    categoryLabel: 'Granular Sand'
  },
  silt: {
    gradient: 'from-amber-600 via-yellow-600 to-amber-700',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    accentColor: '#d97706',
    iconSymbol: '🌾',
    categoryLabel: 'Sandy Silt'
  },
  clay: {
    gradient: 'from-amber-800 via-orange-900 to-stone-900',
    borderColor: 'border-amber-600',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-950',
    badgeBorder: 'border-orange-300',
    accentColor: '#b45309',
    iconSymbol: '🏺',
    categoryLabel: 'Cohesive Clay'
  },
  black_cotton: {
    gradient: 'from-stone-900 via-zinc-900 to-stone-950',
    borderColor: 'border-stone-600',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-950',
    badgeBorder: 'border-stone-400',
    accentColor: '#44403c',
    iconSymbol: '🌑',
    categoryLabel: 'Expansive Black Cotton'
  },
  murrum: {
    gradient: 'from-orange-600 via-red-600 to-amber-700',
    borderColor: 'border-orange-400',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-950',
    badgeBorder: 'border-orange-300',
    accentColor: '#ea580c',
    iconSymbol: '🔶',
    categoryLabel: 'Dense Murrum'
  },
  laterite: {
    gradient: 'from-red-700 via-orange-700 to-amber-800',
    borderColor: 'border-red-400',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-950',
    badgeBorder: 'border-red-300',
    accentColor: '#c2410c',
    iconSymbol: '🔴',
    categoryLabel: 'Lateritic Soil'
  },
  gravel: {
    gradient: 'from-slate-600 via-stone-600 to-zinc-700',
    borderColor: 'border-slate-400',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-900',
    badgeBorder: 'border-slate-300',
    accentColor: '#64748b',
    iconSymbol: '⚪',
    categoryLabel: 'Dense Gravel'
  },
  weathered_rock: {
    gradient: 'from-amber-600 via-yellow-700 to-stone-800',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-950',
    badgeBorder: 'border-yellow-400',
    accentColor: '#ca8a04',
    iconSymbol: '🪨',
    categoryLabel: 'Weathered Rock (SDR)'
  },
  sandstone: {
    gradient: 'from-amber-600 via-orange-600 to-stone-700',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    accentColor: '#f59e0b',
    iconSymbol: '🏛️',
    categoryLabel: 'Medium Sandstone'
  },
  limestone: {
    gradient: 'from-stone-600 via-amber-600 to-stone-700',
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    accentColor: '#d97706',
    iconSymbol: '⛰️',
    categoryLabel: 'Limestone Rock'
  },
  basalt: {
    gradient: 'from-slate-900 via-zinc-800 to-slate-950',
    borderColor: 'border-cyan-400',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-950',
    badgeBorder: 'border-slate-400',
    accentColor: '#06b6d4',
    iconSymbol: '🌋',
    categoryLabel: 'Hard Basalt Bedrock'
  },
  granite: {
    gradient: 'from-purple-950 via-indigo-900 to-slate-950',
    borderColor: 'border-purple-400',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-950',
    badgeBorder: 'border-purple-300',
    accentColor: '#a855f7',
    iconSymbol: '💎',
    categoryLabel: 'Massive Granite Bedrock'
  },
  gneiss: {
    gradient: 'from-indigo-950 via-slate-900 to-purple-950',
    borderColor: 'border-indigo-400',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-950',
    badgeBorder: 'border-indigo-300',
    accentColor: '#6366f1',
    iconSymbol: '⚡',
    categoryLabel: 'Foliated Granite Gneiss'
  },
  quartzite: {
    gradient: 'from-slate-800 via-cyan-900 to-slate-950',
    borderColor: 'border-cyan-400',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-950',
    badgeBorder: 'border-cyan-300',
    accentColor: '#22d3ee',
    iconSymbol: '💠',
    categoryLabel: 'Extremely Hard Quartzite'
  },
  hard_rock: {
    gradient: 'from-slate-900 via-zinc-900 to-slate-950',
    borderColor: 'border-blue-400',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-950',
    badgeBorder: 'border-slate-400',
    accentColor: '#3b82f6',
    iconSymbol: '🪨',
    categoryLabel: 'Competent Bedrock'
  },
  boulders: {
    gradient: 'from-stone-700 via-amber-800 to-stone-800',
    borderColor: 'border-amber-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    accentColor: '#78716c',
    iconSymbol: '🪨',
    categoryLabel: 'Soil with Boulders'
  }
};

export const getStrataTheme = (matKey?: string): StrataVisualTheme => {
  if (!matKey) return STRATA_THEMES.hard_rock;
  const key = matKey.toLowerCase();
  for (const [k, theme] of Object.entries(STRATA_THEMES)) {
    if (key.includes(k)) return theme;
  }
  return STRATA_THEMES.hard_rock;
};

export const getExcavabilityBadge = (classNum: number) => {
  switch (classNum) {
    case 1:
      return { label: 'Class I - Soft Dig', bg: 'bg-emerald-500 text-white', pill: 'bg-emerald-100 text-emerald-900 border-emerald-300', desc: 'Direct bucket excavation' };
    case 2:
      return { label: 'Class II - Hard Dig', bg: 'bg-amber-500 text-white', pill: 'bg-amber-100 text-amber-900 border-amber-300', desc: 'Rock bucket penetration' };
    case 3:
      return { label: 'Class III - Rippable Rock', bg: 'bg-orange-500 text-white', pill: 'bg-orange-100 text-orange-900 border-orange-300', desc: 'Ripping tooth & excavator' };
    case 4:
      return { label: 'Class IV - Hydraulic Breaker', bg: 'bg-rose-600 text-white', pill: 'bg-rose-100 text-rose-900 border-rose-300', desc: 'Excavator rock hammer' };
    case 5:
    default:
      return { label: 'Class V - Drilling & Blasting', bg: 'bg-purple-600 text-white', pill: 'bg-purple-100 text-purple-900 border-purple-300', desc: 'Crawler drill rig / blasting' };
  }
};

interface GeotechnicalReportPageProps {
  project?: Project;
  onNavigateToSchedule?: () => void;
  onRefreshData?: () => void;
}

export const GeotechnicalReportPage: React.FC<GeotechnicalReportPageProps> = ({
  project,
  onNavigateToSchedule,
  onRefreshData,
}) => {
  const [reports, setReports] = useState<GeotechnicalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<GeotechnicalReport | null>(null);
  const [sampleReports, setSampleReports] = useState<SampleGeotechReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'3d_cutaway' | 'strata' | 'machinery' | 'schedule' | 'hazards'>('3d_cutaway');
  const [enlargedVehicle, setEnlargedVehicle] = useState<MachineryRecommendation | null>(null);

  // Upload & Configuration State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'text' | 'sample'>('sample');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [targetDepth, setTargetDepth] = useState<number>(8.0);
  const [excavationArea, setExcavationArea] = useState<number>(1500.0);
  const [waterTableDepth, setWaterTableDepth] = useState<string>('');
  const [blastingPermitted, setBlastingPermitted] = useState<boolean>(false);
  const [nearStructures, setNearStructures] = useState<boolean>(true);
  const [shiftsPerDay, setShiftsPerDay] = useState<number>(1);
  const [hoursPerShift, setHoursPerShift] = useState<number>(8.0);

  // Push to schedule state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);

  // Filter & Search in Schedule
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(0);

  const projectId = project?.id;

  const fetchReports = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const [allReports, samples] = await Promise.all([
        apiClient.getGeotechnicalReports(projectId),
        apiClient.getGeotechnicalSampleReports(projectId).catch(() => []),
      ]);
      setReports(allReports);
      setSampleReports(samples);
      if (allReports.length > 0) {
        setSelectedReport(allReports[0]);
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to load geotechnical reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const handleSelectSample = (sample: SampleGeotechReport) => {
    setPastedText(sample.text);
    setTargetDepth(sample.default_depth);
    setExcavationArea(sample.default_area);
    setWaterTableDepth(sample.water_table.toString());
    setUploadMode('text');
  };

  const handleAnalyze = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      if (uploadMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('target_depth_m', targetDepth.toString());
        formData.append('excavation_area_sqm', excavationArea.toString());
        if (waterTableDepth) formData.append('water_table_depth_m', waterTableDepth);
        formData.append('blasting_permitted', blastingPermitted ? 'true' : 'false');
        formData.append('near_existing_structures', nearStructures ? 'true' : 'false');
        formData.append('shifts_per_day', shiftsPerDay.toString());
        formData.append('hours_per_shift', hoursPerShift.toString());

        const newReport = await apiClient.uploadGeotechnicalReport(projectId, formData);
        setReports([newReport, ...reports]);
        setSelectedReport(newReport);
        setIsUploadOpen(false);
      } else {
        const textToSend = pastedText.trim();
        if (!textToSend) {
          alert('Please paste geotechnical borehole text or select a sample.');
          setIsLoading(false);
          return;
        }

        const payload = {
          raw_text: textToSend,
          filename: uploadMode === 'sample' ? 'Sample Geological Report' : 'User Borelog Report',
          target_depth_m: targetDepth,
          excavation_area_sqm: excavationArea,
          water_table_depth_m: waterTableDepth ? parseFloat(waterTableDepth) : null,
          blasting_permitted: blastingPermitted,
          near_existing_structures: nearStructures,
          shifts_per_day: shiftsPerDay,
          hours_per_shift: hoursPerShift,
        };

        const newReport = await apiClient.analyzeGeotechnicalText(projectId, payload);
        setReports([newReport, ...reports]);
        setSelectedReport(newReport);
        setIsUploadOpen(false);
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      alert(err.response?.data?.detail || 'Failed to analyze geotechnical report.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    if (!projectId || !window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await apiClient.deleteGeotechnicalReport(projectId, reportId);
      const remaining = reports.filter((r) => r.id !== reportId);
      setReports(remaining);
      setSelectedReport(remaining[0] || null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete report.');
    }
  };

  const handlePushToSchedule = async () => {
    if (!projectId || !selectedReport) return;
    setIsPushing(true);
    setPushSuccessMsg(null);
    try {
      const res = await apiClient.pushGeotechnicalToSchedule(projectId, selectedReport.id, {
        replace_existing: replaceExisting,
      });
      setPushSuccessMsg(res.message);
      setSelectedReport({ ...selectedReport, status: 'PUSHED_TO_SCHEDULE' });
      setReports((prev) =>
        prev.map((r) => (r.id === selectedReport.id ? { ...r, status: 'PUSHED_TO_SCHEDULE' } : r))
      );
      if (onRefreshData) onRefreshData();
      setTimeout(() => {
        setIsPushModalOpen(false);
        setPushSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      console.error('Push error:', err);
      alert(err.response?.data?.detail || 'Failed to push activities to project schedule.');
    } finally {
      setIsPushing(false);
    }
  };

  const exportSummaryCsv = () => {
    if (!selectedReport) return;
    const rows = [
      ['GEOTECHNICAL & EXCAVATION REPORT SUMMARY'],
      ['Report Title', selectedReport.report_title],
      ['Primary Rock Type', selectedReport.primary_rock_type],
      ['Excavability Class', selectedReport.excavability_class],
      ['Governing UCS (MPa)', selectedReport.unconfined_compressive_strength_mpa || 'N/A'],
      ['Governing RQD (%)', selectedReport.rock_quality_designation_rqd || 'N/A'],
      ['Total Excavation Vol (cum)', selectedReport.total_excavation_volume_cum],
      ['Rock Volume (cum)', selectedReport.rock_volume_cum],
      ['Soil Overburden Vol (cum)', selectedReport.overburden_volume_cum],
      ['Estimated Total Days', selectedReport.estimated_total_days],
      [],
      ['RECOMMENDED MACHINERY'],
      ['Equipment Class', 'Recommended Models', 'Units', 'Machine Hours', 'Role / Justification'],
      ...selectedReport.recommended_machinery.map((m) => [
        m.name,
        m.models,
        m.count,
        m.machine_hours,
        `"${m.why.replace(/"/g, '""')}"`,
      ]),
      [],
      ['DETAILED TIME-PHASED ACTIVITIES'],
      ['Code', 'Activity Name', 'Phase', 'Duration (Days)', 'Start Date', 'End Date', 'Quantity', 'Unit', 'Daily Output', 'Critical Path'],
      ...selectedReport.planned_activities.map((a) => [
        a.code,
        `"${a.name.replace(/"/g, '""')}"`,
        a.phase,
        a.duration_days,
        a.start_date,
        a.end_date,
        a.quantity,
        a.unit,
        a.daily_output,
        a.is_critical ? 'YES' : 'NO',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Geotechnical_Plan_${selectedReport.primary_rock_type.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const layers = selectedReport?.strata_layers || [];
  const machinery = selectedReport?.recommended_machinery || [];
  const activities = selectedReport?.planned_activities || [];
  const hazards = selectedReport?.hazard_controls || [];
  const summary = selectedReport?.summary;

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.name.toLowerCase().includes(activitySearch.toLowerCase()) ||
      act.code.toLowerCase().includes(activitySearch.toLowerCase()) ||
      act.phase.toLowerCase().includes(activitySearch.toLowerCase());
    const matchesPhase = selectedPhaseFilter === 'ALL' || act.phase === selectedPhaseFilter;
    const matchesCritical = !criticalOnly || act.is_critical;
    return matchesSearch && matchesPhase && matchesCritical;
  });

  const availablePhases = Array.from(new Set(activities.map((a) => a.phase)));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Pickaxe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Geotechnical & Excavation AI
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Civil Subsurface Engine
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Borehole strata stratigraphy, rock identification, JCB & drill rig fleet sizing, and CPM activity scheduling
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {reports.length > 0 && (
            <div className="relative">
              <select
                aria-label="Select Geotechnical Report"
                value={selectedReport?.id || ''}
                onChange={(e) => {
                  const rep = reports.find((r) => r.id === parseInt(e.target.value));
                  if (rep) setSelectedReport(rep);
                }}
                className="text-xs font-medium bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.report_title} ({r.primary_rock_type}) - #{r.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              setIsUploadOpen(true);
              setUploadMode('sample');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg border border-brand-200 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            Load Sample Report
          </button>

          <button
            onClick={() => {
              setIsUploadOpen(true);
              setUploadMode('file');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Geotechnical Report
          </button>

          {selectedReport && (
            <>
              <button
                onClick={exportSummaryCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors shadow-2xs"
                title="Export report breakdown to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Export CSV
              </button>

              <button
                onClick={() => setIsPushModalOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                  selectedReport.status === 'PUSHED_TO_SCHEDULE'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {selectedReport.status === 'PUSHED_TO_SCHEDULE' ? 'Re-Sync Master Schedule' : 'Push Plan to Schedule'}
              </button>

              <button
                onClick={() => handleDeleteReport(selectedReport.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                title="Delete this geotechnical report"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedReport && !isLoading ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <Pickaxe className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">No Geotechnical Reports Analyzed Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Upload a borehole investigation report (PDF, DOCX, XLSX, TXT) or choose from real-world Indian geological profiles (Deccan Basalt, Bangalore Gneiss, Delhi Sandstone).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setIsUploadOpen(true);
                setUploadMode('sample');
              }}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Try 1-Click Realistic Sample
            </button>
            <button
              onClick={() => {
                setIsUploadOpen(true);
                setUploadMode('file');
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              Upload PDF or Borelog File
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics / KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Rock Type */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Primary Rock
              </span>
              <div className="text-base font-bold text-slate-900 mt-1 truncate" title={selectedReport?.primary_rock_type}>
                {selectedReport?.primary_rock_type}
              </div>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {selectedReport?.strata_classification}
              </span>
            </div>

            {/* Excavability Class */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Excavability Class
              </span>
              <div className="text-base font-bold text-brand-700 mt-1 truncate">
                {selectedReport?.excavability_class.split(' - ')[0] || 'Class III'}
              </div>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-50 text-brand-700 border border-brand-200 truncate max-w-full">
                {selectedReport?.excavability_class.split(' - ')[1] || 'Mechanical Dig'}
              </span>
            </div>

            {/* Rock UCS & RQD */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                UCS / RQD
              </span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {selectedReport?.unconfined_compressive_strength_mpa ? `${selectedReport.unconfined_compressive_strength_mpa} MPa` : 'Soil matrix'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                RQD: {selectedReport?.rock_quality_designation_rqd ? `${selectedReport.rock_quality_designation_rqd}%` : 'N/A'} • {selectedReport?.weathering_grade?.split(' ')[0] || 'W2'}
              </div>
            </div>

            {/* Total Volume */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Excavation
              </span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {selectedReport?.total_excavation_volume_cum?.toLocaleString()} m³
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Rock: {selectedReport?.rock_volume_cum?.toLocaleString()} m³</span>
                <span className="font-semibold text-slate-700">({summary?.rock_share_pct || 0}%)</span>
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Working Days
              </span>
              <div className="text-base font-bold text-emerald-700 mt-1">
                {selectedReport?.estimated_total_days} Days
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {summary?.calendar_days || selectedReport?.estimated_total_days} cal. days ({summary?.finish_date || 'Target'})
              </div>
            </div>

            {/* Fleet peak */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Machinery Fleet
              </span>
              <div className="text-base font-bold text-amber-700 mt-1">
                {summary?.peak_fleet_size || machinery.reduce((acc, m) => acc + m.count, 0)} Units Peak
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {summary?.total_machine_hours?.toLocaleString() || 0} fleet hours total
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-3 rounded-t-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('3d_cutaway')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === '3d_cutaway'
                  ? 'border-amber-500 text-amber-900 bg-amber-50/60'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rotate3d className="w-4 h-4 text-amber-500" />
              <span>3D Cutaway Visualizer</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                Pavement & Stratum
              </span>
            </button>
            <button
              onClick={() => setActiveTab('strata')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'strata'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              Borehole Strata Column ({layers.length} Layers)
            </button>
            <button
              onClick={() => setActiveTab('machinery')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'machinery'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-4 h-4" />
              JCB, Excavators & Drilling Machinery ({machinery.length} Types)
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Detailed Time-Phased Activities ({activities.length} Planned)
            </button>
            <button
              onClick={() => setActiveTab('hazards')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'hazards'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Safety, Ground Hazards & Water Table ({hazards.length})
            </button>
          </div>

          {/* TAB 0: 3D ISOMETRIC CUTAWAY */}
          {activeTab === '3d_cutaway' && (
            <div className="pt-2">
              <IsometricGeologicalCube
                report={selectedReport}
                activeProjectName={project?.name}
                onNavigateToFleet={() => setActiveTab('machinery')}
              />
            </div>
          )}

          {/* TAB 1: STRATA & ROCKS */}
          {activeTab === 'strata' && (
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-5 shadow-xs space-y-6">
              {/* Colorful Geological Legend Ribbon */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Color Code Key:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Topsoil & Soft Dig
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-yellow-100 text-yellow-900 border border-yellow-300 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Sand & Sandy Silt
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-orange-100 text-orange-900 border border-orange-300 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> Murrum & Dense Gravel
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-700" /> Weathered Rock (SDR)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-slate-900 text-cyan-300 border border-cyan-500 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Hard Bedrock (Basalt/Granite)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-[11px] bg-cyan-100 text-cyan-900 border border-cyan-300 shadow-2xs">
                      <Waves className="w-3 h-3 text-cyan-600 animate-pulse" /> Groundwater Horizon
                    </span>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-mono">
                  * Click any layer below to inspect engineering properties & equipment
                </span>
              </div>

              {/* Main Strata Section Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Stratigraphic Column / Borehole visualizer */}
                <div className="lg:col-span-5 bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Drill className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wider block font-mono">
                            Borehole Stratigraphy Core
                          </span>
                          <span className="text-[10px] text-slate-400">Vertical Subsurface Profile Cross-Section</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-300 font-mono font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        0.0m → {selectedReport?.target_depth_m}m EGL
                      </span>
                    </div>

                    {/* Dual-Track Visualizer: Depth Scale + Colored Stratum Blocks */}
                    <div className="mt-5 flex gap-3 relative">
                      {/* Depth Scale Ruler */}
                      <div className="w-12 shrink-0 flex flex-col justify-between py-1 text-[10px] font-mono text-slate-400 border-r border-slate-800/80 pr-2 select-none">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold">0.0m</span>
                          <span className="text-slate-600">-</span>
                        </div>
                        {layers.map((l, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-slate-300">{l.bottom_m.toFixed(1)}m</span>
                            <span className="text-slate-600">-</span>
                          </div>
                        ))}
                      </div>

                      {/* Stacked Colorful Geological Layers */}
                      <div className="flex-1 space-y-2.5 relative">
                        {layers.map((layer, idx) => {
                          const isSelected = selectedLayerIndex === idx;
                          const theme = getStrataTheme(layer.material_key);
                          const clsBadge = getExcavabilityBadge(layer.excavability_class_num);

                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedLayerIndex(idx)}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group ${
                                isSelected
                                  ? `ring-4 ring-amber-400 border-white shadow-xl scale-[1.01] bg-gradient-to-r ${theme.gradient}`
                                  : `border-slate-700/80 hover:border-slate-500 hover:shadow-md bg-gradient-to-r ${theme.gradient} opacity-90 hover:opacity-100`
                              }`}
                              style={{
                                minHeight: `${Math.max(80, (layer.thickness_m || 1) * 35)}px`,
                              }}
                            >
                              {/* Background Texture Overlay */}
                              <div className="absolute inset-0 bg-black/15 pointer-events-none" />

                              {/* Layer Card Header */}
                              <div className="flex items-start justify-between relative z-10">
                                <div className="flex items-center gap-2">
                                  <span className="text-base drop-shadow-sm">{theme.iconSymbol}</span>
                                  <div>
                                    <h4 className="font-black text-sm text-white drop-shadow-md tracking-tight flex items-center gap-2">
                                      {layer.material}
                                      {layer.is_rock && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-amber-400 text-slate-950 shadow-xs uppercase">
                                          ROCK
                                        </span>
                                      )}
                                    </h4>
                                    <span className="text-[10px] text-white/80 font-medium block">
                                      {theme.categoryLabel}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-white bg-black/50 px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-xs block">
                                    {layer.top_m.toFixed(1)}m – {layer.bottom_m.toFixed(1)}m
                                  </span>
                                  <span className="text-[10px] text-white/80 font-mono block mt-0.5">
                                    ({layer.thickness_m.toFixed(1)}m thick)
                                  </span>
                                </div>
                              </div>

                              {/* Layer Card Bottom Parameters */}
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 relative z-10 pt-2 border-t border-white/20 text-white">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-xs ${clsBadge.bg}`}>
                                  {clsBadge.label}
                                </span>

                                <div className="flex items-center gap-2 text-[10px] font-mono text-white/90">
                                  {layer.ucs_mpa && (
                                    <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/20">
                                      UCS: {layer.ucs_mpa} MPa
                                    </span>
                                  )}
                                  {layer.rqd_pct && (
                                    <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/20">
                                      RQD: {layer.rqd_pct}%
                                    </span>
                                  )}
                                  {layer.spt_n && (
                                    <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/20">
                                      SPT: N={layer.spt_n}
                                    </span>
                                  )}
                                  {layer.bulking_factor && (
                                    <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/20">
                                      {layer.bulking_factor}x Bulk
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Submerged Water Table Overlay */}
                              {layer.below_water_table && (
                                <div className="mt-2 text-[10px] text-cyan-200 bg-cyan-950/70 border border-cyan-400/40 rounded px-2 py-0.5 flex items-center gap-1.5 relative z-10 backdrop-blur-xs font-mono">
                                  <Waves className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span>Submerged below water table (dewatering active)</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Groundwater Table Marker Strip */}
                        {selectedReport?.water_table_depth_m && (
                          <div
                            className="flex items-center gap-2 text-cyan-300 text-xs font-mono py-1.5 px-3 rounded-xl bg-cyan-950/80 border border-cyan-400 shadow-md backdrop-blur-md"
                          >
                            <Waves className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                            <span className="font-bold">
                              Static Water Table (GWT) at {selectedReport.water_table_depth_m}m below EGL
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="text-amber-400/90 font-medium">▲ Ground Level 0.0m</span>
                    <span className="text-slate-300 font-bold">Formation Level: {selectedReport?.target_depth_m}m ▼</span>
                  </div>
                </div>

                {/* Layer Details & Rock Engineering Assessment */}
                <div className="lg:col-span-7 space-y-4">
                  {selectedLayerIndex !== null && layers[selectedLayerIndex] ? (
                    (() => {
                      const sel = layers[selectedLayerIndex];
                      const theme = getStrataTheme(sel.material_key);
                      const clsBadge = getExcavabilityBadge(sel.excavability_class_num);

                      return (
                        <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4 shadow-xs">
                          {/* Colorful Layer Banner Header */}
                          <div className={`p-4 rounded-xl text-white bg-gradient-to-r ${theme.gradient} border ${theme.borderColor} shadow-md flex items-start justify-between gap-3`}>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl drop-shadow-sm">{theme.iconSymbol}</span>
                                <div>
                                  <h3 className="text-xl font-black text-white drop-shadow-md tracking-tight">
                                    {sel.material}
                                  </h3>
                                  <span className="text-xs text-white/90 font-medium">
                                    {theme.categoryLabel} • Depth: {sel.top_m.toFixed(1)}m to {sel.bottom_m.toFixed(1)}m ({sel.thickness_m.toFixed(1)}m thick)
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-white/90 italic pt-1 leading-relaxed">
                                {sel.report_description || sel.description}
                              </p>
                            </div>

                            <span className={`text-xs font-black px-3 py-1.5 rounded-lg shadow-sm shrink-0 uppercase tracking-wider ${clsBadge.bg}`}>
                              {clsBadge.label}
                            </span>
                          </div>

                          {/* Geological Properties Table */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">UCS Strength</span>
                              <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                                {sel.ucs_mpa ? `${sel.ucs_mpa} MPa` : 'Soil / Non-rock'}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">RQD Index</span>
                              <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                                {sel.rqd_pct ? `${sel.rqd_pct}%` : 'N/A'}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Bulking Factor</span>
                              <span className="text-base font-extrabold text-amber-700 mt-0.5 block">
                                {sel.bulking_factor}x Loose
                              </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Layer Bank Volume</span>
                              <span className="text-base font-extrabold text-brand-700 mt-0.5 block">
                                {sel.bank_volume_cum?.toLocaleString() || '-'} m³
                              </span>
                            </div>
                          </div>

                          {/* Civil Excavation Methodology & Recommended Plant */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Hammer className="w-3.5 h-3.5 text-amber-600" />
                                Required Excavation & Breaking Methodology
                              </h4>
                              <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                IS 3764 Standard
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                              {sel.excavation_method}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {sel.description}
                            </p>

                            {/* Matched Vehicle Recommendation Badge with Photo Thumbnail */}
                            {(() => {
                              const vehicleKey = sel.excavability_class_num >= 5
                                ? 'drill_rig'
                                : sel.excavability_class_num === 4
                                ? 'breaker'
                                : sel.excavability_class_num === 3
                                ? 'excavator_20t'
                                : sel.excavability_class_num === 2
                                ? 'excavator_20t'
                                : 'backhoe';
                              const vInfo = VEHICLE_IMAGE_MAP[vehicleKey];
                              return vInfo ? (
                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-white p-3 rounded-lg border">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={vInfo.src}
                                      alt={vInfo.label}
                                      className="w-14 h-10 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                                    />
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                        Primary Machinery For This Layer
                                      </span>
                                      <span className="text-xs font-extrabold text-slate-900 block">{vInfo.label}</span>
                                      <span className="text-[10px] text-slate-500">{vInfo.badge}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const matchedM = machinery.find((m) => m.key === vehicleKey);
                                      if (matchedM) setEnlargedVehicle(matchedM);
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors flex items-center gap-1.5 shrink-0"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Machine
                                  </button>
                                </div>
                              ) : null;
                            })()}
                          </div>

                          {/* Water Table impact on this layer */}
                          {sel.below_water_table && (
                            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3.5 text-xs text-cyan-950 flex items-center gap-2.5">
                              <Waves className="w-5 h-5 text-cyan-600 shrink-0" />
                              <span>
                                <strong>Groundwater Ingress:</strong> This stratum lies below the static water table. Slopes require continuous sump-pump dewatering or wellpoints to prevent base heave and piping failure.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-8 text-center text-slate-400 border border-slate-200 rounded-2xl bg-slate-50">
                      Click any strata layer in the core column on the left to inspect its geotechnical parameters.
                    </div>
                  )}

                  {/* Summary of Rocks Found in Report with Colorful Swatches */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Pickaxe className="w-3.5 h-3.5 text-amber-600" />
                        All Identified Geological Formations ({layers.length} Layers)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Total Volume: {selectedReport?.total_excavation_volume_cum?.toLocaleString()} m³
                      </span>
                    </div>

                    {/* Proportional Strata Distribution Bar */}
                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 border border-slate-200 shadow-inner">
                      {layers.map((l, i) => {
                        const theme = getStrataTheme(l.material_key);
                        const pct = selectedReport?.total_excavation_volume_cum
                          ? ((l.bank_volume_cum || 0) / selectedReport.total_excavation_volume_cum) * 100
                          : 100 / layers.length;
                        return (
                          <div
                            key={i}
                            className={`h-full bg-gradient-to-r ${theme.gradient} transition-all`}
                            style={{ width: `${Math.max(5, pct)}%` }}
                            title={`${l.material}: ${pct.toFixed(1)}% (${l.bank_volume_cum?.toLocaleString()} m³)`}
                          />
                        );
                      })}
                    </div>

                    <div className="divide-y divide-slate-100">
                      {layers.map((l, i) => {
                        const theme = getStrataTheme(l.material_key);
                        const clsBadge = getExcavabilityBadge(l.excavability_class_num);
                        const isSelected = selectedLayerIndex === i;

                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedLayerIndex(i)}
                            className={`py-2 px-2.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isSelected ? 'bg-amber-50/80 font-bold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm">{theme.iconSymbol}</span>
                              <span className="font-bold text-slate-900">{l.material}</span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                ({l.top_m.toFixed(1)}m – {l.bottom_m.toFixed(1)}m)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-slate-700 font-semibold">
                                {l.bank_volume_cum?.toLocaleString()} m³
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${clsBadge.bg}`}>
                                {l.excavability_class.split(' - ')[0]}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MACHINERY & EQUIPMENT SELECTION */}
          {activeTab === 'machinery' && (
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-5 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-brand-600" />
                    Recommended Excavation & Drilling Fleet
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sized from strata volume, unconfined compressive strength (UCS), rock mass rating (RMR), and Indian site productivity norms
                  </p>
                </div>
                <div className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                  Peak Fleet Deployment: {summary?.peak_fleet_size || 0} Units
                </div>
              </div>

              {/* Machinery Cards Grid with Real Vehicle Photographs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {machinery.map((m, idx) => {
                  const imgInfo = VEHICLE_IMAGE_MAP[m.key] || {
                    src: '/vehicles/backhoe.jpg',
                    label: m.name,
                    badge: 'Excavation Plant',
                    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
                    description: m.role,
                  };

                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden bg-white flex flex-col justify-between transition-all duration-200 hover:shadow-md group"
                    >
                      <div>
                        {/* High-Resolution Vehicle Photograph Banner */}
                        <div
                          className="relative h-48 w-full overflow-hidden bg-slate-900 cursor-pointer"
                          onClick={() => setEnlargedVehicle(m)}
                          title="Click to view high-resolution vehicle photo"
                        >
                          <img
                            src={imgInfo.src}
                            alt={m.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/25" />

                          {/* Category Badge */}
                          <div className="absolute top-3 left-3">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shadow-xs backdrop-blur-md ${imgInfo.badgeColor}`}>
                              {imgInfo.badge}
                            </span>
                          </div>

                          {/* Unit Count Badge */}
                          <div className="absolute top-3 right-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-white/95 text-slate-950 border border-white/40 shadow-sm">
                              {m.count} {m.count === 1 ? 'Unit' : 'Units'}
                            </span>
                          </div>

                          {/* Vehicle Title & Zoom Action */}
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                            <span className="text-xs font-bold drop-shadow-sm truncate pr-2">
                              {imgInfo.label}
                            </span>
                            <span className="opacity-90 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded flex items-center gap-1 backdrop-blur-xs shrink-0 border border-white/20">
                              <ZoomIn className="w-3 h-3" /> View Photo
                            </span>
                          </div>
                        </div>

                        {/* Card Details Body */}
                        <div className="p-4 space-y-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 leading-tight">{m.name}</h4>
                              <span className="text-[11px] text-slate-500 font-mono block mt-0.5">{m.role}</span>
                            </div>
                          </div>

                          {/* Models & Specification */}
                          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Recommended Machine Models</span>
                              <span className="font-semibold text-slate-800 block mt-0.5">{m.models}</span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200/60">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Operating Specification</span>
                              <span className="text-slate-600 block mt-0.5 font-mono text-[11px]">{m.spec}</span>
                            </div>
                          </div>

                          {/* Why this machine is chosen */}
                          <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
                            <span className="font-semibold text-amber-900 block text-[11px] mb-1 flex items-center gap-1">
                              <Info className="w-3 h-3 text-amber-600" />
                              Engineering Selection Basis:
                            </span>
                            <p className="leading-relaxed text-[11px]">{m.why}</p>
                          </div>
                        </div>
                      </div>

                      {/* Fleet Stats Footer */}
                      <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <span>Day {m.first_day} → Day {m.last_day} ({m.deployment_days} days)</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {m.machine_hours} op. hours
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Haulage & Tipper Trips Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Tipper Haulage & Disposal Requirement</span>
                    <span>
                      Total loose muck volume: <strong className="text-slate-800">{summary?.total_loose_volume_cum?.toLocaleString()} m³</strong>. Sized for approx{' '}
                      <strong className="text-slate-800">{summary?.tipper_trips?.toLocaleString()} tipper trips</strong> (16-20 t dumpers) with 2.0 km disposal lead.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DETAILED TIME-PHASED ACTIVITIES */}
          {activeTab === 'schedule' && (
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-5 shadow-xs space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    placeholder="Search activity name or code..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-64 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />

                  <select
                    aria-label="Filter Activities by Phase"
                    value={selectedPhaseFilter}
                    onChange={(e) => setSelectedPhaseFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ALL">All Phases ({activities.length})</option>
                    {availablePhases.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => setCriticalOnly(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-rose-600">Critical Path Only</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Showing {filteredActivities.length} of {activities.length} planned activities</span>
                  <button
                    onClick={() => setIsPushModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Push to Project Gantt
                  </button>
                </div>
              </div>

              {/* Table of Planned Activities */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3">WBS Code</th>
                      <th className="py-3 px-3">Activity Description</th>
                      <th className="py-3 px-3">Phase</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Schedule Dates</th>
                      <th className="py-3 px-3">Quantity</th>
                      <th className="py-3 px-3">Daily Output</th>
                      <th className="py-3 px-3">Assigned Machinery</th>
                      <th className="py-3 px-3">Predecessors</th>
                      <th className="py-3 px-3 text-center">Critical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActivities.map((act, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${act.is_critical ? 'bg-rose-50/20' : ''}`}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {act.code}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-semibold text-slate-900">{act.name}</div>
                          <div className="text-[10px] text-slate-500 truncate" title={act.method}>
                            {act.method}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {act.phase}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {act.duration_days} d
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {act.start_date} → {act.end_date}
                          <span className="text-slate-400 block text-[10px]">
                            Day {act.start_day} - {act.end_day}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {act.quantity?.toLocaleString()} {act.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {act.daily_output} {act.unit}/d
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {act.equipment?.map((eq, eqIdx) => (
                              <span
                                key={eqIdx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200"
                                title={eq.models}
                              >
                                {eq.count}x {eq.name.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {act.predecessors?.length > 0
                            ? act.predecessors.map((p: any) => (typeof p === 'string' ? p : p.code)).join(', ')
                            : 'None'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {act.is_critical ? (
                            <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-700 border border-rose-200">
                              CRITICAL
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{act.total_float}d float
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Critical Path Flow Strip */}
              {summary?.critical_path && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ActivityIcon className="w-3.5 h-3.5 text-rose-600" />
                    CPM Critical Path Sequence ({summary.critical_path.length} Activities Determining Completion Date)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                    {summary.critical_path.map((cpCode, cpIdx) => (
                      <React.Fragment key={cpIdx}>
                        <span className="px-2 py-1 bg-white border border-rose-300 text-rose-800 rounded font-bold shadow-2xs">
                          {cpCode}
                        </span>
                        {cpIdx < summary.critical_path.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SAFETY, HAZARDS & CONTROLS */}
          {activeTab === 'hazards' && (
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-5 shadow-xs space-y-4">
              <div className="pb-2 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Site Geotechnical Safety & Ground Engineering Controls
                </h3>
                <p className="text-xs text-slate-500">
                  Mandatory civil engineering risk mitigation conforming to IS 3764 (Excavation Safety) and DGMS Blasting Standards
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hazards.map((h, idx) => {
                  const isCritical = h.severity === 'CRITICAL';
                  const isHigh = h.severity === 'HIGH';

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-4 flex flex-col justify-between ${
                        isCritical
                          ? 'border-rose-300 bg-rose-50/50'
                          : isHigh
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isCritical
                                ? 'bg-rose-600 text-white'
                                : isHigh
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {h.severity} RISK
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mb-2">{h.hazard}</h4>
                        <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-slate-200/80">
                          <strong className="text-slate-900 block text-[11px] mb-0.5">Control Measure:</strong>
                          {h.control}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Water Table Special Card */}
              {selectedReport?.water_table_depth_m && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-start gap-3">
                  <Waves className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-cyan-900 space-y-1">
                    <span className="font-bold text-sm block">Groundwater Ingress & Base Boiling Prevention</span>
                    <p>
                      Static water table is recorded at {selectedReport.water_table_depth_m}m below EGL. Since target excavation is {selectedReport.target_depth_m}m,
                      continuous dewatering pumps (submersible slurry pump with 50% standby & backup DG set) must run around the clock to lower groundwater at least 0.5m below formation level.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* UPLOAD / SAMPLE MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-500/10 text-brand-600 rounded-lg">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Geotechnical Report Analysis</h3>
                  <p className="text-xs text-slate-500">Detect rocks, recommend JCB / drill machines, and plan activities</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Mode Switcher */}
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setUploadMode('sample')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    uploadMode === 'sample' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  ⚡ Real-World Sample Reports
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    uploadMode === 'file' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  📄 Upload Document (PDF/DOCX/TXT)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('text')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    uploadMode === 'text' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  ✏️ Paste Report Text
                </button>
              </div>

              {/* Sample Selector */}
              {uploadMode === 'sample' && (
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Choose an authentic geological profile:
                  </span>
                  <div className="space-y-2">
                    {sampleReports.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSample(s)}
                        className="p-3 border border-slate-200 hover:border-brand-500 rounded-xl cursor-pointer hover:bg-brand-50/30 transition-all text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{s.title}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            {s.default_depth}m depth
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px]">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Upload Mode */}
              {uploadMode === 'file' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Select Borelog / Geotechnical PDF, DOCX, XLSX, TXT file:
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx,.txt,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 border border-slate-300 rounded-lg w-full p-2"
                  />
                  {selectedFile && (
                    <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready to analyze: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              )}

              {/* Text Mode */}
              {uploadMode === 'text' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Paste Geotechnical Report or Borehole Stratigraphy Text:
                  </label>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="e.g. Depth 0.0 to 1.5m: Sand fill. Depth 1.5 to 4.0m: Weathered Murrum. Depth 4.0 to 8.5m: Hard Basalt UCS 120 MPa, RQD 75%. Groundwater at 3.5m..."
                    className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Excavation Geometry & Fleet Parameters */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2.5">
                  Excavation Engineering Parameters
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">Target Depth (m)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="40.0"
                      value={targetDepth}
                      onChange={(e) => setTargetDepth(parseFloat(e.target.value) || 6.0)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Excavation Area (m²)</label>
                    <input
                      type="number"
                      step="50"
                      value={excavationArea}
                      onChange={(e) => setExcavationArea(parseFloat(e.target.value) || 1200)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Water Table Depth (m)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Auto-detect"
                      value={waterTableDepth}
                      onChange={(e) => setWaterTableDepth(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Daily Shifts</label>
                    <select
                      value={shiftsPerDay}
                      onChange={(e) => setShiftsPerDay(parseInt(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value={1}>1 Shift (8 hrs)</option>
                      <option value={2}>2 Shifts (16 hrs)</option>
                      <option value={3}>3 Shifts (24 hrs)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={blastingPermitted}
                      onChange={(e) => setBlastingPermitted(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-700">Blasting permitted on site</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={nearStructures}
                      onChange={(e) => setNearStructures(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-700">Near existing structures (vibration control)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleAnalyze}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Geotechnical Strata...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Run Geotechnical AI Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUSH TO MASTER SCHEDULE MODAL */}
      {isPushModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Push Activities to Master Project Schedule</h3>
                  <p className="text-xs text-slate-500">Integrate into Gantt chart, CPM network & monitoring</p>
                </div>
              </div>
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              {pushSuccessMsg ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-sm">Schedule Updated Successfully!</p>
                  <p className="text-xs text-emerald-700">{pushSuccessMsg}</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Activities to create:</span>
                      <strong className="text-slate-900">{activities.length} excavation tasks</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estimated duration:</span>
                      <strong className="text-slate-900">{selectedReport.estimated_total_days} working days</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Governing rock type:</span>
                      <strong className="text-slate-900">{selectedReport.primary_rock_type}</strong>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer select-none bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500 mt-0.5"
                    />
                    <span className="text-[11px] text-amber-900">
                      <strong>Replace existing geotechnical tasks:</strong> If checked, any previously generated GX tasks will be replaced with this revised plan.
                    </span>
                  </label>

                  <p className="text-slate-500 text-[11px]">
                    Once pushed, these activities will immediately become active in the project's Interactive Gantt Chart, Dependency Network, and Daily Site Control.
                  </p>
                </>
              )}
            </div>

            {!pushSuccessMsg && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPushModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPushing}
                  onClick={handlePushToSchedule}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isPushing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Syncing Activities...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Push to Gantt
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VEHICLE PHOTO ZOOM LIGHTBOX MODAL */}
      {enlargedVehicle && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEnlargedVehicle(null)}
        >
          <div
            className="bg-slate-900 text-white rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-72 sm:h-96 w-full bg-black">
              <img
                src={VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.src || '/vehicles/backhoe.jpg'}
                alt={enlargedVehicle.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />
              <button
                onClick={() => setEnlargedVehicle(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm transition-colors border border-white/20"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded border shadow-sm backdrop-blur-md ${VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badgeColor || 'bg-slate-800'}`}>
                    {VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badge}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-white text-slate-950 font-black shadow-sm">
                    {enlargedVehicle.count} {enlargedVehicle.count === 1 ? 'Unit Required' : 'Units Required'}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">{enlargedVehicle.name}</h2>
                <p className="text-slate-300 text-xs mt-0.5">{VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.label}</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Recommended Models</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{enlargedVehicle.models}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Technical Specs</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">{enlargedVehicle.spec}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Machine Hours</span>
                  <span className="font-bold text-amber-400 text-sm mt-0.5 block">{enlargedVehicle.machine_hours} Hours</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Deployment Timeline</span>
                  <span className="font-bold text-emerald-400 text-sm mt-0.5 block">Day {enlargedVehicle.first_day} → Day {enlargedVehicle.last_day}</span>
                </div>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1.5">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">Civil Engineering Justification</span>
                <p className="text-slate-200 leading-relaxed">{enlargedVehicle.why}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
