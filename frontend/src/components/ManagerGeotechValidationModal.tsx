import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Check,
  AlertTriangle,
  Send,
  LogIn,
  Search,
  Filter,
  Layers,
  Pickaxe,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  UserCheck,
  MessageSquare,
  FileCheck,
  Flame,
  ArrowRight
} from 'lucide-react';
import { Activity, Project, User, Blocker } from '../types';
import { apiClient } from '../api/client';

interface ManagerGeotechValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activities: Activity[];
  blockers: Blocker[];
  currentUser: User | null;
  onOpenLoginModal: () => void;
  onOpenLogHindranceModal: (activityId?: number) => void;
  onRefreshData: () => void;
}

export const ManagerGeotechValidationModal: React.FC<ManagerGeotechValidationModalProps> = ({
  isOpen,
  onClose,
  project,
  activities,
  blockers,
  currentUser,
  onOpenLoginModal,
  onOpenLogHindranceModal,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'geotech' | 'all' | 'hindrances'>('geotech');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Rejection note prompt modal state
  const [rejectingActId, setRejectingActId] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('Requires geotechnical ground verification / test report confirmation');

  const isManager = currentUser && (
    currentUser.role === 'Project Manager' ||
    currentUser.role === 'Admin' ||
    currentUser.email.includes('pm@')
  );

  // Filter Geotechnical Activities (Substructure, Foundation, Excavation, Earthworks)
  const geotechActivities = useMemo(() => {
    return activities.filter((a) => {
      const ph = (a.phase || '').toLowerCase();
      const pkg = (a.work_package || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      const nm = (a.name || '').toLowerCase();

      return (
        ph.includes('pre-construction') ||
        ph.includes('substructure') ||
        pkg.includes('excavation') ||
        pkg.includes('foundation') ||
        pkg.includes('survey') ||
        pkg.includes('site prep') ||
        cat.includes('geotech') ||
        nm.includes('excavation') ||
        nm.includes('shoring') ||
        nm.includes('pcc') ||
        nm.includes('raft') ||
        nm.includes('footing') ||
        nm.includes('dewatering') ||
        nm.includes('soil') ||
        nm.includes('strata')
      );
    });
  }, [activities]);

  const displayedActivities = useMemo(() => {
    const baseList = activeTab === 'geotech' ? geotechActivities : activities;
    return baseList.filter((a) => {
      if (statusFilter !== 'all') {
        const current = a.validation_status || 'PENDING';
        if (current !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          (a.code && a.code.toLowerCase().includes(q)) ||
          a.phase.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeTab, geotechActivities, activities, statusFilter, search]);

  const geotechApprovedCount = geotechActivities.filter((a) => a.validation_status === 'APPROVED').length;
  const geotechRejectedCount = geotechActivities.filter((a) => a.validation_status === 'REJECTED').length;
  const geotechPendingCount = geotechActivities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length;

  if (!isOpen || !project) return null;

  const handleValidateActivity = async (
    actId: number,
    decision: 'APPROVED' | 'REJECTED' | 'PENDING',
    notes?: string
  ) => {
    if (!isManager) {
      onOpenLoginModal();
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      await apiClient.validateActivity(actId, {
        validation_status: decision,
        validated_by: currentUser ? `${currentUser.full_name} (${currentUser.role})` : 'Marcus Brody (Project Manager)',
        validation_notes: notes || (decision === 'APPROVED' ? 'Approved by Project Manager for execution.' : 'Rejected pending supervisor revision.'),
      });

      setFeedbackMsg({
        text: `Activity updated to ${decision === 'APPROVED' ? 'YES (Approved)' : decision === 'REJECTED' ? 'NO (Rejected)' : 'Pending'}`,
        type: 'success',
      });
      onRefreshData();
    } catch (err: any) {
      console.error('Validation error:', err);
      setFeedbackMsg({
        text: err.response?.data?.detail || 'Failed to update activity validation status.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setRejectingActId(null);
    }
  };

  const handleBatchGeotechDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!isManager) {
      onOpenLoginModal();
      return;
    }

    const ids = displayedActivities.map((a) => a.id);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      await apiClient.bulkValidateActivities(project.id, {
        activity_ids: ids,
        validation_status: decision,
        validated_by: currentUser ? `${currentUser.full_name} (${currentUser.role})` : 'Marcus Brody (Project Manager)',
        validation_notes: decision === 'APPROVED' ? 'Batch approved by Project Manager' : 'Batch rejected by Project Manager',
      });

      setFeedbackMsg({
        text: `Successfully applied ${decision === 'APPROVED' ? 'YES (Approved)' : 'NO (Rejected)'} to all ${ids.length} activities.`,
        type: 'success',
      });
      onRefreshData();
    } catch (err: any) {
      setFeedbackMsg({
        text: err.response?.data?.detail || 'Failed to apply batch decision.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                <Pickaxe className="w-3 h-3 text-amber-400" />
                Geotechnical & Substructure Gateway
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Project: {project.code}
              </span>
            </div>

            {/* Manager Auth Status Badge */}
            <div className="flex items-center gap-2">
              {isManager ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">{currentUser?.full_name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-[10px] font-bold">
                    AUTHORIZED PM
                  </span>
                </div>
              ) : (
                <button
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Manager Sign In (YES/NO Access)</span>
                </button>
              )}
            </div>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-brand-400" />
            Geotechnical Activities Plan Review & Manager Decision Gate
          </h2>
          <p className="text-xs text-slate-300 mt-0.5 max-w-3xl leading-relaxed">
            Review soil excavation, shoring, footing and foundation activities submitted to the Project Manager. Authorize execution by selecting <span className="text-emerald-400 font-bold">YES</span> or <span className="text-rose-400 font-bold">NO</span>.
          </p>
        </div>

        {/* Manager Prompt Banner if not logged in */}
        {!isManager && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 px-6 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Manager Authentication Required:</strong> You are currently viewing in read-only mode. Please sign in with manager email (<code className="font-mono bg-amber-100 px-1 rounded">pm@construction.ai</code>) to execute YES / NO decisions.
              </span>
            </div>
            <button
              onClick={onOpenLoginModal}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors"
            >
              Log In Now
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-3 px-6 text-xs flex items-center justify-between border-b ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span className="font-semibold">{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs & Counters */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('geotech')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'geotech'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Pickaxe className="w-3.5 h-3.5" />
              <span>Geotechnical & Foundation Plan ({geotechActivities.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Project Activities ({activities.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('hindrances')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'hindrances'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Difficulties & Hindrances Log ({blockers.length})</span>
            </button>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              {geotechApprovedCount} YES (Approved)
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
              {geotechPendingCount} Pending Review
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
              {geotechRejectedCount} NO (Rejected)
            </span>
          </div>
        </div>

        {/* Action Controls & Filters Bar */}
        {activeTab !== 'hindrances' && (
          <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Search & Status Filter */}
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activity by name or code..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="APPROVED">Approved (YES) Only</option>
                <option value="REJECTED">Rejected (NO) Only</option>
              </select>
            </div>

            {/* Batch Action Buttons */}
            {isManager && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBatchGeotechDecision('APPROVED')}
                  disabled={isSubmitting || displayedActivities.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Approve all currently displayed activities"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>YES to All Filtered ({displayedActivities.length})</span>
                </button>

                <button
                  onClick={() => onOpenLogHindranceModal()}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold transition-colors flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Log Field Hindrance</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Region */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {activeTab === 'hindrances' ? (
            /* Hindrances Register Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Official Project Hindrance Register & Difficulties Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    Logged obstacles, subsurface strata surprises, and delays kept as auditable records.
                  </p>
                </div>
                <button
                  onClick={() => onOpenLogHindranceModal()}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>+ Log New Hindrance</span>
                </button>
              </div>

              {blockers.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-400 text-xs">
                  No difficulties or hindrances logged yet. Operations proceeding without reported impediments.
                </div>
              ) : (
                <div className="space-y-3">
                  {blockers.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.severity === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : b.severity === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {b.severity} SEVERITY
                          </span>

                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white uppercase">
                            {b.hindrance_state || 'ACTIVE_HINDRANCE'}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-500 font-mono">
                            Category: {b.category}
                          </span>

                          {b.activity_name && (
                            <span className="text-[11px] text-brand-600 font-semibold">
                              • Activity: {b.activity_name}
                            </span>
                          )}
                        </div>

                        <p className="text-slate-900 font-medium leading-relaxed">
                          {b.description}
                        </p>

                        {b.difficulty_cause && (
                          <div className="text-[11px] text-slate-500">
                            <strong>Root Cause:</strong> {b.difficulty_cause}
                          </div>
                        )}

                        {b.mitigation_plan && (
                          <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-900">
                            <strong>Mitigation Plan:</strong> {b.mitigation_plan}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-end text-xs space-y-1">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          +{b.delay_impact_days || 0}d Delay Impact
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Opened: {b.opened_date}
                        </span>
                        {b.expected_resolution && (
                          <span className="text-[10px] text-slate-400">
                            Target: {b.expected_resolution}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Activities Table (Geotechnical / All) */
            <div className="space-y-4">
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Activity Name</th>
                      <th className="py-3 px-3">Location / Phase</th>
                      <th className="py-3 px-3">Schedule Window</th>
                      <th className="py-3 px-3">Float / CPM</th>
                      <th className="py-3 px-3">Manager Validation</th>
                      <th className="py-3 px-4 text-right">Manager Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {displayedActivities.map((act) => {
                      const status = act.validation_status || 'PENDING';

                      return (
                        <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Name & Code */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{act.name}</span>
                              {act.is_critical && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                  CRITICAL
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {act.code || `ACT-${act.id}`} • {act.planned_duration} days duration
                            </div>
                          </td>

                          {/* Location / Phase */}
                          <td className="py-3 px-3 text-slate-600">
                            <div className="font-semibold text-slate-800">{act.phase}</div>
                            <div className="text-[11px] text-slate-500">
                              {act.work_package || 'Substructure'} • Floor {act.floor}
                            </div>
                          </td>

                          {/* Window */}
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            <div>{act.start_date ? new Date(act.start_date).toLocaleDateString() : 'N/A'}</div>
                            <div className="text-slate-400">to {act.end_date ? new Date(act.end_date).toLocaleDateString() : 'N/A'}</div>
                          </td>

                          {/* CPM Float */}
                          <td className="py-3 px-3">
                            {act.is_critical ? (
                              <span className="text-[10px] font-bold text-rose-600">0d Float</span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium">Float: {act.total_float || 0}d</span>
                            )}
                          </td>

                          {/* Validation Badge */}
                          <td className="py-3 px-3">
                            {status === 'APPROVED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                  <Check className="w-3 h-3" />
                                  YES (APPROVED)
                                </span>
                                {act.validated_by && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[130px]">
                                    by {act.validated_by}
                                  </div>
                                )}
                              </div>
                            ) : status === 'REJECTED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-300">
                                  <X className="w-3 h-3" />
                                  NO (REJECTED)
                                </span>
                                {act.validation_notes && (
                                  <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[140px]" title={act.validation_notes}>
                                    Note: {act.validation_notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Clock className="w-3 h-3" />
                                PENDING REVIEW
                              </span>
                            )}
                          </td>

                          {/* Actions (YES / NO / Log Hindrance) */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* YES Button */}
                              <button
                                onClick={() => handleValidateActivity(act.id, 'APPROVED')}
                                disabled={isSubmitting}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                  status === 'APPROVED'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-300'
                                }`}
                                title="Approve activity for construction (YES)"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>YES</span>
                              </button>

                              {/* NO Button */}
                              <button
                                onClick={() => {
                                  if (!isManager) {
                                    onOpenLoginModal();
                                    return;
                                  }
                                  setRejectingActId(act.id);
                                }}
                                disabled={isSubmitting}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                  status === 'REJECTED'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-800 border border-rose-300'
                                }`}
                                title="Reject activity / request rework (NO)"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>NO</span>
                              </button>

                              {/* Log Hindrance Shortcut */}
                              <button
                                onClick={() => onOpenLogHindranceModal(act.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="Log a difficulty / hindrance for this activity"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {displayedActivities.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No activities match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rejection Note Popup Modal */}
        {rejectingActId !== null && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-20">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Manager Rejection Note (NO)
                </h4>
                <button
                  onClick={() => setRejectingActId(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Specify the reason for withholding approval on this activity:
              </p>

              <textarea
                rows={3}
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRejectingActId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleValidateActivity(rejectingActId, 'REJECTED', rejectionNotes)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  Confirm NO (Reject)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Project: <strong>{project.name}</strong></span>
            <span>•</span>
            <span>Total Activities: {activities.length}</span>
            <span>•</span>
            <span>Geotechnical Activities: {geotechActivities.length}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors"
          >
            Close Gateway
          </button>
        </div>
      </div>
    </div>
  );
};
