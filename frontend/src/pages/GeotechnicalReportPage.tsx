import React, { useState, useEffect } from 'react';
import {
  Layers, Pickaxe, Drill, Hammer, Truck, Waves,
  UploadCloud, FileText, CheckCircle2, AlertTriangle, ShieldAlert,
  Calendar, Clock, ArrowRight, RefreshCw, ChevronRight,
  Sparkles, Download, Info, Play, Trash2, ShieldCheck, Activity as ActivityIcon,
  ZoomIn, X, Eye, Rotate3d, GitCompare, FileSpreadsheet, History, HelpCircle,
  Building2, MapPin, Scale, ChevronDown
} from 'lucide-react';
import { Project, GeotechnicalReport, SampleGeotechReport, StrataLayer, MachineryRecommendation, PlannedActivity, GeotechnicalIntelligenceDoc } from '../types';
import { apiClient } from '../api/client';
import { IsometricGeologicalCube } from '../components/IsometricGeologicalCube';
import { SourceBadge } from '../components/geotech/SourceBadge';
import { ViewSourceModal } from '../components/geotech/ViewSourceModal';
import { BoreholeDatabaseView } from '../components/geotech/BoreholeDatabaseView';
import { RiskIntelligenceView } from '../components/geotech/RiskIntelligenceView';
import { MissingDataIntelligenceView } from '../components/geotech/MissingDataIntelligenceView';
import { GeotechAuditTrail } from '../components/geotech/GeotechAuditTrail';
import { ThreeDGeologicalView } from '../components/geotech/ThreeDGeologicalView';
import { ReportUploadModal } from '../components/geotech/ReportUploadModal';
import { GeotechnicalCompareModal } from '../components/geotech/GeotechnicalCompareModal';
import { FiveLayersAndPipelineView } from '../components/geotech/FiveLayersAndPipelineView';
import { SptAndPropertiesView } from '../components/geotech/SptAndPropertiesView';
import { VEHICLE_IMAGE_MAP, STRATA_THEMES, getStrataTheme, getExcavabilityBadge } from './GeotechnicalReportPageConstants';
export { VEHICLE_IMAGE_MAP, STRATA_THEMES, getStrataTheme, getExcavabilityBadge };

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
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | number | null>(null);
  const [currentIntelDoc, setCurrentIntelDoc] = useState<GeotechnicalIntelligenceDoc | null>(null);
  const [sampleReports, setSampleReports] = useState<SampleGeotechReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'five_layers'
    | 'spt_and_properties'
    | 'boreholes'
    | 'layers'
    | 'machinery'
    | '3d_cutaway'
    | 'stratigraphy'
    | 'soil'
    | 'rock'
    | 'groundwater'
    | 'foundation'
    | 'excavation'
    | 'concrete'
    | 'laboratory'
    | 'calculations'
    | 'risks'
    | 'missing_data'
    | 'audit'
    | 'schedule'
  >('five_layers');

  const [enlargedVehicle, setEnlargedVehicle] = useState<any | null>(null);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [inspectField, setInspectField] = useState<{ title: string; data: any } | null>(null);

  // Push to schedule state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);

  const projectId = project?.id;

  // Load report list
  const loadReportsList = async () => {
    setIsLoading(true);
    try {
      const [allReports, samples] = await Promise.all([
        apiClient.getAllGeotechReports(projectId),
        projectId ? apiClient.getGeotechnicalSampleReports(projectId).catch(() => []) : Promise.resolve([]),
      ]);
      setReports(allReports);
      setSampleReports(samples);
      if (allReports.length > 0 && !selectedReportId) {
        setSelectedReportId(allReports[0].id);
      }
    } catch (err) {
      console.error('Error fetching geotechnical reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportsList();
  }, [projectId]);

  // Load selected report intelligence document
  useEffect(() => {
    if (!selectedReportId) {
      setCurrentIntelDoc(null);
      return;
    }
    const fetchDoc = async () => {
      setIsLoading(true);
      try {
        const doc = await apiClient.getGeotechIntelligence(selectedReportId);
        setCurrentIntelDoc(doc);
      } catch (err) {
        console.error('Failed to load report intelligence document:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoc();
  }, [selectedReportId]);

  // Reset state on new upload (Requirement 35)
  const handleUploadSuccess = (newDoc: any) => {
    setCurrentIntelDoc(null);
    setSelectedReportId(newDoc.id || newDoc.report_id);
    loadReportsList();
    setActiveTab('overview');
  };

  // Export handlers
  const handleExportPDF = async () => {
    if (!selectedReportId) return;
    try {
      const blob = await apiClient.exportGeotechPDF(selectedReportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Geotechnical_Intelligence_${selectedReportId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedReportId) return;
    try {
      const blob = await apiClient.exportGeotechExcel(selectedReportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Geotechnical_Intelligence_${selectedReportId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export failed:', err);
    }
  };

  const handleExportJSON = () => {
    if (!currentIntelDoc) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentIntelDoc, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Geotechnical_Intelligence_${currentIntelDoc.report_id}.json`;
    a.click();
  };

  const handleExportStandardJSON = () => {
    if (!currentIntelDoc) return;
    const stdJson = currentIntelDoc.standard_json || currentIntelDoc.five_intelligence_layers || currentIntelDoc;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(stdJson, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Geotechnical_Standard_5Layers_${currentIntelDoc.report_id}.json`;
    a.click();
  };

  const [boqSyncStatus, setBoqSyncStatus] = useState<string | null>(null);
  const [isSyncingBoq, setIsSyncingBoq] = useState(false);

  const handleSyncToBOQ = async () => {
    if (!selectedReportId) return;
    setIsSyncingBoq(true);
    setBoqSyncStatus(null);
    try {
      const res = await apiClient.syncGeotechToBOQ(selectedReportId);
      setBoqSyncStatus(res.message || 'Geotechnical items synced to BOQ');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to sync geotech items to BOQ:', err);
      setBoqSyncStatus('Sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSyncingBoq(false);
    }
  };

  // Push to Schedule handler
  const handlePushToSchedule = async () => {
    if (!projectId || !selectedReportId) return;
    setIsPushing(true);
    setPushSuccessMsg(null);
    try {
      const repIdNum = typeof selectedReportId === 'number' ? selectedReportId : Number(selectedReportId);
      await apiClient.pushGeotechnicalToSchedule(projectId, repIdNum, {
        replace_existing: replaceExisting,
      });
      setPushSuccessMsg('Geotechnical excavation activities successfully synchronized with master CPM schedule.');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Push to schedule error:', err);
    } finally {
      setIsPushing(false);
    }
  };

  // Helper for Inspecting a Source-Grounded Field
  const openFieldInspect = (title: string, fieldData: any) => {
    if (!fieldData) return;
    setInspectField({ title, data: fieldData });
  };

  // Short helpers for dynamic current report access
  const pInfo = currentIntelDoc?.project_information;
  const invInfo = currentIntelDoc?.investigation_information;
  const bhList = currentIntelDoc?.boreholes || [];
  const stratList = currentIntelDoc?.stratigraphy || [];
  const soilData = currentIntelDoc?.soil_analysis;
  const rockData = currentIntelDoc?.rock_analysis;
  const gwData = currentIntelDoc?.groundwater_analysis;
  const foundData = currentIntelDoc?.foundation_recommendations;
  const excData = currentIntelDoc?.excavation_analysis;
  const concData = currentIntelDoc?.concrete_protection;
  const labList = currentIntelDoc?.laboratory_results || [];
  const calcList = currentIntelDoc?.report_calculations || [];
  const valData = currentIntelDoc?.validation;
  const riskList = currentIntelDoc?.risks || [];
  const missingList = currentIntelDoc?.missing_data || [];
  const auditList = currentIntelDoc?.audit_trail || [];

  // Top Cards dynamically populated (Section 20 & Requirement 34)
  const cwrRange = bhList.length > 0 ? `${Math.min(...bhList.map((b) => b.cwr_depth))}–${Math.max(...bhList.map((b) => b.cwr_depth))} m` : 'Not specified';
  const hrRange = bhList.length > 0 ? `${Math.min(...bhList.map((b) => b.hard_rock_depth))}–${Math.max(...bhList.map((b) => b.hard_rock_depth))} m` : 'Not specified';

  const defaultMachineryList: MachineryRecommendation[] = [
    {
      key: 'backhoe',
      name: 'JCB Backhoe Loader (3DX Super)',
      models: 'JCB 3DX Super / 3DX Xtra / 4DX',
      spec: '76 HP diesel, 0.24 m³ backhoe bucket, 1.0 m³ front shovel, 4.8 m max reach',
      role: 'Soft Dig & Trimming',
      count: 1,
      first_day: 1,
      last_day: 12,
      machine_hours: 96,
      deployment_days: 12,
      activities: ['GX-01', 'GX-04'],
      why: 'Excavation of topsoil and loose fill, utility trenching, trimming side slopes, and site formation levelling.',
    },
    {
      key: 'excavator_20t',
      name: '20-22 Ton Heavy Hydraulic Excavator',
      models: 'Tata Hitachi EX200 / CAT 320D / Komatsu PC210-10M0',
      spec: '140-165 HP, 1.0-1.2 m³ heavy-duty rock bucket, 9.5 m reach, 21.5 tonne operating weight',
      role: 'Rock Bucket & Bulk Mucking',
      count: 2,
      first_day: 3,
      last_day: 28,
      machine_hours: 416,
      deployment_days: 26,
      activities: ['GX-04', 'GX-11', 'GX-12'],
      why: 'Heavy bulk excavation of dense weathered rock, fractured strata, and muck loading into dump trucks.',
    },
    {
      key: 'breaker',
      name: 'Hydraulic Rock Breaker / Hammer',
      models: 'Montabert V1800 / Epiroc SB 452 / Furukawa F22',
      spec: '1,800-2,500 kg hammer weight, 4,500-6,000 J impact energy, 400-800 bpm',
      role: 'Rock Fracturing & Splitting',
      count: 2,
      first_day: 7,
      last_day: 25,
      machine_hours: 288,
      deployment_days: 19,
      activities: ['GX-12', 'GX-13'],
      why: 'Fracturing hard basalt / bedrock horizons where explosive blasting is prohibited by urban proximity.',
    },
    {
      key: 'drill_rig',
      name: 'Crawler DTH Blast-Hole Drill Rig',
      models: 'Atlas Copco ECM 590 / Sandvik DI550 / Ingersoll Rand LM 100',
      spec: '89-115 mm hole dia, 18-22 m depth capacity, onboard screw compressor',
      role: 'Class V Bedrock Drilling',
      count: 1,
      first_day: 10,
      last_day: 22,
      machine_hours: 192,
      deployment_days: 13,
      activities: ['GX-13'],
      why: 'Drilling line holes for controlled fracturing and non-explosive expanding grout holes in competent rock.',
    },
    {
      key: 'tipper',
      name: '10-Wheel Heavy Tipper / Dumper Truck',
      models: 'Tata Prima 2830.K / BharatBenz 2828C / Ashok Leyland 2820',
      spec: '16-18 m³ box body, 28-tonne GVW, multi-axle heavy-duty tipping ram',
      role: 'High-Capacity Spoil Haulage',
      count: 4,
      first_day: 3,
      last_day: 30,
      machine_hours: 864,
      deployment_days: 28,
      activities: ['GX-04', 'GX-11', 'GX-12', 'GX-13'],
      why: 'Transporting excavated muck and blasted rock from the pit to designated municipal dumping sites.',
    },
    {
      key: 'compressor',
      name: 'Portable High-Pressure Air Compressor',
      models: 'Atlas Copco XAHS 450 / Elgi PG 600-200 / Doosan 7/120',
      spec: '450-600 CFM free air delivery at 10-17 bar operating pressure, CAT diesel drive',
      role: '600 CFM Air Supply',
      count: 1,
      first_day: 10,
      last_day: 24,
      machine_hours: 224,
      deployment_days: 15,
      activities: ['GX-13'],
      why: 'Supplying compressed air to crawler drill rigs, pneumatic jackhammers, and blow-out cleaning of founding rock.',
    },
    {
      key: 'pump',
      name: 'Submersible Dewatering Slurry Pump',
      models: 'Flygt 2151 / Kirloskar KS6 / Tsurumi KTZ 615',
      spec: '15-22 kW electric submersible, 120-180 m³/hr discharge capacity, solids up to 40 mm',
      role: 'Groundwater Ingress Control',
      count: 2,
      first_day: 5,
      last_day: 32,
      machine_hours: 432,
      deployment_days: 28,
      activities: ['GX-05'],
      why: 'Lowering groundwater ingress and dewatering foundation pits to allow dry inspection and concrete pouring.',
    },
    {
      key: 'plate_compactor',
      name: 'Heavy Formation Plate Compactor',
      models: 'Wacker Neuson DPU 6555 / Ammann APH 65/85',
      spec: '500 kg machine weight, 65 kN centrifugal force, reversible hydraulic drive',
      role: 'Subgrade Compaction',
      count: 2,
      first_day: 28,
      last_day: 34,
      machine_hours: 96,
      deployment_days: 7,
      activities: ['GX-20'],
      why: 'Compaction and dressing of the formation founding subgrade prior to laying PCC blinding concrete.',
    },
  ];

  const machineryList: MachineryRecommendation[] = (currentIntelDoc?.recommended_machinery && currentIntelDoc.recommended_machinery.length > 0)
    ? currentIntelDoc.recommended_machinery
    : defaultMachineryList;

  const rawLayersList: StrataLayer[] = (currentIntelDoc?.strata_layers && currentIntelDoc.strata_layers.length > 0)
    ? currentIntelDoc.strata_layers
    : stratList.map((s, idx) => {
        const top = typeof s.top_depth === 'number' ? s.top_depth : parseFloat(String(s.top_depth)) || idx * 1.5;
        const bot = typeof s.bottom_depth === 'number' ? s.bottom_depth : parseFloat(String(s.bottom_depth)) || (idx + 1) * 1.5;
        const thk = Math.max(0.5, bot - top);
        const isRock = Boolean(
          s.material_type?.toLowerCase().includes('rock') ||
          s.layer_name?.toLowerCase().includes('rock') ||
          s.layer_name?.toLowerCase().includes('basalt') ||
          s.layer_name?.toLowerCase().includes('breccia')
        );
        const excavClassNum = isRock ? 4 : (top > 1.5 ? 2 : 1);
        return {
          material_key: isRock ? 'hard_rock' : (top > 1.5 ? 'murrum' : 'fill'),
          material: s.layer_name,
          category: s.material_type || (isRock ? 'Hard Rock' : 'Dense Soil'),
          is_rock: isRock,
          description: s.description || `${s.layer_name} stratum logged in subsurface investigation.`,
          color: isRock ? '#0891b2' : '#ea580c',
          top_m: top,
          bottom_m: bot,
          thickness_m: thk,
          ucs_mpa: isRock ? 65 : undefined,
          rqd_pct: isRock ? 45 : undefined,
          bulking_factor: isRock ? 1.55 : 1.25,
          excavability_class_num: excavClassNum,
          excavability_class: `Class ${excavClassNum} - ${isRock ? 'Hydraulic Rock Breaking' : 'Direct Bucket Digging'}`,
          excavation_method: isRock ? 'Heavy hydraulic breaker / rock bucket' : 'Backhoe loader / crawler excavator',
          recommended_machinery: isRock ? ['excavator_20t', 'breaker', 'tipper'] : ['backhoe', 'tipper'],
        };
      });

  const synthesizedReport: GeotechnicalReport = {
    id: typeof selectedReportId === 'number' ? selectedReportId : 1,
    project_id: projectId || 1,
    report_title: currentIntelDoc?.project_information?.project_name?.display || 'Geotechnical Investigation Report',
    primary_rock_type: currentIntelDoc?.rock_analysis?.rock_type?.display || 'Basalt Bedrock',
    strata_classification: 'Subsurface Stratigraphy',
    excavability_class: currentIntelDoc?.excavation_analysis?.excavability_class?.display || 'Class IV - Hydraulic Rock Breaking',
    excavation_area_sqm: 1200,
    target_depth_m: 15,
    total_excavation_volume_cum: 18000,
    rock_volume_cum: 12000,
    overburden_volume_cum: 6000,
    estimated_total_days: 28,
    strata_layers: rawLayersList,
    rock_types: (currentIntelDoc?.rock_types || []) as any,
    recommended_machinery: machineryList,
    planned_activities: (currentIntelDoc?.planned_activities || []) as any,
    hazard_controls: [],
    summary: (currentIntelDoc?.summary || {
      total_working_days: 28,
      calendar_days: 35,
      start_date: '2026-10-01',
      finish_date: '2026-11-05',
      excavation_window_days: 24,
      total_bank_volume_cum: 18000,
      rock_bank_volume_cum: 12000,
      soil_bank_volume_cum: 6000,
      total_loose_volume_cum: 24500,
      rock_share_pct: 66.7,
      tipper_trips: 1250,
      governing_class: 'Class IV - Hydraulic Breaking',
      governing_class_num: 4,
      governing_material: 'Basalt Bedrock',
      blasting_required: false,
      dewatering_required: true,
      critical_path: ['GX-01', 'GX-04', 'GX-11', 'GX-12', 'GX-20'],
      phases: [],
      total_machine_hours: 2200,
      total_man_days: 450,
      peak_fleet_size: 11,
      assumptions: [],
    }) as any,
    status: 'ANALYZED',
    created_at: currentIntelDoc?.created_at || new Date().toISOString(),
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Header Bar: Document Control, Report Switcher & Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <Pickaxe className="w-5 h-5 text-amber-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Geotechnical Report Intelligence
                </h1>
                {currentIntelDoc && (
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {currentIntelDoc.report_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Source-grounded borehole parsing, strata characterization & engineering validation
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Report Selector */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Multi-report switcher */}
          {reports.length > 0 && (
            <div className="relative">
              <select
                value={selectedReportId || ''}
                onChange={(e) => setSelectedReportId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 focus:outline-hidden cursor-pointer"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.report_id || `GT-${r.id}`}: {r.project_name || r.filename}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Report (PDF)</span>
          </button>

          {/* Compare Button */}
          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-slate-500" />
            <span>Compare</span>
          </button>

          {/* Sync to BOQ Button */}
          <button
            onClick={handleSyncToBOQ}
            disabled={!selectedReportId || isSyncingBoq}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            title="Sync geotechnical foundation/excavation items directly into project BOQ"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSyncingBoq ? 'Syncing...' : 'Sync to BOQ'}</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <button
            onClick={handleExportPDF}
            disabled={!currentIntelDoc}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
            title="Export Engineering PDF Report"
          >
            <FileText className="w-4 h-4 text-rose-600" />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!currentIntelDoc}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
            title="Export Multi-Sheet Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            onClick={handleExportStandardJSON}
            disabled={!currentIntelDoc}
            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold disabled:opacity-50 transition-colors"
            title="Export Standard 5-Layers JSON"
          >
            <Download className="w-4 h-4 text-indigo-600" />
          </button>

          <button
            onClick={handleExportJSON}
            disabled={!currentIntelDoc}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors"
            title="Export Raw JSON"
          >
            <Download className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* BOQ Sync Feedback Banner */}
      {boqSyncStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{boqSyncStatus}</span>
          </div>
          <button
            onClick={() => setBoqSyncStatus(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (Section 20 - dynamically populated from JSON) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Boreholes Count */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Boreholes
          </span>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {bhList.length > 0 ? bhList.length : invInfo?.number_of_boreholes?.display || '0'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            {bhList.map((b) => b.borehole_id).join(', ') || 'None identified'}
          </span>
        </div>

        {/* Investigation Depth */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Invest. Depth
          </span>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {invInfo?.investigation_depth_m?.display || 'Not specified'}
          </div>
          <span className="text-[10px] text-slate-500 block">Termination datum</span>
        </div>

        {/* Groundwater Depth */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            Groundwater
          </span>
          <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
            {gwData?.observed_depth?.display || 'Not specified'}
          </div>
          <span className="text-[10px] text-slate-500 block">Below Ground Level</span>
        </div>

        {/* CWR Depth Range */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block font-mono">
            CWR Strata
          </span>
          <div className="text-lg font-bold text-amber-900 mt-1 font-mono">
            {cwrRange}
          </div>
          <span className="text-[10px] text-amber-700/80 block">Completely Weathered</span>
        </div>

        {/* Hard Rock Depth Range */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block font-mono">
            Hard Rock
          </span>
          <div className="text-lg font-bold text-cyan-900 mt-1 font-mono">
            {hrRange}
          </div>
          <span className="text-[10px] text-cyan-700/80 block truncate">
            {rockData?.rock_type?.display || 'Bedrock formation'}
          </span>
        </div>

        {/* Bearing Capacity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block font-mono">
            Bearing Capacity
          </span>
          <div className="text-lg font-bold text-emerald-900 mt-1 font-mono">
            {foundData?.net_allowable_bearing_capacity?.display || 'Not specified'}
          </div>
          <span className="text-[10px] text-emerald-700/80 block">Net Safe Capacity</span>
        </div>

        {/* Maximum Settlement */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
            Settlement
          </span>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {foundData?.maximum_settlement?.display || 'Not specified'}
          </div>
          <span className="text-[10px] text-slate-500 block">Design Limit</span>
        </div>
      </div>

      {/* 3. Horizontal Navigation Sub-Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-3 overflow-x-auto bg-slate-50/70">
          {[
            { id: 'five_layers', label: '5 Intelligence Layers & Pipeline', icon: Sparkles },
            { id: 'spt_and_properties', label: 'SPT & Properties', icon: ActivityIcon },
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'boreholes', label: 'Boreholes', count: bhList.length, icon: Drill },
            { id: 'layers', label: 'Layer Parsing', count: rawLayersList.length, icon: Layers },
            { id: 'machinery', label: 'Construction Vehicles', count: machineryList.length, icon: Truck },
            { id: '3d_cutaway', label: '3D Cutaway Cube', icon: Rotate3d },
            { id: 'stratigraphy', label: 'Stratigraphy (Raw)', icon: Layers },
            { id: 'soil', label: 'Soil Analysis', icon: Scale },
            { id: 'rock', label: 'Rock Characterization', icon: Pickaxe },
            { id: 'groundwater', label: 'Groundwater', icon: Waves },
            { id: 'foundation', label: 'Foundation', icon: Building2 },
            { id: 'excavation', label: 'Excavation', icon: Pickaxe },
            { id: 'concrete', label: 'Concrete Protection', icon: ShieldCheck },
            { id: 'laboratory', label: 'Lab Results', count: labList.length, icon: Scale },
            { id: 'calculations', label: 'Calculations', count: calcList.length, icon: FileText },
            { id: 'risks', label: 'Risks', count: riskList.length, icon: ShieldAlert },
            { id: 'missing_data', label: 'Missing Data', count: missingList.length, icon: HelpCircle },
            { id: 'audit', label: 'Audit Trail', count: auditList.length, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-white font-bold shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-brand-100 text-brand-800 font-bold' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. Tab Content Panels */}
        <div className="p-6">
          {/* TAB: 5 INTELLIGENCE LAYERS & PIPELINE */}
          {activeTab === 'five_layers' && currentIntelDoc && (
            <FiveLayersAndPipelineView
              currentIntelDoc={currentIntelDoc}
              onNavigateTab={setActiveTab}
              onExportStandardJSON={handleExportStandardJSON}
              selectedReportId={selectedReportId || 1}
            />
          )}

          {/* TAB: SPT & ENGINEERING PROPERTIES */}
          {activeTab === 'spt_and_properties' && currentIntelDoc && (
            <SptAndPropertiesView
              intelDoc={currentIntelDoc}
            />
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Validation Banner */}
              {valData && (
                <div
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
                    valData.is_valid
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-xs uppercase tracking-wider font-mono">
                        ENGINEERING VALIDATION STATUS: {valData.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      {valData.passed_checks.map((chk: string, i: number) => (
                        <span key={i} className="flex items-center gap-1 text-[11px]">
                          ✓ {chk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    Validated: {new Date(valData.validation_timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Project & Investigation Two-Column Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Information Card (Section 3) */}
                <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-brand-600" />
                      <span>Project Information</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Section 3.0</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: 'Project Name', key: 'project_name' },
                      { label: 'Client / Developer', key: 'client' },
                      { label: 'Site Location', key: 'location' },
                      { label: 'Building Structure', key: 'building_configuration' },
                      { label: 'Number of Floors', key: 'number_of_floors' },
                      { label: 'Investigation Date', key: 'investigation_date' },
                      { label: 'Report Date', key: 'report_date' },
                      { label: 'Geotechnical Consultant', key: 'consultant' },
                      { label: 'Report Number', key: 'report_number' },
                      { label: 'Revision', key: 'revision_number' },
                    ].map(({ label, key }) => {
                      const field = pInfo?.[key];
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">{label}</span>
                            <span className="font-bold text-slate-800 font-mono">
                              {field?.display || 'Not specified in report'}
                            </span>
                          </div>
                          {field && (
                            <SourceBadge
                              sourceType={field.source_type}
                              confidence={field.confidence}
                              page={field.source_page}
                              onViewSource={() => openFieldInspect(label, field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Investigation Information Card (Section 4) */}
                <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Drill className="w-4 h-4 text-brand-600" />
                      <span>Investigation Methodology & Standards</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Section 4.0</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: 'Number of Boreholes', key: 'number_of_boreholes' },
                      { label: 'Borehole IDs', key: 'borehole_ids' },
                      { label: 'Investigation Depth', key: 'investigation_depth_m' },
                      { label: 'Drilling Methodology', key: 'drilling_method' },
                      { label: 'SPT Methodology', key: 'spt_methodology' },
                      { label: 'Rock Coring Method', key: 'rock_coring_methodology' },
                      { label: 'Relevant IS Standards', key: 'relevant_is_standards' },
                      { label: 'Laboratory Testing Scope', key: 'laboratory_testing_information' },
                    ].map(({ label, key }) => {
                      const field = invInfo?.[key];
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                          <div className="max-w-[65%]">
                            <span className="text-[10px] text-slate-400 font-semibold block">{label}</span>
                            <span className="font-bold text-slate-800 font-mono break-words">
                              {field?.display || 'Not specified in report'}
                            </span>
                          </div>
                          {field && (
                            <SourceBadge
                              sourceType={field.source_type}
                              confidence={field.confidence}
                              page={field.source_page}
                              onViewSource={() => openFieldInspect(label, field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BOREHOLES */}
          {activeTab === 'boreholes' && (
            <BoreholeDatabaseView boreholes={bhList} />
          )}

          {/* TAB: LAYER PARSING & STRATA */}
          {activeTab === 'layers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-600" />
                    <span>Layer-by-Layer Subsurface Parsing & Engineering Specifications</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive geological stratification, excavability classifications (Class I–V), bulking expansions & equipment assignment.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('3d_cutaway')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-colors shadow-2xs"
                  >
                    <Rotate3d className="w-3.5 h-3.5" />
                    View 3D Cube Cutaway
                  </button>
                  <SourceBadge sourceType="REPORT" confidence="HIGH" />
                </div>
              </div>

              {/* Stratum Layer Cards Grid */}
              <div className="space-y-4">
                {rawLayersList.map((layer, idx) => {
                  const theme = getStrataTheme(layer.material_key || layer.material);
                  const cls = getExcavabilityBadge(layer.excavability_class_num);
                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border bg-white border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0 bg-gradient-to-br ${theme.gradient} text-white`}>
                            {theme.iconSymbol}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Layer {idx + 1} • {layer.category}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-2xs ${cls.bg}`}>
                                Class {layer.excavability_class_num}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900 mt-0.5">
                              {layer.material}
                            </h4>
                            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                              {layer.description}
                            </p>
                          </div>
                        </div>

                        {/* Depth & Thickness Pill */}
                        <div className="flex items-center gap-4 text-xs font-mono self-end lg:self-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-sans">Depth Range</span>
                            <span className="font-bold text-slate-800">
                              {layer.top_m}m – {layer.bottom_m}m
                            </span>
                          </div>
                          <div className="h-7 w-px bg-slate-200" />
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-sans">Thickness</span>
                            <span className="font-bold text-brand-700">
                              {layer.thickness_m.toFixed(2)} m
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Technical Parameters Matrix */}
                      <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Excavability</span>
                          <span className="font-bold text-slate-800 mt-0.5 block truncate" title={cls.label}>
                            {cls.label}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Bulking Factor</span>
                          <span className="font-bold text-amber-700 mt-0.5 block font-mono">
                            {layer.bulking_factor || 1.25}x (+{Math.round(((layer.bulking_factor || 1.25) - 1) * 100)}% Loose)
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Compressive Strength</span>
                          <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                            {layer.ucs_mpa ? `${layer.ucs_mpa} MPa` : 'Soil Horizon'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Rock Quality (RQD)</span>
                          <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                            {layer.rqd_pct ? `${layer.rqd_pct}%` : 'N/A (Soil)'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 col-span-2">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Excavation Method</span>
                          <span className="font-semibold text-slate-700 mt-0.5 block truncate" title={layer.excavation_method}>
                            {layer.excavation_method || cls.desc}
                          </span>
                        </div>
                      </div>

                      {/* Recommended Machinery Chips */}
                      {layer.recommended_machinery && layer.recommended_machinery.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Required Machinery:
                          </span>
                          {layer.recommended_machinery.map((mKey: string) => {
                            const vMeta = VEHICLE_IMAGE_MAP[mKey];
                            return (
                              <span
                                key={mKey}
                                onClick={() => setActiveTab('machinery')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
                              >
                                <Truck className="w-3 h-3 text-slate-500" />
                                <span>{vMeta?.label || mKey}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: CONSTRUCTION FLEET & MACHINERY */}
          {activeTab === 'machinery' && (
            <div className="space-y-6">
              {/* Header and Sync Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-brand-600" />
                    <span>Construction Fleet & Machinery Sizing Engine</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sized from stratum rock hardness (UCS), bulking expansion, haul lead times & Indian site productivity norms.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsPushModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Push Plan to Master Schedule
                  </button>
                  <SourceBadge sourceType="CALCULATED" />
                </div>
              </div>

              {/* Fleet Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Total Machine Hours
                  </span>
                  <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
                    {machineryList.reduce((acc, m) => acc + (m.machine_hours || 0), 0)} Hours
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Across all scheduled tasks</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Peak Fleet Size
                  </span>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                    {machineryList.reduce((acc, m) => acc + (m.count || 0), 0)} Units
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Heavy earthmoving equipment</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Working Shifts
                  </span>
                  <div className="text-xl font-bold text-brand-700 mt-1 font-mono">
                    1 Shift (8 hrs)
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Day shift operation norm</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Excavation Window
                  </span>
                  <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
                    {Math.max(...machineryList.map((m) => m.last_day || 30))} Days
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Day 1 to Pit Handover</span>
                </div>
              </div>

              {/* Grid of Equipment Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {machineryList.map((mach, idx) => {
                  const vMeta = VEHICLE_IMAGE_MAP[mach.key] || {
                    src: '/vehicles/backhoe.png',
                    label: mach.name,
                    badge: mach.role,
                    badgeColor: 'bg-slate-100 text-slate-900 border-slate-300',
                    description: mach.why,
                  };
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group"
                    >
                      <div>
                        {/* Vehicle Image Header with Zoom Trigger */}
                        <div
                          className="h-44 relative overflow-hidden bg-slate-900 cursor-pointer"
                          onClick={() => setEnlargedVehicle(mach)}
                        >
                          <img
                            src={vMeta.src}
                            alt={mach.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-xs backdrop-blur-md ${vMeta.badgeColor}`}>
                              {vMeta.badge}
                            </span>
                          </div>

                          <div className="absolute top-2.5 right-2.5">
                            <span className="p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors block">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between text-white">
                            <div>
                              <h4 className="font-extrabold text-sm leading-tight drop-shadow-md">
                                {mach.name}
                              </h4>
                              <span className="text-[10px] text-slate-300 drop-shadow-sm block">
                                {mach.models || vMeta.label}
                              </span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-white text-slate-900 font-black shadow-xs shrink-0">
                              {mach.count} {mach.count === 1 ? 'Unit' : 'Units'}
                            </span>
                          </div>
                        </div>

                        {/* Specifications Body */}
                        <div className="p-4 space-y-3 text-xs">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">
                              Technical Spec
                            </span>
                            <p className="text-slate-700 font-medium text-[11px] leading-relaxed">
                              {mach.spec}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-mono text-[11px]">
                            <div className="bg-slate-50 p-2 rounded-xl">
                              <span className="text-[9px] text-slate-400 block font-sans uppercase">Total Machine Hrs</span>
                              <span className="font-bold text-amber-700">{mach.machine_hours} hrs</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl">
                              <span className="text-[9px] text-slate-400 block font-sans uppercase">Timeline</span>
                              <span className="font-bold text-emerald-700">Day {mach.first_day}–{mach.last_day}</span>
                            </div>
                          </div>

                          {/* Civil Engineering Justification */}
                          <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-950 leading-relaxed">
                            <strong className="block text-[10px] text-amber-800 uppercase tracking-wider mb-0.5">
                              Justification
                            </strong>
                            {mach.why}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          onClick={() => setEnlargedVehicle(mach)}
                          className="text-brand-600 hover:text-brand-700 font-semibold text-[11px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View Specs & Photo
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {mach.deployment_days || (mach.last_day - mach.first_day + 1)} Days Active
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: STRATIGRAPHY */}
          {activeTab === 'stratigraphy' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Geological Stratigraphy Profile (Verbatim Preserved Terminology)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Actual terminology from the report is preserved. Never auto-renamed.
                  </p>
                </div>
                <SourceBadge sourceType="REPORT" confidence="HIGH" />
              </div>

              <div className="space-y-3">
                {stratList.map((layer, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border bg-white border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                          layer.material_type === 'Rock' ? 'bg-cyan-600' : 'bg-amber-600'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                          {layer.layer_title}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{layer.layer_name}</h4>
                        <p className="text-xs text-slate-600 mt-1 max-w-2xl">{layer.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-sans">Depth Range</span>
                        <span className="font-bold text-slate-800">
                          {layer.top_depth}m – {layer.bottom_depth}m
                        </span>
                      </div>
                      <SourceBadge
                        sourceType="REPORT"
                        confidence={layer.confidence}
                        page={layer.source_page}
                        onViewSource={() =>
                          openFieldInspect(layer.layer_name, {
                            display: `${layer.top_depth}m to ${layer.bottom_depth}m`,
                            source_type: 'REPORT',
                            source_page: layer.source_page,
                            source_text: layer.source_text,
                            confidence: layer.confidence,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SOIL ANALYSIS */}
          {activeTab === 'soil' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Soil Conditions & Mechanical Properties</h3>
                  <p className="text-xs text-slate-500">Overburden soil strata, SPT values, density, and shear limits.</p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Soil Type', key: 'soil_type' },
                  { label: 'Soil Description', key: 'soil_description' },
                  { label: 'Density / Consistency', key: 'density_consistency' },
                  { label: 'SPT N Values', key: 'spt_n' },
                  { label: 'Depth Range', key: 'depth_range' },
                  { label: 'Cohesion', key: 'cohesion' },
                  { label: 'Friction Angle', key: 'friction_angle' },
                ].map(({ label, key }) => {
                  const field = soilData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                        <SourceBadge
                          sourceType={field?.source_type}
                          confidence={field?.confidence}
                          page={field?.source_page}
                          onViewSource={() => openFieldInspect(label, field)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: ROCK ANALYSIS */}
          {activeTab === 'rock' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Rock Characterization & Bedrock Quality</h3>
                  <p className="text-xs text-slate-500">
                    Core recovery, RQD, unconfined compressive strength ranges, and calculated MPa conversion.
                  </p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Rock Type', key: 'rock_type' },
                  { label: 'Rock Depth Range', key: 'depth_range' },
                  { label: 'Core Recovery (CR)', key: 'core_recovery' },
                  { label: 'Rock Quality Designation (RQD)', key: 'rqd' },
                  { label: 'Compressive Strength (UCS)', key: 'compressive_strength' },
                  { label: 'Equivalent MPa (Unit Conversion)', key: 'compressive_strength_mpa_equivalent' },
                ].map(({ label, key }) => {
                  const field = rockData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                        <SourceBadge
                          sourceType={field?.source_type}
                          confidence={field?.confidence}
                          page={field?.source_page}
                          onViewSource={() => openFieldInspect(label, field)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: GROUNDWATER */}
          {activeTab === 'groundwater' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Groundwater Levels & Chemical Characteristics</h3>
                  <p className="text-xs text-slate-500">Static groundwater table, seasonal fluctuations, and water chemistry.</p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Observed Water Depth', key: 'observed_depth' },
                  { label: 'Seasonal Variation', key: 'seasonal_variation' },
                  { label: 'Groundwater Status', key: 'groundwater_status' },
                  { label: 'Water Chemistry / Corrosivity', key: 'water_chemistry' },
                ].map(({ label, key }) => {
                  const field = gwData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <SourceBadge
                        sourceType={field?.source_type}
                        confidence={field?.confidence}
                        page={field?.source_page}
                        onViewSource={() => openFieldInspect(label, field)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: FOUNDATION */}
          {activeTab === 'foundation' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Foundation Recommendations</h3>
                  <p className="text-xs text-slate-500">
                    Geotechnical engineer's recommendation. Clearly distinguishes report from AI recommendations.
                  </p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Recommended Foundation Type', key: 'foundation_type' },
                  { label: 'Supporting Strata Layer', key: 'supporting_layer' },
                  { label: 'Net Allowable Bearing Capacity', key: 'net_allowable_bearing_capacity' },
                  { label: 'Maximum Settlement Limit', key: 'maximum_settlement' },
                  { label: 'Modulus of Subgrade Reaction', key: 'subgrade_reaction_modulus' },
                ].map(({ label, key }) => {
                  const field = foundData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                        <SourceBadge
                          sourceType={field?.source_type}
                          confidence={field?.confidence}
                          page={field?.source_page}
                          onViewSource={() => openFieldInspect(label, field)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action to push to schedule */}
              <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-brand-900">Synchronize With Master Project Schedule</h4>
                  <p className="text-[11px] text-brand-700">
                    Generate CPM substructure and excavation activities based on these foundation layers.
                  </p>
                </div>
                <button
                  onClick={() => setIsPushModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Push to Schedule</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: EXCAVATION */}
          {activeTab === 'excavation' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Excavation Conditions & Stability</h3>
                  <p className="text-xs text-slate-500">
                    Pit side slopes, weathered rock cutting, groundwater ingress, and equipment recommendations.
                  </p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Maximum Permissible Slope', key: 'maximum_slope' },
                  { label: 'Weathered Rock (CWR)', key: 'weathered_rock_present' },
                  { label: 'Hard Bedrock', key: 'hard_rock_present' },
                  { label: 'Groundwater Depth', key: 'groundwater_depth' },
                ].map(({ label, key }) => {
                  const field = excData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <SourceBadge
                        sourceType={field?.source_type}
                        confidence={field?.confidence}
                        page={field?.source_page}
                        onViewSource={() => openFieldInspect(label, field)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Equipment note clearly marked AI recommendation (Section 11) */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">
                    Recommended Excavation Machinery (AI / Engineering Recommendation)
                  </span>
                  <SourceBadge sourceType="AI_RECOMMENDATION" />
                </div>
                <p className="text-xs text-purple-800 leading-relaxed">
                  Based on hard bedrock and SPT refusal, heavy 20-30 ton crawler excavators fitted with hydraulic
                  breakers (chisel hammer) are recommended for bedrock breaking. Standard backhoe buckets are
                  restricted to upper fill/soil layers.
                </p>
              </div>
            </div>
          )}

          {/* TAB: CONCRETE PROTECTION */}
          {activeTab === 'concrete' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Concrete & Foundation Protection (IS 456-2000)</h3>
                  <p className="text-xs text-slate-500">Environmental exposure grading, cement specifications, and cover.</p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Exposure Classification', key: 'exposure_classification' },
                  { label: 'Cement Type', key: 'cement_type' },
                  { label: 'Minimum Concrete Grade', key: 'concrete_grade' },
                  { label: 'Minimum Cement Content', key: 'minimum_cement' },
                  { label: 'Maximum Water/Cement Ratio', key: 'maximum_wc_ratio' },
                  { label: 'Minimum Cover to Reinforcement', key: 'minimum_cover' },
                ].map(({ label, key }) => {
                  const field = concData?.[key];
                  return (
                    <div key={key} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          {label}
                        </span>
                        <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                          {field?.display || 'Not specified in report'}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                        <SourceBadge
                          sourceType={field?.source_type}
                          confidence={field?.confidence}
                          page={field?.source_page}
                          onViewSource={() => openFieldInspect(label, field)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: LABORATORY RESULTS */}
          {activeTab === 'laboratory' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Laboratory Test Results</h3>
                  <p className="text-xs text-slate-500">Structured laboratory tables preserving original units and limits.</p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              {labList.length > 0 ? (
                <div className="space-y-4">
                  {labList.map((test, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{test.test_category}</h4>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Sample: {test.sample_id} • Depth: {test.depth_m}
                          </span>
                        </div>
                        <SourceBadge sourceType="REPORT" page={test.source_page} />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {test.parameters.map((p, pIdx) => (
                          <div key={pIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block truncate">{p.name}</span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {p.value} {p.unit}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">Limit: {p.limit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                  No laboratory tables parsed in this document.
                </div>
              )}
            </div>
          )}

          {/* TAB: CALCULATIONS */}
          {activeTab === 'calculations' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Report Calculations</h3>
                  <p className="text-xs text-slate-500">
                    Engineering equations and intermediate calculations detected in report.
                  </p>
                </div>
                <SourceBadge sourceType="REPORT" />
              </div>

              {calcList.length > 0 ? (
                <div className="space-y-4">
                  {calcList.map((calc, idx) => (
                    <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{calc.calculation_name}</h4>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Section: {calc.source_section}
                          </span>
                        </div>
                        <SourceBadge sourceType="REPORT" page={calc.source_page} />
                      </div>

                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 font-mono text-xs text-blue-900">
                        Formula: {calc.formula}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(calc.input_parameters).map(([k, v]) => (
                          <div key={k} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-slate-400 block">{k}</span>
                            <span className="font-bold text-slate-800 font-mono">{v}</span>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs font-mono font-bold text-emerald-900">
                        Result: {calc.result}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                  No explicit calculation sheets present in document.
                </div>
              )}
            </div>
          )}

          {/* TAB: RISKS */}
          {activeTab === 'risks' && (
            <RiskIntelligenceView risks={riskList} />
          )}

          {/* TAB: MISSING DATA */}
          {activeTab === 'missing_data' && (
            <MissingDataIntelligenceView
              missingItems={missingList}
              onNavigatePlanning={onNavigateToSchedule}
            />
          )}

          {/* TAB: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <GeotechAuditTrail auditTrail={auditList} />
          )}

          {/* TAB: 3D GEOLOGICAL CUTAWAY */}
          {activeTab === '3d_cutaway' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Rotate3d className="w-4 h-4 text-cyan-600" />
                    <span>3D Subsurface Geological Model & Isometric Cutaway Cube</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dual 3D modes: Interactive isometric strata cube with exploded layer inspection & spatial borehole column interpolations.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 font-mono text-[10px] font-bold">
                  INTERPOLATED GEOLOGICAL MODEL
                </div>
              </div>

              {/* 1. Isometric Cutaway Cube */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-950">
                <IsometricGeologicalCube
                  report={synthesizedReport}
                  activeProjectName={pInfo?.project_name?.display || 'Construction Site'}
                  onNavigateToFleet={() => setActiveTab('machinery')}
                  onNavigateToStrataTab={() => setActiveTab('layers')}
                />
              </div>

              {/* 2. ThreeD Spatial Borehole Strata Model */}
              <div className="pt-4 border-t border-slate-200">
                <ThreeDGeologicalView
                  boreholes={bhList}
                  groundwaterDepth={gwData?.observed_depth?.display || '1.5–2.5 m'}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && projectId && (
        <ReportUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          projectId={projectId}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* Compare Modal */}
      {isCompareModalOpen && (
        <GeotechnicalCompareModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          availableReports={reports}
        />
      )}

      {/* Inspect Field Source Modal */}
      {inspectField && (
        <ViewSourceModal
          isOpen={Boolean(inspectField)}
          onClose={() => setInspectField(null)}
          title={inspectField.title}
          fieldData={inspectField.data}
        />
      )}

      {/* Push to Schedule Modal */}
      {isPushModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Push to Master Schedule</h3>
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will create geotechnical excavation activities in the master project schedule with CPM
              predecessors and resource allocations.
            </p>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span>Replace any previously generated excavation activities</span>
            </label>

            {pushSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                {pushSuccessMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handlePushToSchedule}
                disabled={isPushing}
                className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs"
              >
                {isPushing ? 'Synchronizing...' : 'Confirm & Push'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VEHICLE PHOTO ZOOM LIGHTBOX MODAL */}
      {enlargedVehicle && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEnlargedVehicle(null)}
        >
          <div
            className="bg-slate-900 text-white rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-72 sm:h-96 w-full bg-black">
              <img
                src={VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.src || '/vehicles/backhoe.png'}
                alt={enlargedVehicle.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />
              <button
                onClick={() => setEnlargedVehicle(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-xs transition-colors border border-white/20"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded border shadow-xs backdrop-blur-md ${VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badgeColor || 'bg-slate-800'}`}>
                    {VEHICLE_IMAGE_MAP[enlargedVehicle.key]?.badge}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-white text-slate-950 font-black shadow-xs">
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
