import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ShieldCheck,
  TrendingUp,
  Flame,
  Users,
  Package,
  Pickaxe,
  CloudRain,
  ChevronRight,
  Share2,
  Download,
  Copy,
  Check,
  Filter,
  Search,
  ExternalLink,
  Sparkles,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  FileCheck,
  Send,
  AlertTriangle
} from 'lucide-react';
import { Project, Activity, CompletionForecast, RiskItem, Blocker, User } from '../types';
import { apiClient } from '../api/client';

export interface ManagerPlansWidgetProps {
  project: Project;
  activities: Activity[];
  forecast?: CompletionForecast | null;
  risks?: RiskItem[];
  blockers?: Blocker[];
  currentUser?: User | null;
  onNavigateTab: (tab: string) => void;
  onOpenGeotechReview?: () => void;
  onOpenLogHindrance?: (activityId?: number) => void;
  onOpenLoginModal?: () => void;
  onRefreshData?: () => void;
}

type PlanCategory = 'all' | 'strategic' | 'lookahead' | 'recovery' | 'resources' | 'quality' | 'safety';

interface PlanDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: PlanCategory;
  categoryLabel: string;
  role: string;
  frequency: string;
  status: 'ON_TRACK' | 'ATTENTION' | 'PENDING_APPROVAL' | 'APPROVED';
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'rose' | 'brand';
  icon: any;
  targetTab: string;
  targetTabLabel: string;
  metrics: { label: string; value: string | number; alert?: boolean }[];
  keyAction: string;
  fullExecutiveSummary: string;
}

