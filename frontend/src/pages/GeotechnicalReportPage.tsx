import React from 'react';
import { Layers, Pickaxe, Drill, Truck, Waves, FileText, CheckCircle2, ShieldAlert, Sparkles, ShieldCheck, Activity as ActivityIcon, Rotate3d, History, HelpCircle, Building2, Scale } from 'lucide-react';
import { Project } from '../types';
import { IsometricGeologicalCube } from '../components/IsometricGeologicalCube';
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
import { useGeotechReportState } from '../components/geotech/report/useGeotechReportState';
import { OverviewTab } from '../components/geotech/report/OverviewTab';
import { LayersTab } from '../components/geotech/report/LayersTab';
import { MachineryTab } from '../components/geotech/report/MachineryTab';
import { StratigraphyTab } from '../components/geotech/report/StratigraphyTab';
import { SoilTab } from '../components/geotech/report/SoilTab';
import { RockTab } from '../components/geotech/report/RockTab';
import { GroundwaterTab } from '../components/geotech/report/GroundwaterTab';
import { FoundationTab } from '../components/geotech/report/FoundationTab';
import { ExcavationTab } from '../components/geotech/report/ExcavationTab';
import { ConcreteTab } from '../components/geotech/report/ConcreteTab';
import { LaboratoryTab } from '../components/geotech/report/LaboratoryTab';
import { CalculationsTab } from '../components/geotech/report/CalculationsTab';
import { PushToScheduleModal } from '../components/geotech/report/PushToScheduleModal';
import { VehicleLightbox } from '../components/geotech/report/VehicleLightbox';
import { ReportHeader } from '../components/geotech/report/ReportHeader';
import { SummaryKpiCards } from '../components/geotech/report/SummaryKpiCards';
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
  const ctx = useGeotechReportState({ project, onNavigateToSchedule, onRefreshData });
  const { reports, selectedReportId, currentIntelDoc, activeTab, setActiveTab, enlargedVehicle, isUploadModalOpen, setIsUploadModalOpen, isCompareModalOpen, setIsCompareModalOpen, inspectField, setInspectField, isPushModalOpen, projectId, handleUploadSuccess, handleExportStandardJSON, boqSyncStatus, setBoqSyncStatus, pInfo, bhList, gwData, labList, calcList, riskList, missingList, auditList, machineryList, rawLayersList, synthesizedReport } = ctx;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Header Bar: Document Control, Report Switcher & Actions */}
      <ReportHeader ctx={ctx} />

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
      <SummaryKpiCards ctx={ctx} />

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
          {activeTab === 'overview' && <OverviewTab ctx={ctx} />}

          {/* TAB: BOREHOLES */}
          {activeTab === 'boreholes' && (
            <BoreholeDatabaseView boreholes={bhList} />
          )}

          {/* TAB: LAYER PARSING & STRATA */}
          {activeTab === 'layers' && <LayersTab ctx={ctx} />}

          {/* TAB: CONSTRUCTION FLEET & MACHINERY */}
          {activeTab === 'machinery' && <MachineryTab ctx={ctx} />}

          {/* TAB: STRATIGRAPHY */}
          {activeTab === 'stratigraphy' && <StratigraphyTab ctx={ctx} />}

          {/* TAB: SOIL ANALYSIS */}
          {activeTab === 'soil' && <SoilTab ctx={ctx} />}

          {/* TAB: ROCK ANALYSIS */}
          {activeTab === 'rock' && <RockTab ctx={ctx} />}

          {/* TAB: GROUNDWATER */}
          {activeTab === 'groundwater' && <GroundwaterTab ctx={ctx} />}

          {/* TAB: FOUNDATION */}
          {activeTab === 'foundation' && <FoundationTab ctx={ctx} />}

          {/* TAB: EXCAVATION */}
          {activeTab === 'excavation' && <ExcavationTab ctx={ctx} />}

          {/* TAB: CONCRETE PROTECTION */}
          {activeTab === 'concrete' && <ConcreteTab ctx={ctx} />}

          {/* TAB: LABORATORY RESULTS */}
          {activeTab === 'laboratory' && <LaboratoryTab ctx={ctx} />}

          {/* TAB: CALCULATIONS */}
          {activeTab === 'calculations' && <CalculationsTab ctx={ctx} />}

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
                    <Rotate3d className="w-4 h-4 text-teal-600" />
                    <span>3D Subsurface Geological Model & Isometric Cutaway Cube</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dual 3D modes: Interactive isometric strata cube with exploded layer inspection & spatial borehole column interpolations.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-teal-100 text-teal-900 border border-teal-300 font-mono text-[10px] font-bold">
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
      {isPushModalOpen && <PushToScheduleModal ctx={ctx} />}

      {/* VEHICLE PHOTO ZOOM LIGHTBOX MODAL */}
      {enlargedVehicle && <VehicleLightbox ctx={ctx} />}
    </div>
  );
};
