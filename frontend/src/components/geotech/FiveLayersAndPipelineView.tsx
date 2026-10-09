import React, { useState } from 'react';
import {
  Sparkles, Workflow, Layers, Drill, Building2, Pickaxe,
  Waves, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight,
  Database, Download, Clock, Gauge, Compass, Scale, ShieldCheck,
  Activity, ExternalLink, RefreshCw
} from 'lucide-react';
import { GeotechnicalIntelligenceDoc } from '../../types';
import { apiClient } from '../../api/client';

interface FiveLayersAndPipelineViewProps {
  currentIntelDoc: GeotechnicalIntelligenceDoc;
  onNavigateTab: (tab: any) => void;
  onExportStandardJSON: () => void;
  selectedReportId: string | number;
}

export const FiveLayersAndPipelineView: React.FC<FiveLayersAndPipelineViewProps> = ({
  currentIntelDoc,
  onNavigateTab,
  onExportStandardJSON,
  selectedReportId,
}) => {
  const [isSyncingBOQ, setIsSyncingBOQ] = useState(false);
  const [boqSuccessMsg, setBoqSuccessMsg] = useState<string | null>(null);

  const fiveLayers = currentIntelDoc.five_intelligence_layers || {};
  const pipeline = currentIntelDoc.pipeline_intelligence || {};
  const l1 = fiveLayers.layer_1_site_boreholes || {};
  const l2 = fiveLayers.layer_2_soil_profile || {};
  const l3 = fiveLayers.layer_3_foundation_parameters || {};
  const l4 = fiveLayers.layer_4_construction_risks || {};
  const l5 = fiveLayers.layer_5_project_intelligence || {};

  const fValidation = pipeline.foundation_validation;
  const boqItems = pipeline.geotechnical_boq_items || [];
  const scheduleSequence = pipeline.construction_sequence || [];
  const delayPrediction = pipeline.delay_prediction;
  const labourMaterial = pipeline.labour_material_estimation;

  const handleSyncBOQ = async () => {
    setIsSyncingBOQ(true);
    setBoqSuccessMsg(null);
    try {
      const res = await apiClient.syncGeotechToBOQ(selectedReportId);
      setBoqSuccessMsg(res.message || 'Geotechnical items successfully synchronized with Project BOQ.');
    } catch (err: any) {
      console.error('BOQ sync error:', err);
      alert('Failed to sync with BOQ: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsSyncingBOQ(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Banner with 5 Intelligence Layers Flow */}
      <div className="bg-linear-to-r from-slate-900 via-brand-950 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-brand-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-400/30">
                5 Intelligence Layers
              </span>
              <span className="text-xs text-slate-300">ISO / IS 1892 & IS 6403 Standard</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white mt-1">
              Geotechnical Construction Intelligence Engine
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5 leading-relaxed">
              Extracts structured engineering parameters from exploratory boreholes to inform foundation selection,
              excavation sequencing, BOQ takeoff, structural safety, and CPM schedule risks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportStandardJSON}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-colors shadow-xs"
              title="Download standardized multi-layer JSON"
            >
              <Download className="w-3.5 h-3.5 text-brand-300" />
              <span>Export Standard JSON</span>
            </button>
            <button
              onClick={handleSyncBOQ}
              disabled={isSyncingBOQ}
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSyncingBOQ ? 'Syncing...' : 'Sync to Project BOQ'}</span>
            </button>
          </div>
        </div>

        {/* 5-Layer Flow Diagram */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 text-center">
          {[
            { step: '1', title: 'SITE & BOREHOLES', desc: 'Location, RL & Depths', color: 'border-blue-400/40 bg-blue-500/10 text-blue-200' },
            { step: '2', title: 'SOIL PROFILE', desc: 'Layers, SPT & Shear', color: 'border-amber-400/40 bg-amber-500/10 text-amber-200' },
            { step: '3', title: 'FOUNDATION', desc: 'SBC, Settlement & Water', color: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' },
            { step: '4', title: 'CONSTRUCTION RISKS', desc: 'Water, Rock & Shoring', color: 'border-rose-400/40 bg-rose-500/10 text-rose-200' },
            { step: '5', title: 'PROJECT INTEL', desc: 'Cost + Schedule + Delays', color: 'border-purple-400/40 bg-purple-500/10 text-purple-200' },
          ].map((item, idx) => (
            <div key={idx} className={`p-2.5 rounded-xl border ${item.color} flex flex-col justify-between`}>
              <span className="text-[10px] font-mono font-bold opacity-75">LAYER {item.step}</span>
              <span className="text-xs font-black tracking-tight mt-0.5">{item.title}</span>
              <span className="text-[10px] opacity-80 mt-0.5 truncate">{item.desc}</span>
            </div>
          ))}
        </div>

        {boqSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{boqSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Construction Intelligence Pipeline: Foundation Validation + BOQ + Schedule */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Connected Construction Intelligence Pipeline
              </h3>
              <p className="text-xs text-slate-500">
                Live link between Geotechnical Report ➔ Foundation Selection ➔ BOQ Quantity Takeoff ➔ CPM Schedule
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Foundation Recommendation & Validation */}
          {fValidation && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Foundation Selection & Validation
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  fValidation.is_bearing_adequate ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {fValidation.is_bearing_adequate ? 'SBC Adequate' : 'Deep/Raft Required'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block">Proposed Floors</span>
                  <span className="font-bold text-slate-800">{fValidation.proposed_floors} storeys</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block">Est. Contact Stress</span>
                  <span className="font-bold text-indigo-700">{fValidation.estimated_contact_pressure_kpa} kPa</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block">Allowable Bearing (SBC)</span>
                  <span className="font-bold text-emerald-700">{fValidation.allowable_bearing_pressure_kpa} kPa</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 block">Governing Code</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px] truncate">
                    {fValidation.applicable_code || 'IS 6403 / IS 2911'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recommended System</span>
                <span className="font-bold text-brand-700 block mt-0.5">{fValidation.recommended_foundation_system}</span>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{fValidation.validation_verdict}</p>
              </div>
            </div>
          )}

          {/* Card B: Delay Risk & Schedule Buffers */}
          {delayPrediction && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Substructure Schedule & Delay Risk
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  delayPrediction.delay_risk_level === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {delayPrediction.delay_risk_level} Delay Risk
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Recommended Schedule Buffer</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    +{delayPrediction.recommended_schedule_buffer_days} working days
                  </span>
                </div>
                <span className="text-xs text-slate-500 max-w-[180px] text-right">
                  Added to substructure excavation & PCC phase
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Identified Site Risk Factors</span>
                {delayPrediction.delay_risk_factors?.map((rf: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{rf}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Geotechnical-Triggered BOQ Items */}
        {boqItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Geotechnical-Triggered BOQ Items (Material & Labour Takeoff)
                </h4>
                <p className="text-xs text-slate-500">
                  Items generated directly from soil stratification, rock breaking hardness, and groundwater depth
                </p>
              </div>
              <button
                onClick={handleSyncBOQ}
                disabled={isSyncingBOQ}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition-colors"
              >
                <Database className="w-3 h-3" />
                <span>Sync with Project BOQ Table</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Item Code</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-4">Engineering Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boqItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-bold text-brand-700 whitespace-nowrap">{it.item_code}</td>
                      <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">{it.category}</td>
                      <td className="py-2 px-4 text-slate-800 max-w-sm">{it.description}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{it.quantity.toLocaleString()}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{it.unit}</td>
                      <td className="py-2 px-4 text-slate-500 text-[11px] italic">{it.engineering_rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Substructure Construction Activity Sequence */}
        {scheduleSequence.length > 0 && (
          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Substructure Activity CPM Sequence
              </h4>
              <p className="text-xs text-slate-500">
                Recommended activity flow governed by soil stability, dewatering, and stratum protection
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {scheduleSequence.map((act, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                      <span>STEP {act.step}</span>
                      <span className="font-bold text-slate-600">{act.duration_days} days</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 block leading-snug">{act.activity_name}</span>
                    <span className="text-[10px] text-brand-600 font-medium block mt-0.5">{act.phase}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100 italic">
                    {act.critical_note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Geotechnical Labour, Fleet & Material Estimation */}
        {labourMaterial && (
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Pickaxe className="w-3.5 h-3.5 text-amber-600" />
                  Labour, Equipment Fleet & Material Estimation
                </h4>
                <p className="text-xs text-slate-500">
                  Direct quantification of construction resources driven by stratigraphy, rock volume, and groundwater conditions
                </p>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/80 text-xs shrink-0">
                <span className="text-amber-800 font-medium">Estimated Fuel:</span>
                <span className="font-mono font-bold text-amber-950">
                  {labourMaterial.estimated_diesel_litres?.toLocaleString()} Litres Diesel
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Equipment Fleet */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono block">
                  🚜 Heavy Machinery Fleet
                </span>
                <div className="space-y-1.5">
                  {labourMaterial.machinery_fleet?.map((m: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200/70 text-xs flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <span className="font-medium text-slate-800 block leading-tight truncate">{m.equipment_name}</span>
                        <span className="text-[10px] text-slate-400 block leading-tight truncate">{m.role}</span>
                      </div>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] shrink-0">
                        {m.quantity} Unit{m.quantity > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labour Crew */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono block">
                  👷 Labour Crew & Mandays
                </span>
                <div className="space-y-1.5">
                  {labourMaterial.labour_crew_breakdown?.map((l: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200/70 text-xs flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <span className="font-medium text-slate-800 block leading-tight truncate">{l.trade}</span>
                        <span className="text-[10px] text-slate-400 block leading-tight">Crew Size: {l.crew_size}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] shrink-0">
                        {l.mandays} Mandays
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Material Takeoff */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono block">
                  🧱 Material Takeoff
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                    <span className="text-slate-600">PCC M15 Blinding:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {labourMaterial.material_takeoff?.pcc_m15_blinding_cum?.toLocaleString()} m³
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                    <span className="text-slate-600">RCC Raft Concrete (M25/M30):</span>
                    <span className="font-mono font-bold text-slate-800">
                      {labourMaterial.material_takeoff?.raft_m25_m30_concrete_cum?.toLocaleString()} m³
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                    <span className="text-slate-600">TMT Steel Rebar:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {labourMaterial.material_takeoff?.tmt_rebar_steel_metric_tonnes?.toLocaleString()} MT
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                    <span className="text-slate-600">Waterproofing Membrane:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {labourMaterial.material_takeoff?.waterproofing_membrane_sqm?.toLocaleString()} m²
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                    <span className="text-slate-600">Select Granular Backfill:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {labourMaterial.material_takeoff?.select_granular_backfill_cum?.toLocaleString()} m³
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Detailed 5 Intelligence Layers Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
          Detailed Layer Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Layer 1 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-blue-900 font-mono flex items-center gap-1.5">
                <Drill className="w-4 h-4 text-blue-600" />
                LAYER 1: SITE & BOREHOLES
              </span>
              <button
                onClick={() => onNavigateTab('boreholes')}
                className="text-[10px] text-brand-600 font-semibold hover:underline"
              >
                View all boreholes ➔
              </button>
            </div>
            <p className="text-[11px] text-slate-600">{l1.description}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Project:</span>
                <span className="font-bold text-slate-800">{l1.project_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Boreholes Identified:</span>
                <span className="font-mono font-bold text-blue-700">{l1.boreholes_count} boreholes</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Ground Elevation (RL):</span>
                <span className="font-mono text-slate-800">{l1.ground_rl_m || '0.00 m'}</span>
              </div>
            </div>
          </div>

          {/* Layer 2 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-amber-900 font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                LAYER 2: SOIL PROFILE
              </span>
              <button
                onClick={() => onNavigateTab('spt_data')}
                className="text-[10px] text-brand-600 font-semibold hover:underline"
              >
                SPT Database ➔
              </button>
            </div>
            <p className="text-[11px] text-slate-600">{l2.description}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">USCS Classification:</span>
                <span className="font-bold text-slate-800">{l2.classification?.uscs || 'CL / SM'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Friction Angle φ:</span>
                <span className="font-bold text-slate-800">{l2.engineering_properties?.friction_angle || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Rock Formation:</span>
                <span className="font-bold text-cyan-800">{l2.rock_properties?.rock_type || 'Bedrock'}</span>
              </div>
            </div>
          </div>

          {/* Layer 3 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-emerald-900 font-mono flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-600" />
                LAYER 3: FOUNDATION
              </span>
              <button
                onClick={() => onNavigateTab('bearing_capacity')}
                className="text-[10px] text-brand-600 font-semibold hover:underline"
              >
                Bearing Capacity ➔
              </button>
            </div>
            <p className="text-[11px] text-slate-600">{l3.description}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Recommended Type:</span>
                <span className="font-bold text-brand-800">{l3.recommended_foundation_type || 'Raft'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Allowable Bearing:</span>
                <span className="font-mono font-bold text-emerald-800">{l3.safe_bearing_capacity || '180 kPa'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Settlement Limit:</span>
                <span className="font-mono text-slate-800">{l3.settlement_limit || '<12 mm'}</span>
              </div>
            </div>
          </div>

          {/* Layer 4 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-rose-900 font-mono flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                LAYER 4: RISKS
              </span>
              <button
                onClick={() => onNavigateTab('risks')}
                className="text-[10px] text-brand-600 font-semibold hover:underline"
              >
                View all risks ➔
              </button>
            </div>
            <p className="text-[11px] text-slate-600">{l4.description}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dewatering Required:</span>
                <span className={`font-bold ${l4.dewatering_mandatory === 'YES' ? 'text-rose-600' : 'text-slate-700'}`}>
                  {l4.dewatering_mandatory}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Rock Breaking Needed:</span>
                <span className="font-bold text-slate-800">{l4.hard_rock_breaking_required}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Liquefaction Susceptibility:</span>
                <span className="font-bold text-slate-800">{l4.liquefaction_risk || 'Low'}</span>
              </div>
            </div>
          </div>

          {/* Layer 5 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs col-span-1 md:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-purple-900 font-mono flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                LAYER 5: PROJECT INTELLIGENCE
              </span>
              <button
                onClick={() => onNavigateTab('schedule')}
                className="text-[10px] text-brand-600 font-semibold hover:underline"
              >
                CPM Schedule ➔
              </button>
            </div>
            <p className="text-[11px] text-slate-600">{l5.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Sequential CPM Substructure Chain</span>
                <p className="text-[11px] text-slate-700 mt-1">
                  Excavation ➔ Dewatering ➔ Shoring ➔ Blinding PCC ➔ Footing/Raft ➔ Waterproofing
                </p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Schedule Buffer Protection</span>
                <p className="text-[11px] text-slate-700 mt-1">
                  +{l5.schedule_impact_buffer_days || 12} days required for high water table & strata transition
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