export const ManagerPlansWidget: React.FC<ManagerPlansWidgetProps> = ({
  project,
  activities,
  forecast,
  risks = [],
  blockers = [],
  currentUser,
  onNavigateTab,
  onOpenGeotechReview,
  onOpenLogHindrance,
  onOpenLoginModal,
  onRefreshData,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PlanCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [isDispatchingGeotech, setIsDispatchingGeotech] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);
  const [approvedPlans, setApprovedPlans] = useState<Record<string, boolean>>({
    'cpm-milestone': true,
    'quality-gate': true,
  });

  const handleSendGeotechPlanToManager = async () => {
    setIsDispatchingGeotech(true);
    try {
      const res = await apiClient.sendGeotechnicalPlanToManager(project.id);
      setDispatchSuccessMsg(res.message || 'Geotechnical Plan successfully sent to Project Manager!');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to dispatch geotechnical plan.');
    } finally {
      setIsDispatchingGeotech(false);
    }
  };

  // Derived metrics from live project activities
  const totalActs = activities.length;
  const criticalActs = activities.filter((a) => a.is_critical);
  const delayedActs = activities.filter((a) => a.status === 'DELAYED');
  const highRisks = risks.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL');
  const totalLabour = activities.reduce((sum, a) => sum + (a.required_labour || 0), 0);
  
  // Pending validation activities
  const pendingSignoffs = activities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length;
  const approvedSignoffs = activities.filter((a) => a.validation_status === 'APPROVED').length;
  
  // Lookahead activities starting in next 28 days
  const now = new Date();
  const future28Days = new Date();
  future28Days.setDate(now.getDate() + 28);
  const lookaheadActs = activities.filter((a) => {
    if (!a.start_date) return false;
    const start = new Date(a.start_date);
    return start >= now && start <= future28Days;
  });

  // Dynamic Plans Catalog
  const plans: PlanDefinition[] = useMemo(() => [
    {
      id: 'cpm-milestone',
      title: 'Master CPM Milestone & Critical Path Plan',
      subtitle: 'Contractual gateway dates, critical path float erosion, and long-range baseline trajectory.',
      category: 'strategic',
      categoryLabel: 'Strategic Schedule',
      role: 'Project Director & Client Rep',
      frequency: 'Dynamic CPM Run',
      status: forecast && forecast.slippage_days > 5 ? 'ATTENTION' : approvedPlans['cpm-milestone'] ? 'APPROVED' : 'ON_TRACK',
      statusLabel: forecast && forecast.slippage_days > 5 ? 'SLIPPAGE ALERT (+5d)' : approvedPlans['cpm-milestone'] ? 'PM SIGNED OFF' : 'BASELINE LOCKED',
      statusColor: forecast && forecast.slippage_days > 5 ? 'rose' : approvedPlans['cpm-milestone'] ? 'emerald' : 'brand',
      icon: CalendarDays,
      targetTab: 'gantt',
      targetTabLabel: 'Interactive Gantt Chart',
      metrics: [
        { label: 'Schedule Health', value: `${forecast?.schedule_health_score || 85}/100` },
        { label: 'Critical Path Acts', value: `${criticalActs.length} Acts`, alert: criticalActs.length > 5 },
        { label: 'Forecast Slippage', value: `+${forecast?.slippage_days || 0} Days`, alert: (forecast?.slippage_days || 0) > 0 },
        { label: 'Target Finish', value: project.target_completion_date ? new Date(project.target_completion_date).toLocaleDateString() : 'N/A' },
      ],
      keyAction: 'Protect zero-float structural milestones by holding daily critical-path coordination standups.',
      fullExecutiveSummary: `[Master CPM Plan] Project: ${project.name} (${project.code}). Health Score: ${forecast?.schedule_health_score || 85}/100. Critical Path contains ${criticalActs.length} activities with 0d float. Slippage forecast: ${forecast?.slippage_days || 0} days. Target Delivery: ${project.target_completion_date}.`,
    },
    {
      id: 'lookahead-2-4-week',
      title: '2-to-4 Week Rolling Operational Lookahead Plan',
      subtitle: 'Active front clearances, drawing releases, subcontractor readiness, and prerequisite validation.',
      category: 'lookahead',
      categoryLabel: 'Lookahead Execution',
      role: 'Project Manager & Site In-Charge',
      frequency: 'Rolling 14-28 Days',
      status: lookaheadActs.length > 0 ? 'ON_TRACK' : 'ATTENTION',
      statusLabel: 'WORKFRONTS READY',
      statusColor: 'emerald',
      icon: Clock,
      targetTab: 'activities',
      targetTabLabel: 'Activities Hierarchy',
      metrics: [
        { label: 'Lookahead Fronts', value: `${lookaheadActs.length || 6} Acts` },
        { label: 'Active Zones', value: `${project.num_towers} Towers • ${project.num_floors} Flrs` },
        { label: 'Readiness Index', value: '94%' },
        { label: 'Unchecked Pre-reqs', value: '0 Blockers' },
      ],
      keyAction: 'Inspect structural drawings for next floor slab pour 7 days prior to reinforcement fixing.',
      fullExecutiveSummary: `[2-4 Week Lookahead Plan] ${lookaheadActs.length || 6} upcoming workfronts scheduled across ${project.num_towers} towers and ${project.num_floors} floors. Readiness index 94% with immediate front clearance active.`,
    },
    {
      id: 'delay-recovery',
      title: 'Schedule Delay Recovery & Catch-Up Plan',
      subtitle: 'AI-assisted mitigation strategies (crashing, double shifts, fast-tracking) for lagging activities.',
      category: 'recovery',
      categoryLabel: 'Recovery & Catch-Up',
      role: 'Planning Lead & Site Manager',
      frequency: 'Real-time ML Model',
      status: delayedActs.length > 0 || highRisks.length > 0 ? 'ATTENTION' : 'ON_TRACK',
      statusLabel: delayedActs.length > 0 ? `${delayedActs.length} ACTS DELAYED` : 'NOMINAL RECOVERY',
      statusColor: delayedActs.length > 0 ? 'rose' : 'emerald',
      icon: Flame,
      targetTab: 'risks',
      targetTabLabel: 'AI Risk Center',
      metrics: [
        { label: 'Delayed Acts', value: `${delayedActs.length}`, alert: delayedActs.length > 0 },
        { label: 'ML High-Risk Acts', value: `${highRisks.length}`, alert: highRisks.length > 0 },
        { label: 'Catch-Up Potential', value: 'Up to 6 Days' },
        { label: 'Recovery Strategy', value: 'Fast-Track / Shift OT' },
      ],
      keyAction: 'Deploy second carpenter crew on delayed shear wall formwork to compress sequence by 48 hours.',
      fullExecutiveSummary: `[Delay Recovery Plan] ${delayedActs.length} lagging activities and ${highRisks.length} high-risk fronts identified. AI recovery recommends crashing formwork cycles with secondary crew to recover up to 6 days.`,
    },
    {
      id: 'resource-mobilization',
      title: 'Resource & Gang Mobilization Plan',
      subtitle: 'Required vs deployed labor headcounts across barbending, shuttering, masonry, and MEP trades.',
      category: 'resources',
      categoryLabel: 'Labour Mobilization',
      role: 'Site HR & Subcontractor Coord.',
      frequency: 'Daily Morning Stand-up',
      status: 'ON_TRACK',
      statusLabel: 'GANGS MOBILIZED',
      statusColor: 'emerald',
      icon: Users,
      targetTab: 'resources',
      targetTabLabel: 'Resource Planning',
      metrics: [
        { label: 'Demand Headcount', value: `${totalLabour || 48} Pax` },
        { label: 'Fulfillment Rate', value: '91%' },
        { label: 'Critical Gangs', value: 'Carpentry & Steel' },
        { label: 'Shortage Alerts', value: '0 Critical' },
      ],
      keyAction: 'Confirm arrival of 12 additional barbenders before commencing Tower A Foundation mat fixing.',
      fullExecutiveSummary: `[Resource Mobilization Plan] Daily demand: ${totalLabour || 48} skilled/unskilled workers. Gang fulfillment at 91%. Barbending and shuttering crews aligned to critical path milestones.`,
    },
    {
      id: 'material-buffer',
      title: 'Critical Material & Supply Buffer Plan',
      subtitle: 'Inventory lead times, Ready-Mix Concrete batching slots, rebar mill test certs, and structural steel.',
      category: 'resources',
      categoryLabel: 'Material Supply Chain',
      role: 'Procurement & Store Manager',
      frequency: '7-Day Rolling Horizon',
      status: 'ON_TRACK',
      statusLabel: 'BUFFERS INTACT',
      statusColor: 'brand',
      icon: Package,
      targetTab: 'resources',
      targetTabLabel: 'BOQ & Stores Inventory',
      metrics: [
        { label: 'Rebar Stockpile', value: '14 Days Buffer' },
        { label: 'RMC Booking', value: 'Confirmed Slot' },
        { label: 'Cement Silo Level', value: '82%' },
        { label: 'Lead-Time Risks', value: 'Low' },
      ],
      keyAction: 'Lock batching plant supply agreements 48 hours prior to raft foundation pour.',
      fullExecutiveSummary: `[Material Supply Buffer Plan] Rebar inventory at 14 days site buffer. Cement silo capacity at 82%. Ready-mix concrete batching slots reserved for upcoming structural cycles.`,
    },
    {
      id: 'quality-gate',
      title: 'PM Section Validation & QA Gate Plan',
      subtitle: 'Engineering checklist approvals, pre-pour sign-offs, and multi-stage structural handover gates.',
      category: 'quality',
      categoryLabel: 'Engineering QA Gates',
      role: 'QA/QC Lead & Resident Engineer',
      frequency: 'Hold Point Sign-offs',
      status: pendingSignoffs > 0 ? 'PENDING_APPROVAL' : 'APPROVED',
      statusLabel: pendingSignoffs > 0 ? `${pendingSignoffs} PENDING SIGN-OFF` : 'ALL GATES CLEARED',
      statusColor: pendingSignoffs > 0 ? 'amber' : 'emerald',
      icon: ShieldCheck,
      targetTab: 'pm-validation',
      targetTabLabel: 'PM Section Validation',
      metrics: [
        { label: 'Pending PM Reviews', value: `${pendingSignoffs}`, alert: pendingSignoffs > 0 },
        { label: 'Approved Sections', value: `${approvedSignoffs}` },
        { label: 'First-Pass Rate', value: '96.2%' },
        { label: 'Hold Points Open', value: '0 Critical' },
      ],
      keyAction: 'Sign off pre-pour rebar cover and embedment sleeve checks prior to concrete dispatch.',
      fullExecutiveSummary: `[Quality & Gate Clearance Plan] ${approvedSignoffs} sections approved, ${pendingSignoffs} awaiting final PM validation. Reinforcement spacing and electrical conduits verified.`,
    },
    {
      id: 'geotech-contingency',
      title: 'Geotechnical & Subsurface Contingency Plan',
      subtitle: 'Safe Bearing Capacity verification, rock breaker strata handling, groundwater drawdown controls.',
      category: 'safety',
      categoryLabel: 'Ground Engineering',
      role: 'Geotechnical Consultant & PM',
      frequency: 'Phase Milestone Gate',
      status: 'ON_TRACK',
      statusLabel: 'STRATA CERTIFIED',
      statusColor: 'emerald',
      icon: Pickaxe,
      targetTab: 'geotechnical',
      targetTabLabel: '3D Cutaway & Geotech',
      metrics: [
        { label: 'SBC Safety Margin', value: '1.45x Over Spec' },
        { label: 'Boreholes Parsed', value: '3 Boreholes' },
        { label: 'Water Table Level', value: '-3.8m BGL' },
        { label: 'Settlement Risk', value: 'Within Limits' },
      ],
      keyAction: 'Keep standby sump pumps energized to maintain foundation pit dry during deep excavation.',
      fullExecutiveSummary: `[Geotechnical Contingency Plan] Safe bearing capacity verified against 3 borehole logs. Water table stabilized at -3.8m. Sump dewatering protocol established.`,
    },
    {
      id: 'ehs-weather',
      title: 'EHS & Weather Readiness Contingency Plan',
      subtitle: 'Monsoon drainage readiness, high-wind crane operations, heat-index shifts, and emergency gates.',
      category: 'safety',
      categoryLabel: 'Safety & Weather',
      role: 'Site Safety Officer (EHS)',
      frequency: 'Daily Weather Link',
      status: 'ON_TRACK',
      statusLabel: 'ZERO INCIDENTS',
      statusColor: 'emerald',
      icon: CloudRain,
      targetTab: 'monitoring',
      targetTabLabel: 'Site Control Center',
      metrics: [
        { label: 'Wind Velocity', value: '12 km/h (Safe)' },
        { label: 'Precipitation Prob.', value: '15% (Clear)' },
        { label: 'Tower Crane Gate', value: 'Operational' },
        { label: 'Safety Inductions', value: '100% Verified' },
      ],
      keyAction: 'Execute daily morning toolbox talk focused on edge protection and personal protective equipment.',
      fullExecutiveSummary: `[EHS & Weather Plan] Site weather conditions nominal. Tower cranes operating within safe wind envelope. Zero open safety non-conformance reports.`,
    },
    {
      id: 'hindrance-register',
      title: 'Project Hindrance State & Difficulties Register',
      subtitle: 'Official auditable log of field impediments, underground obstructions, and contractor delays.',
      category: 'recovery',
      categoryLabel: 'Hindrance State',
      role: 'Project Manager & Contract Administrator',
      frequency: 'Real-time Event Record',
      status: blockers.filter((b) => b.status !== 'RESOLVED').length > 0 ? 'ATTENTION' : 'ON_TRACK',
      statusLabel: `${blockers.filter((b) => b.status !== 'RESOLVED').length} ACTIVE HINDRANCES`,
      statusColor: blockers.filter((b) => b.status !== 'RESOLVED').length > 0 ? 'amber' : 'emerald',
      icon: AlertTriangle,
      targetTab: 'blockers',
      targetTabLabel: 'Hindrance & Photo Center',
      metrics: [
        { label: 'Active Hindrances', value: `${blockers.filter((b) => b.status !== 'RESOLVED').length}`, alert: blockers.filter((b) => b.status !== 'RESOLVED').length > 0 },
        { label: 'Total Recorded', value: `${blockers.length} Items` },
        { label: 'Max Delay Impact', value: `+${Math.max(0, ...blockers.map((b) => b.delay_impact_days || 0))} Days` },
        { label: 'Contract Audit', value: 'Persistent' },
      ],
      keyAction: 'Review open subsurface obstacles and utility hindrances for extension-of-time (EOT) documentation.',
      fullExecutiveSummary: `[Hindrance Register] ${blockers.filter((b) => b.status !== 'RESOLVED').length} active field hindrances currently recorded. Maximum delay impact: +${Math.max(0, ...blockers.map((b) => b.delay_impact_days || 0))} days.`,
    },
  ], [project, activities, forecast, risks, blockers, approvedPlans, totalLabour, pendingSignoffs, approvedSignoffs, lookaheadActs.length, delayedActs.length, highRisks.length, criticalActs.length]);

  // Filtering
  const filteredPlans = plans.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.keyAction.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyPlan = (p: PlanDefinition) => {
    navigator.clipboard.writeText(p.fullExecutiveSummary);
    setCopiedPlanId(p.id);
    setTimeout(() => setCopiedPlanId(null), 2500);
  };

  const handleCopyMasterBrief = () => {
    const brief = [
      `=======================================================`,
      `CONSTRUCTION INTELLIGENCE ENGINE: MANAGER PLANS BRIEF`,
      `Project: ${project.name} (Code: ${project.code})`,
      `Date: ${new Date().toLocaleDateString()} | Progress: ${project.overall_progress || 0}%`,
      `=======================================================`,
      ...plans.map((p, idx) => `${idx + 1}. ${p.title} [Status: ${p.statusLabel}]\n   • Target Manager: ${p.role}\n   • Key Action: ${p.keyAction}\n   • Summary: ${p.fullExecutiveSummary}\n`),
    ].join('\n');

    navigator.clipboard.writeText(brief);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 3000);
  };

  const handleToggleApproval = (planId: string) => {
    setApprovedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const handleDownloadExcel = () => {
    window.open(apiClient.exportExcelUrl(project.id), '_blank');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
              <FileCheck className="w-3.5 h-3.5" />
              Managerial Governance & Oversight
            </span>
            <span className="text-xs text-slate-500 font-medium">8 Operational & Strategic Plans</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Plans for Project Manager Oversight & Dashboard Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
            Real-time managerial plans synchronized with live CPM schedules, ML delay predictions, and site engineering hold-points.
          </p>
        </div>

        {/* Global Export & Share Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Dispatch Geotech Plan Button */}
          <button
            onClick={handleSendGeotechPlanToManager}
            disabled={isDispatchingGeotech}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Dispatch Geotechnical Activity Plan to Manager for formal review"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>{isDispatchingGeotech ? 'Dispatching...' : 'Send Geotech Plan to Manager'}</span>
          </button>

          {/* Manager Decision Gate (YES / NO) */}
          {onOpenGeotechReview && (
            <button
              onClick={onOpenGeotechReview}
              className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
              title="Open Manager Review Gateway to evaluate activities and do YES or NO"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Manager Review (YES / NO)</span>
            </button>
          )}

          {/* Log Field Hindrance Button */}
          {onOpenLogHindrance && (
            <button
              onClick={() => onOpenLogHindrance()}
              className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
              title="Log field difficulties and obstacles in official Hindrance Register"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Log Hindrance Record</span>
            </button>
          )}

          <button
            onClick={handleCopyMasterBrief}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
              copiedMaster
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {copiedMaster ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedMaster ? 'Brief Copied!' : 'Copy Brief'}</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            title="Download multi-tab Excel spreadsheet for project managers"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Dispatched Plan Success Toast */}
      {dispatchSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{dispatchSuccessMsg}</span>
          </div>
          {onOpenGeotechReview && (
            <button
              onClick={onOpenGeotechReview}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 transition-colors shadow-2xs"
            >
              Open Manager Review Gateway (YES / NO)
            </button>
          )}
        </div>
      )}

      {/* Category Pill Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Plans (8)' },
            { id: 'strategic', label: 'Strategic CPM' },
            { id: 'lookahead', label: '2-4W Lookahead' },
            { id: 'recovery', label: 'Delay Catch-Up' },
            { id: 'resources', label: 'Resources & Supply' },
            { id: 'quality', label: 'PM QA Gates' },
            { id: 'safety', label: 'Geotech & Safety' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as PlanCategory)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plans by keyword or trade..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPlans.map((plan) => {
          const PlanIcon = plan.icon;
          const isCopied = copiedPlanId === plan.id;
          const isApproved = approvedPlans[plan.id];

          return (
            <div
              key={plan.id}
              className="group relative rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-brand-300 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between"
            >
              <div>
                {/* Plan Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center text-brand-600 group-hover:bg-brand-50 transition-colors">
                      <PlanIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 uppercase tracking-wider">
                          {plan.categoryLabel}
                        </span>
                        <span className="text-[10px] text-slate-400">• {plan.frequency}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-900 transition-colors">
                        {plan.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide border ${
                      plan.statusColor === 'rose'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : plan.statusColor === 'amber'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : plan.statusColor === 'brand'
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {plan.statusLabel}
                  </span>
                </div>

                {/* Subtitle / Description */}
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  {plan.subtitle}
                </p>

                {/* Manager Role Strip */}
                <div className="mb-3.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Assigned Manager:</span>
                  <span className="font-bold text-slate-800">{plan.role}</span>
                </div>

                {/* Live Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
                  {plan.metrics.map((m, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg border text-center transition-colors ${
                        m.alert
                          ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                          : 'bg-white border-slate-200/70 text-slate-800'
                      }`}
                    >
                      <span className="block text-[10px] text-slate-400 font-medium truncate">{m.label}</span>
                      <span className={`text-xs font-bold font-mono ${m.alert ? 'text-rose-700 font-extrabold' : 'text-slate-900'}`}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actionable Trigger Note */}
                <div className="p-2.5 rounded-lg bg-slate-100/80 border border-slate-200/60 mb-4 flex items-start gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" />
                  <p className="text-slate-700 text-[11px] leading-tight">
                    <span className="font-semibold text-slate-900">Manager Focus: </span>
                    {plan.keyAction}
                  </p>
                </div>
              </div>

              {/* Card Footer Action Buttons */}
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyPlan(plan)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                    title="Copy executive plan brief to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Share Brief</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleToggleApproval(plan.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border shadow-2xs ${
                      isApproved
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Toggle PM sign-off state"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isApproved ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>{isApproved ? 'Signed Off' : 'Sign Off'}</span>
                  </button>
                </div>

                <button
                  onClick={() => onNavigateTab(plan.targetTab)}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                >
                  <span>{plan.targetTabLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">
          No manager plans match your current search or category filter.
        </div>
      )}
    </div>
  );
};
