import { useState, useEffect } from 'react';
import { Project, GeotechnicalReport, SampleGeotechReport, StrataLayer, MachineryRecommendation, GeotechnicalIntelligenceDoc } from '../../../types';
import { apiClient } from '../../../api/client';
import { DEFAULT_MACHINERY_LIST } from './defaultMachinery';

interface GeotechReportStateArgs {
  project?: Project;
  onNavigateToSchedule?: () => void;
  onRefreshData?: () => void;
}

export const useGeotechReportState = ({
  project,
  onNavigateToSchedule,
  onRefreshData,
}: GeotechReportStateArgs) => {
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


  const machineryList: MachineryRecommendation[] = (currentIntelDoc?.recommended_machinery && currentIntelDoc.recommended_machinery.length > 0)
    ? currentIntelDoc.recommended_machinery
    : DEFAULT_MACHINERY_LIST;

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
          color: isRock ? '#0f766e' : '#ea580c',
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

  return {
    reports,
    setReports,
    selectedReportId,
    setSelectedReportId,
    currentIntelDoc,
    setCurrentIntelDoc,
    sampleReports,
    setSampleReports,
    isLoading,
    setIsLoading,
    activeTab,
    setActiveTab,
    enlargedVehicle,
    setEnlargedVehicle,
    isUploadModalOpen,
    setIsUploadModalOpen,
    isCompareModalOpen,
    setIsCompareModalOpen,
    inspectField,
    setInspectField,
    isPushModalOpen,
    setIsPushModalOpen,
    replaceExisting,
    setReplaceExisting,
    isPushing,
    setIsPushing,
    pushSuccessMsg,
    setPushSuccessMsg,
    projectId,
    loadReportsList,
    handleUploadSuccess,
    handleExportPDF,
    handleExportExcel,
    handleExportJSON,
    handleExportStandardJSON,
    boqSyncStatus,
    setBoqSyncStatus,
    isSyncingBoq,
    setIsSyncingBoq,
    handleSyncToBOQ,
    handlePushToSchedule,
    openFieldInspect,
    pInfo,
    invInfo,
    bhList,
    stratList,
    soilData,
    rockData,
    gwData,
    foundData,
    excData,
    concData,
    labList,
    calcList,
    valData,
    riskList,
    missingList,
    auditList,
    cwrRange,
    hrRange,
    machineryList,
    rawLayersList,
    synthesizedReport,
  };
};

export type GeotechReportCtx = ReturnType<typeof useGeotechReportState>;
