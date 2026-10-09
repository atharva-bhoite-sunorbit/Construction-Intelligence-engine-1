import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  HardHat,
  MessageSquare,
  Lock,
  Unlock,
  CheckCheck,
  UserCheck,
  Eye,
  BarChart3,
  ArrowRight,
  FileText,
  Award,
  Send,
  Building2,
  Users,
  Pickaxe
} from 'lucide-react';
import { Activity, Project, User, GovernanceSummary } from '../types';
import { apiClient } from '../api/client';

export type GovernanceRole = 'Site Engineer' | 'Site Manager' | 'Admin' | 'Project Manager' | 'Top Management';

interface PMActivitySectionValidationProps {
  project: Project;
  activities: Activity[];
  currentUser?: User | null;
  onRefreshData: () => void;
}

type GroupByOption = 'phase' | 'work_package' | 'floor';
type StatusFilterOption = 'all' | 'PENDING' | 'AWAITING_ADMIN_VERIFICATION' | 'AWAITING_PM_VERIFICATION' | 'RECORDED' | 'REJECTED';

const REJECTION_PRESETS = [
  'Predecessor activity / structural sign-off not certified',
  'Crew manpower & trade subcontractor muster inadequate',
  'Material delivery schedule / test cube cert unverified',
  'Conflicting site workfront / safety clearance unresolved',
  'Engineering drawing revision pending consultant signoff',
  'Duration underestimated for current weather / site conditions',
  'Geotechnical SPT N-value / core borelog density unverified',
  'Excavation slope stability / pit dewatering discharge capacity inadequate'
];

export const PMActivitySectionValidation: React.FC<PMActivitySectionValidationProps> = ({
  project,
  activities,
  currentUser,
  onRefreshData,
}) => {
  // Determine active governance role (defaults to logged-in user role if recognized, else Site Engineer or Site Manager)
  const initialRole: GovernanceRole = useMemo(() => {
    if (currentUser?.role) {
      if (currentUser.role.includes('Site Engineer') || currentUser.role.includes('Engineer')) return 'Site Engineer';
      if (currentUser.role.includes('Site Manager') || currentUser.role === 'Manager') return 'Site Manager';
      if (currentUser.role.includes('Admin')) return 'Admin';
      if (currentUser.role.includes('Project Manager')) return 'Project Manager';
      if (currentUser.role.includes('Top Management') || currentUser.role.includes('Executive') || currentUser.role.includes('Director')) return 'Top Management';
    }
    return 'Site Engineer';
  }, [currentUser]);

  const [activeRole, setActiveRole] = useState<GovernanceRole>(initialRole);

  // Sync if currentUser changes
  useEffect(() => {
    if (currentUser?.role) {
      if (currentUser.role.includes('Site Engineer') || currentUser.role.includes('Engineer')) setActiveRole('Site Engineer');
      else if (currentUser.role.includes('Site Manager') || currentUser.role === 'Manager') setActiveRole('Site Manager');
      else if (currentUser.role.includes('Admin')) setActiveRole('Admin');
      else if (currentUser.role.includes('Project Manager')) setActiveRole('Project Manager');
      else if (currentUser.role.includes('Top Management') || currentUser.role.includes('Executive') || currentUser.role.includes('Director')) setActiveRole('Top Management');
    }
  }, [currentUser]);

  // Admin sub-tabs: 'geotech_queue' (Awaiting Admin Verification for Geotechnical & Excavation activities), 'statutory' (Direct statutory activities)
  const [adminSubTab, setAdminSubTab] = useState<'geotech_queue' | 'statutory'>('geotech_queue');

  // Project Manager sub-tabs: 'queue' (Awaiting PM Verification), 'direct' (PM Direct structural items), 'all' (Master registry)
  const [pmSubTab, setPmSubTab] = useState<'queue' | 'direct' | 'all'>('queue');

  // Top Management sub-tabs: 'recorded' (Officially Recorded Registry), 'summary' (Executive Governance Matrix)
  const [topMgmtSubTab, setTopMgmtSubTab] = useState<'summary' | 'recorded'>('summary');

  // Grouping & Filtering state
  const [groupBy, setGroupBy] = useState<GroupByOption>('phase');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showOtherRolesInReadOnly, setShowOtherRolesInReadOnly] = useState(false);

  // Selection state for bulk operations
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);

  // Action states
  const [loadingActivityId, setLoadingActivityId] = useState<number | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [rejectingActivity, setRejectingActivity] = useState<Activity | null>(null);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_PRESETS[0]);
  const [customRejectionNote, setCustomRejectionNote] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Live Governance Summary state for Top Management view
  const [governanceSummary, setGovernanceSummary] = useState<GovernanceSummary | null>(null);

  const fetchSummary = async () => {
    try {
      const sum = await apiClient.getGovernanceSummary(project.id);
      setGovernanceSummary(sum);
    } catch (err) {
      console.error('Failed to load governance summary:', err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [project.id, activities]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 3800);
  };

  // Compute active user display label
  const activeReviewerName = useMemo(() => {
    if (activeRole === 'Site Engineer') return 'Liam Chen (Site Engineer)';
    if (activeRole === 'Site Manager') return 'Elena Rostova (Site Manager)';
    if (activeRole === 'Admin') return 'Alexander Vance (Admin)';
    if (activeRole === 'Project Manager') return 'Marcus Brody (Project Manager)';
    return 'Sophia Sterling (Top Management)';
  }, [activeRole]);

  // Role activities partitioning:
  // All users have different activities!
  const roleActivities = useMemo(() => {
    if (activeRole === 'Site Engineer') {
      return activities.filter(
        (a) =>
          a.assigned_role === 'Site Engineer' ||
          (a.code || '').toUpperCase().startsWith('GX-') ||
          (a.work_package || '').toLowerCase().includes('geotech') ||
          (a.work_package || '').toLowerCase().includes('excavation')
      );
    }
    if (activeRole === 'Site Manager') {
      return activities.filter((a) => (a.assigned_role || 'Site Manager') === 'Site Manager');
    }
    if (activeRole === 'Admin') {
      if (adminSubTab === 'geotech_queue') {
        // Awaiting Admin Verification queue (Site Engineer validated activities)
        return activities.filter(
          (a) =>
            !a.final_recorded &&
            (a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
              (a.stage1_status === 'APPROVED' &&
                (a.assigned_role === 'Site Engineer' || (a.code || '').toUpperCase().startsWith('GX-'))))
        );
      }
      return activities.filter((a) => a.assigned_role === 'Admin');
    }
    if (activeRole === 'Project Manager') {
      if (pmSubTab === 'queue') {
        // Awaiting PM Verification queue (activities approved by Site Manager or Admin statutory)
        return activities.filter(
          (a) =>
            !a.final_recorded &&
            (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
              (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager' && a.assigned_role !== 'Site Engineer'))
        );
      }
      if (pmSubTab === 'direct') {
        // PM direct structural activities
        return activities.filter((a) => a.assigned_role === 'Project Manager');
      }
      // Master registry
      return activities;
    }
    // Top Management
    if (topMgmtSubTab === 'recorded') {
      return activities.filter((a) => a.final_recorded === true);
    }
    return activities;
  }, [activities, activeRole, adminSubTab, pmSubTab, topMgmtSubTab]);

  // Filtered displayed activities based on search and status
  const displayedActivities = useMemo(() => {
    let pool = roleActivities;
    if (activeRole !== 'Top Management' && activeRole !== 'Project Manager' && showOtherRolesInReadOnly) {
      pool = activities;
    }

    return pool.filter((act) => {
      const matchesSearch =
        act.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (act.code && act.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (act.work_package && act.work_package.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (act.assigned_role && act.assigned_role.toLowerCase().includes(searchQuery.toLowerCase()));

      let currentStatus: string = act.validation_status || 'PENDING';
      if (act.final_recorded) currentStatus = 'RECORDED';

      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [roleActivities, activities, activeRole, showOtherRolesInReadOnly, searchQuery, statusFilter]);

  // Overall statistics for active role
  const roleStats = useMemo(() => {
    const total = roleActivities.length;
    const recorded = roleActivities.filter((a) => a.final_recorded).length;
    const awaitingPm = roleActivities.filter(
      (a) =>
        !a.final_recorded &&
        (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
          (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
    ).length;
    const pendingStage1 = roleActivities.filter(
      (a) => !a.final_recorded && (!a.validation_status || a.validation_status === 'PENDING') && a.stage1_status === 'PENDING'
    ).length;
    const rejected = roleActivities.filter(
      (a) => a.validation_status === 'REJECTED' || a.stage1_status === 'REJECTED' || a.pm_verification_status === 'REJECTED'
    ).length;

    return { total, recorded, awaitingPm, pendingStage1, rejected };
  }, [roleActivities]);

  // Grouped sections
  const sections = useMemo(() => {
    const map = new Map<string, Activity[]>();

    displayedActivities.forEach((act) => {
      let key = 'General';
      if (groupBy === 'phase') {
        key = act.phase || 'Unassigned Phase';
      } else if (groupBy === 'work_package') {
        key = act.work_package || act.category || 'General Works';
      } else if (groupBy === 'floor') {
        key = act.floor !== undefined && act.floor !== null ? `Floor ${act.floor} (${act.tower || 'Tower A'})` : 'Ground Level';
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(act);
    });

    return Array.from(map.entries()).map(([sectionName, sectionActivities]) => {
      const totalCount = sectionActivities.length;
      const recordedCount = sectionActivities.filter((a) => a.final_recorded).length;
      const awaitingCount = sectionActivities.filter(
        (a) =>
          !a.final_recorded &&
          (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
            a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
            (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
      ).length;
      const pendingCount = sectionActivities.filter(
        (a) => !a.final_recorded && (!a.validation_status || a.validation_status === 'PENDING') && a.stage1_status === 'PENDING'
      ).length;

      return {
        sectionName,
        activities: sectionActivities,
        totalCount,
        recordedCount,
        awaitingCount,
        pendingCount,
      };
    });
  }, [displayedActivities, groupBy]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: prev[sectionName] === undefined ? false : !prev[sectionName],
    }));
  };

  const isSectionExpanded = (sectionName: string) => {
    return expandedSections[sectionName] !== false;
  };

  // Action: Single Validate YES
  const handleValidateYes = async (activity: Activity) => {
    if (activeRole === 'Top Management') {
      showToast('Top Management role has executive read-only oversight. Validation restricted.', 'error');
      return;
    }

    setLoadingActivityId(activity.id);
    try {
      if (activeRole === 'Site Engineer') {
        await apiClient.validateActivity(activity.id, {
          validation_status: 'APPROVED',
          validator_role: 'Site Engineer',
          validated_by: activeReviewerName,
          validation_notes: 'Validated by Site Engineer. Subsurface & excavation specifications certified and forwarded to Admin for final verification.',
        });
        showToast(`Site Engineer validated "${activity.name}". Forwarded to Admin for final verification!`);
      } else if (activeRole === 'Project Manager') {
        if (activity.assigned_role === 'Project Manager') {
          // Direct PM structural milestone validation
          await apiClient.validateActivity(activity.id, {
            validation_status: 'APPROVED',
            validator_role: 'Project Manager',
            validated_by: activeReviewerName,
            validation_notes: 'PM Direct structural sign-off: reinforcement & pour certified.',
          });
          showToast(`Direct Activity "${activity.name}" APPROVED & RECORDED!`);
        } else {
          // PM Stage 2 Verification of Manager/Admin activity
          await apiClient.validateActivity(activity.id, {
            validation_status: 'APPROVED',
            action_type: 'PM_VERIFY',
            validator_role: 'Project Manager',
            validated_by: activeReviewerName,
            validation_notes: `PM Countersign Verification certified following ${activity.assigned_role} sign-off. Officially Recorded.`,
          });
          showToast(`Activity "${activity.name}" PM VERIFIED & OFFICIALLY RECORDED!`);
        }
      } else if (activeRole === 'Site Manager') {
        await apiClient.validateActivity(activity.id, {
          validation_status: 'APPROVED',
          validator_role: 'Site Manager',
          validated_by: activeReviewerName,
          validation_notes: 'Validated by Site Manager. Workfront inspected & forwarded for PM verification.',
        });
        showToast(`Site Manager validated "${activity.name}". Queued for Project Manager verification.`);
      } else if (activeRole === 'Admin') {
        const isGeotechTask =
          activity.assigned_role === 'Site Engineer' ||
          (activity.code || '').toUpperCase().startsWith('GX-') ||
          (activity.work_package || '').toLowerCase().includes('geotech') ||
          (activity.work_package || '').toLowerCase().includes('excavation');

        if (isGeotechTask) {
          // Admin Stage 2 Final Verification of Site Engineer's task
          await apiClient.validateActivity(activity.id, {
            validation_status: 'APPROVED',
            action_type: 'ADMIN_VERIFY',
            validator_role: 'Admin',
            validated_by: activeReviewerName,
            validation_notes: 'Verified & countersigned by Admin after Site Engineer geotechnical validation. Officially recorded.',
          });
          showToast(`Activity "${activity.name}" ADMIN VERIFIED & OFFICIALLY RECORDED!`);
        } else {
          // Admin Stage 1 Validation of statutory task
          await apiClient.validateActivity(activity.id, {
            validation_status: 'APPROVED',
            validator_role: 'Admin',
            validated_by: activeReviewerName,
            validation_notes: 'Validated by Admin. Statutory documentation & permits cleared.',
          });
          showToast(`Admin validated "${activity.name}". Queued for Project Manager verification.`);
        }
      }

      onRefreshData();
      fetchSummary();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Validation failed. Check permissions.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Action: Confirm Rejection NO
  const handleConfirmReject = async () => {
    if (!rejectingActivity) return;
    const note = customRejectionNote.trim() ? `${rejectionReason} - ${customRejectionNote.trim()}` : rejectionReason;

    setLoadingActivityId(rejectingActivity.id);
    try {
      await apiClient.validateActivity(rejectingActivity.id, {
        validation_status: 'REJECTED',
        validator_role: activeRole,
        validated_by: activeReviewerName,
        validation_notes: note,
      });

      showToast(`Activity "${rejectingActivity.name}" REJECTED (${note})`, 'info');
      setRejectingActivity(null);
      setCustomRejectionNote('');
      onRefreshData();
      fetchSummary();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Rejection failed.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Action: Reset Activity back to PENDING
  const handleResetActivity = async (activity: Activity) => {
    setLoadingActivityId(activity.id);
    try {
      await apiClient.validateActivity(activity.id, {
        validation_status: 'PENDING',
        action_type: 'RESET',
        validator_role: activeRole,
        validated_by: activeReviewerName,
      });
      showToast(`Activity "${activity.name}" reset to PENDING status.`);
      onRefreshData();
      fetchSummary();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Reset failed.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Action: Bulk Validate Selected Activities
  const handleBulkValidate = async (decision: 'APPROVED' | 'REJECTED') => {
    if (selectedActivityIds.length === 0) return;
    if (activeRole === 'Top Management') {
      showToast('Top Management role has executive read-only oversight.', 'error');
      return;
    }

    setIsBulkLoading(true);
    try {
      const res = await apiClient.bulkValidateActivities(project.id, {
        activity_ids: selectedActivityIds,
        validation_status: decision,
        validator_role: activeRole,
        validated_by: activeReviewerName,
        validation_notes: `Bulk ${decision} processed by ${activeReviewerName}`,
      });

      showToast(`Bulk updated ${res.updated_count} activities as ${decision}!`);
      setSelectedActivityIds([]);
      onRefreshData();
      fetchSummary();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Bulk operation failed.', 'error');
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Toggle selection
  const toggleSelectActivity = (id: number) => {
    setSelectedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllInView = () => {
    const ids = displayedActivities.map((a) => a.id);
    setSelectedActivityIds(ids);
  };

  const clearSelection = () => {
    setSelectedActivityIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-4 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-500/50 shadow-emerald-900/20'
              : feedbackToast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-500/50 shadow-rose-900/20'
              : 'bg-amber-950 text-amber-100 border-amber-500/50 shadow-amber-900/20'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedbackToast.type === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Reject Activity Sign-Off</h3>
                  <p className="text-[11px] text-rose-100">
                    {rejectingActivity.code} • {rejectingActivity.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingActivity(null)}
                className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Select Primary Rejection Reason:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {REJECTION_PRESETS.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Additional Corrective Remarks & Directives (Optional):
                </label>
                <textarea
                  rows={3}
                  value={customRejectionNote}
                  onChange={(e) => setCustomRejectionNote(e.target.value)}
                  placeholder="Specify deficiency location, missing submittals, or required remediation..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-[11px]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Governance Notice:
                </span>
                <p>
                  Rejecting this activity sets status to REJECTED and records an audit log entry signed by{' '}
                  <span className="font-bold">{activeReviewerName}</span>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setRejectingActivity(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={loadingActivityId !== null}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Switcher & Governance Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl border border-slate-700/60 p-6 text-white shadow-xl shadow-slate-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40 flex items-center gap-1 uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-brand-400" />
                Multi-Tier Governance Architecture
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                Two-Tier Verification Gate
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Activity Validation & Verification Hub</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Every role owns distinct activities. Geotechnical & excavation activities validated by{' '}
              <span className="font-semibold text-teal-300">Site Engineer</span> are forwarded to{' '}
              <span className="font-semibold text-blue-300">Admin</span> for final verification. Field operations validated by{' '}
              <span className="font-semibold text-emerald-300">Site Manager</span> are verified by the{' '}
              <span className="font-semibold text-indigo-300">Project Manager</span>. Finally,{' '}
              <span className="font-semibold text-purple-300">Top Management</span> maintains executive visibility.
            </p>
          </div>

          {/* Active Reviewer Card */}
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center gap-3 shrink-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
                activeRole === 'Site Engineer'
                  ? 'bg-teal-600'
                  : activeRole === 'Site Manager'
                  ? 'bg-emerald-600'
                  : activeRole === 'Admin'
                  ? 'bg-blue-600'
                  : activeRole === 'Project Manager'
                  ? 'bg-indigo-600'
                  : 'bg-purple-600'
              }`}
            >
              {activeRole === 'Site Engineer' && <Layers className="w-5 h-5" />}
              {activeRole === 'Site Manager' && <HardHat className="w-5 h-5" />}
              {activeRole === 'Admin' && <ShieldCheck className="w-5 h-5" />}
              {activeRole === 'Project Manager' && <CheckCheck className="w-5 h-5" />}
              {activeRole === 'Top Management' && <Eye className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Active View & Authority
              </div>
              <div className="text-xs font-extrabold text-white">{activeReviewerName}</div>
              <div className="text-[10px] text-slate-400 font-mono">Role: {activeRole}</div>
            </div>
          </div>
        </div>

        {/* 5 Interactive Role Switcher Tabs */}
        <div className="pt-5">
          <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span>Switch Role Perspective (Test All Users Individually):</span>
            <span className="text-[10px] text-slate-400 font-normal">
              Click any role to see their exclusive activities and verification gate
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* 1. Site Engineer */}
            <button
              onClick={() => setActiveRole('Site Engineer')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeRole === 'Site Engineer'
                  ? 'bg-teal-600/20 border-teal-500 shadow-md shadow-teal-950 text-white'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  Site Engineer
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-extrabold">
                  Geotech Gate
                </span>
              </div>
              <div className="font-bold text-xs truncate">Liam Chen</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Borelogs, SPT, Excavation, Shoring
              </div>
            </button>

            {/* 2. Site Manager */}
            <button
              onClick={() => setActiveRole('Site Manager')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeRole === 'Site Manager'
                  ? 'bg-emerald-600/20 border-emerald-500 shadow-md shadow-emerald-950 text-white'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <HardHat className="w-3.5 h-3.5" />
                  Site Manager
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold">
                  Stage 1 Gate
                </span>
              </div>
              <div className="font-bold text-xs truncate">Elena Rostova</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Masonry, MEP, Finishes, Rough-ins
              </div>
            </button>

            {/* 3. Admin */}
            <button
              onClick={() => setActiveRole('Admin')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeRole === 'Admin'
                  ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-950 text-white'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold">
                  Geotech Verifier
                </span>
              </div>
              <div className="font-bold text-xs truncate">Alexander Vance</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Permits & Final Geotech Verifier
              </div>
            </button>

            {/* 4. Project Manager */}
            <button
              onClick={() => setActiveRole('Project Manager')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeRole === 'Project Manager'
                  ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-950 text-white'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Project Manager
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-extrabold">
                  Master Verifier
                </span>
              </div>
              <div className="font-bold text-xs truncate">Marcus Brody</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Structural Path & PM Verifier
              </div>
            </button>

            {/* 5. Top Management */}
            <button
              onClick={() => setActiveRole('Top Management')}
              className={`p-3 rounded-xl border text-left transition-all col-span-2 md:col-span-1 ${
                activeRole === 'Top Management'
                  ? 'bg-purple-600/20 border-purple-500 shadow-md shadow-purple-950 text-white'
                  : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  Top Management
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-extrabold">
                  Executive View
                </span>
              </div>
              <div className="font-bold text-xs truncate">Sophia Sterling</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Certified Records & Oversight
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Role Guidance Alert */}
        <div className="mt-4 p-3 rounded-xl text-xs flex items-start gap-2.5 bg-slate-800/80 border border-slate-700">
          <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-slate-300 text-[11px] leading-relaxed">
            {activeRole === 'Site Engineer' && (
              <p>
                <strong className="text-white">Site Engineer Geotechnical & Excavation Scope:</strong> You validate geotechnical soil investigations, borelog profiles, SPT test records, bulk excavation earthworks, pit shoring, and dewatering. Clicking{' '}
                <span className="text-teal-300 font-bold">Validate (YES)</span> approves Stage 1 and forwards the task directly to{' '}
                <span className="text-blue-300 font-bold">Admin for Final Verification</span>. The task will{' '}
                <strong className="text-amber-300">ONLY be officially recorded once verified by Admin</strong>.
              </p>
            )}
            {activeRole === 'Site Manager' && (
              <p>
                <strong className="text-white">Site Manager Scope:</strong> You can only validate Site Manager activities (masonry, finishes, MEP). Clicking{' '}
                <span className="text-emerald-300 font-bold">Validate (YES)</span> approves Stage 1 and forwards the activity into the{' '}
                <span className="text-indigo-300 font-bold">Awaiting PM Verification</span> queue. It will{' '}
                <strong className="text-amber-300">ONLY be recorded once verified by the Project Manager</strong>.
              </p>
            )}
            {activeRole === 'Admin' && (
              <p>
                <strong className="text-white">Admin Scope & Final Verification Gate:</strong> (1) You validate administrative statutory tasks (surveys, licenses, handover) which forward to PM. (2){' '}
                <strong className="text-blue-300">Final Verification Authority:</strong> You perform Stage 2 Final Verification on Site Engineer's Geotechnical & Excavation activities in the verification queue below—countersigning and officially recording them into the master project ledger.
              </p>
            )}
            {activeRole === 'Project Manager' && (
              <p>
                <strong className="text-white">Project Manager Dual Authority:</strong> (1) You directly validate core structural milestones (slabs, columns, cranes) which become recorded immediately. (2){' '}
                <strong className="text-indigo-300">Mandatory Countersign Gate:</strong> You verify and countersign activities submitted by Site Manager and Admin in the queue below—only upon your verification are they officially recorded.
              </p>
            )}
            {activeRole === 'Top Management' && (
              <p>
                <strong className="text-white">Top Management Executive Portal:</strong> Read-only executive oversight. Displays real-time recording completion rates, role-by-role compliance matrices across all operational gates, and the master certified registry of all recorded activities.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation Bar */}
      {activeRole === 'Admin' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAdminSubTab('geotech_queue')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                adminSubTab === 'geotech_queue'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Awaiting Admin Verification Queue (Geotech & Excavation)</span>
              {activities.filter(
                (a) =>
                  !a.final_recorded &&
                  (a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
                    (a.stage1_status === 'APPROVED' &&
                      (a.assigned_role === 'Site Engineer' || (a.code || '').toUpperCase().startsWith('GX-'))))
              ).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-extrabold text-[10px]">
                  {
                    activities.filter(
                      (a) =>
                        !a.final_recorded &&
                        (a.validation_status === 'AWAITING_ADMIN_VERIFICATION' ||
                          (a.stage1_status === 'APPROVED' &&
                            (a.assigned_role === 'Site Engineer' || (a.code || '').toUpperCase().startsWith('GX-'))))
                    ).length
                  }
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminSubTab('statutory')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                adminSubTab === 'statutory'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Statutory & Compliance Tasks</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {adminSubTab === 'geotech_queue'
              ? 'Site Engineer validated tasks awaiting your final statutory & geotechnical sign-off'
              : 'Direct administrative permits, clearances, and handover milestones'}
          </div>
        </div>
      )}

      {/* Role-Specific Sub-Navigation Bar */}
      {activeRole === 'Project Manager' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPmSubTab('queue')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                pmSubTab === 'queue'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Awaiting PM Verification Queue</span>
              {activities.filter(
                (a) =>
                  !a.final_recorded &&
                  (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
                    (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
              ).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-extrabold text-[10px]">
                  {
                    activities.filter(
                      (a) =>
                        !a.final_recorded &&
                        (a.validation_status === 'AWAITING_PM_VERIFICATION' ||
                          (a.stage1_status === 'APPROVED' && a.assigned_role !== 'Project Manager'))
                    ).length
                  }
                </span>
              )}
            </button>

            <button
              onClick={() => setPmSubTab('direct')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                pmSubTab === 'direct'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>PM Direct Structural Activities</span>
              <span className="text-[10px] text-slate-500">
                ({activities.filter((a) => a.assigned_role === 'Project Manager').length})
              </span>
            </button>

            <button
              onClick={() => setPmSubTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                pmSubTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Project Activities</span>
              <span className="text-[10px] text-slate-500">({activities.length})</span>
            </button>
          </div>

          {pmSubTab === 'queue' && (
            <div className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
              ⚡ Action: Countersign verified items to officially record them.
            </div>
          )}
        </div>
      )}

      {activeRole === 'Top Management' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTopMgmtSubTab('summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                topMgmtSubTab === 'summary'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Executive Multi-Tier Matrix</span>
            </button>

            <button
              onClick={() => setTopMgmtSubTab('recorded')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                topMgmtSubTab === 'recorded'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Officially Recorded Registry (PM Verified)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                {activities.filter((a) => a.final_recorded).length}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Executive Read-Only Oversight Mode</span>
          </div>
        </div>
      )}

      {/* Top Management: Executive Summary Cards & Matrix View */}
      {activeRole === 'Top Management' && topMgmtSubTab === 'summary' && governanceSummary && (
        <div className="space-y-5 animate-in fade-in">
          {/* Executive KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Activities
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {governanceSummary.total_activities}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">100% Work Breakdown</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Officially Recorded
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {governanceSummary.final_recorded_count}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">
                {governanceSummary.recorded_percentage}% Certified Master
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-teal-200 shadow-xs">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Awaiting Admin (Geotech)
              </span>
              <div className="text-2xl font-black text-teal-600 mt-1">
                {governanceSummary.awaiting_admin_count ?? 0}
              </div>
              <span className="text-[10px] text-teal-700 font-medium">
                SE Validated Geotech/Excavation
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-xs">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Awaiting PM (Ops/Admin)
              </span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {governanceSummary.awaiting_pm_count}
              </div>
              <span className="text-[10px] text-amber-700 font-medium">
                Stage 1 Approved by Manager/Admin
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pending Stage 1
              </span>
              <div className="text-2xl font-black text-slate-750 mt-1">
                {governanceSummary.pending_stage1_count}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Awaiting SE / SM / Admin</span>
            </div>
          </div>

          {/* 4-Tier Multi-Role Breakdown Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Governance Pipeline Matrix by Owner Role
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Project: {project.code} • {project.name}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 lg:divide-x divide-slate-200">
              {/* Site Engineer Stats */}
              {governanceSummary.roles['Site Engineer'] && (
                <div className="p-5 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                        <Pickaxe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">Site Engineer Geotech</h4>
                        <span className="text-[10px] text-slate-400">Liam Chen</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      {governanceSummary.roles['Site Engineer'].total} Activities
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Officially Recorded (Admin Verified):</span>
                      <strong className="text-teal-700">
                        {governanceSummary.roles['Site Engineer'].final_recorded}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Awaiting Admin Verification:</span>
                      <strong className="text-amber-600">
                        {governanceSummary.roles['Site Engineer'].awaiting_admin_verification ?? 0}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Pending Stage 1 Review:</span>
                      <span className="text-slate-800 font-medium">
                        {governanceSummary.roles['Site Engineer'].pending_validation}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Rejected:</span>
                      <span className="text-rose-600 font-medium">
                        {governanceSummary.roles['Site Engineer'].rejected}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Recording Completion</span>
                      <span className="font-bold text-slate-900">
                        {governanceSummary.roles['Site Engineer'].recorded_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${governanceSummary.roles['Site Engineer'].recorded_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Site Manager Stats */}
              {governanceSummary.roles['Site Manager'] && (
                <div className="p-5 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">Site Manager Operations</h4>
                        <span className="text-[10px] text-slate-400">Elena Rostova</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {governanceSummary.roles['Site Manager'].total} Activities
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Officially Recorded (PM Verified):</span>
                      <strong className="text-emerald-700">
                        {governanceSummary.roles['Site Manager'].final_recorded}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Awaiting PM Countersign:</span>
                      <strong className="text-amber-600">
                        {governanceSummary.roles['Site Manager'].awaiting_pm_verification}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Pending Stage 1 Validation:</span>
                      <span className="text-slate-800 font-medium">
                        {governanceSummary.roles['Site Manager'].pending_validation}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Rejected:</span>
                      <span className="text-rose-600 font-medium">
                        {governanceSummary.roles['Site Manager'].rejected}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Recording Completion</span>
                      <span className="font-bold text-slate-900">
                        {governanceSummary.roles['Site Manager'].recorded_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${governanceSummary.roles['Site Manager'].recorded_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Stats */}
              {governanceSummary.roles['Admin'] && (
                <div className="p-5 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">Admin Statutory & Mobilization</h4>
                        <span className="text-[10px] text-slate-400">Alexander Vance</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {governanceSummary.roles['Admin'].total} Activities
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Officially Recorded (PM Verified):</span>
                      <strong className="text-blue-700">
                        {governanceSummary.roles['Admin'].final_recorded}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Awaiting PM Countersign:</span>
                      <strong className="text-amber-600">
                        {governanceSummary.roles['Admin'].awaiting_pm_verification}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Pending Stage 1 Validation:</span>
                      <span className="text-slate-800 font-medium">
                        {governanceSummary.roles['Admin'].pending_validation}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Rejected:</span>
                      <span className="text-rose-600 font-medium">
                        {governanceSummary.roles['Admin'].rejected}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Recording Completion</span>
                      <span className="font-bold text-slate-900">
                        {governanceSummary.roles['Admin'].recorded_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${governanceSummary.roles['Admin'].recorded_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Project Manager Stats */}
              {governanceSummary.roles['Project Manager'] && (
                <div className="p-5 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <CheckCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">PM Structural Milestones</h4>
                        <span className="text-[10px] text-slate-400">Marcus Brody</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      {governanceSummary.roles['Project Manager'].total} Activities
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Direct PM Recorded:</span>
                      <strong className="text-indigo-700">
                        {governanceSummary.roles['Project Manager'].final_recorded}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Pending Direct PM Sign-Off:</span>
                      <span className="text-slate-800 font-medium">
                        {governanceSummary.roles['Project Manager'].pending_validation}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>PM Verified Queue (All Roles):</span>
                      <strong className="text-emerald-700">
                        {governanceSummary.final_recorded_count} Total Recorded
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Rejected:</span>
                      <span className="text-rose-600 font-medium">
                        {governanceSummary.roles['Project Manager'].rejected}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Recording Completion</span>
                      <span className="font-bold text-slate-900">
                        {governanceSummary.roles['Project Manager'].recorded_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${governanceSummary.roles['Project Manager'].recorded_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent PM Verifications Stream */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                  Recent Project Manager Verifications & Audit Provenance
                </h3>
              </div>
              <button
                onClick={() => setTopMgmtSubTab('recorded')}
                className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <span>View All Recorded Activities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {governanceSummary.recent_verifications.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No activities verified yet. Site Manager & Admin must approve Stage 1, followed by PM verification.
                </div>
              ) : (
                governanceSummary.recent_verifications.map((item) => (
                  <div key={item.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-700">{item.code || `ACT-${item.id}`}</span>
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            item.assigned_role === 'Site Manager'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.assigned_role === 'Admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {item.assigned_role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3">
                        {item.stage1_validated_by && (
                          <span>Stage 1: {item.stage1_validated_by}</span>
                        )}
                        {item.pm_verified_by && (
                          <span className="font-semibold text-emerald-700">
                            PM Verification: {item.pm_verified_by}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {item.final_recorded ? (
                        <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          OFFICIALLY RECORDED
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300">
                          AWAITING PM
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace (Site Manager, Admin, PM, or Top Management Recorded Table) */}
      {(activeRole !== 'Top Management' || topMgmtSubTab === 'recorded') && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters, Grouping, Bulk Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeRole} activities...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Group:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="phase">By Phase</option>
                  <option value="work_package">By Work Package</option>
                  <option value="floor">By Floor</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="AWAITING_PM_VERIFICATION">Awaiting PM Verification</option>
                  <option value="RECORDED">Officially Recorded</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              {activeRole !== 'Top Management' && (
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={showOtherRolesInReadOnly}
                    onChange={(e) => setShowOtherRolesInReadOnly(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Show all project roles (read-only)</span>
                </label>
              )}
            </div>

            {/* Bulk Actions for Authorized Roles */}
            {activeRole !== 'Top Management' && (
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {selectedActivityIds.length > 0 ? (
                  <>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                      {selectedActivityIds.length} Selected
                    </span>
                    <button
                      onClick={() => handleBulkValidate('APPROVED')}
                      disabled={isBulkLoading}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{activeRole === 'Project Manager' ? 'Bulk Verify & Record' : 'Bulk Validate YES'}</span>
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px]"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    onClick={selectAllInView}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                  >
                    Select All in View
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity Sections */}
          <div className="space-y-4">
            {sections.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
                <h4 className="font-bold text-sm text-slate-700">No Activities Found</h4>
                <p className="text-xs max-w-md mx-auto">
                  No activities matching the current filter in this role's workspace.
                </p>
              </div>
            ) : (
              sections.map((sec) => {
                const expanded = isSectionExpanded(sec.sectionName);
                return (
                  <div
                    key={sec.sectionName}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Section Header */}
                    <div
                      onClick={() => toggleSection(sec.sectionName)}
                      className="p-4 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs tracking-tight flex items-center gap-2">
                            <span>{sec.sectionName}</span>
                            <span className="text-[10px] font-normal text-slate-500 font-mono">
                              ({sec.totalCount} items)
                            </span>
                          </h4>
                        </div>
                      </div>

                      {/* Section mini badges */}
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        {sec.recordedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {sec.recordedCount} Recorded
                          </span>
                        )}
                        {sec.awaitingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {sec.awaitingCount} Awaiting Verification
                          </span>
                        )}
                        {sec.pendingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {sec.pendingCount} Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section Activity Items */}
                    {expanded && (
                      <div className="divide-y divide-slate-100">
                        {sec.activities.map((act) => {
                          const isSelected = selectedActivityIds.includes(act.id);
                          const isGeotechTask =
                            act.assigned_role === 'Site Engineer' ||
                            act.work_package === 'Geotechnical & Excavation' ||
                            (act.code && act.code.toUpperCase().startsWith('GX-')) ||
                            (act.category && act.category.toLowerCase().includes('excavation')) ||
                            (act.name && (
                              act.name.toLowerCase().includes('geotech') ||
                              act.name.toLowerCase().includes('soil') ||
                              act.name.toLowerCase().includes('borehole') ||
                              act.name.toLowerCase().includes('excavation')
                            ));

                          const isOwnRole =
                            (isGeotechTask
                              ? activeRole === 'Site Engineer'
                              : (act.assigned_role || 'Site Manager') === activeRole) ||
                            (activeRole === 'Project Manager' && pmSubTab === 'queue' && !isGeotechTask) ||
                            (activeRole === 'Admin' && adminSubTab === 'geotech_queue' && isGeotechTask);

                          const canValidate =
                            activeRole !== 'Top Management' &&
                            (
                              (activeRole === 'Site Engineer' && isGeotechTask && act.stage1_status !== 'APPROVED' && !act.final_recorded) ||
                              (activeRole === 'Site Manager' && !isGeotechTask && act.assigned_role === 'Site Manager' && act.stage1_status !== 'APPROVED' && !act.final_recorded) ||
                              (activeRole === 'Admin' && (
                                (adminSubTab === 'geotech_queue' && isGeotechTask && act.stage1_status === 'APPROVED' && !act.final_recorded) ||
                                (adminSubTab === 'statutory' && !isGeotechTask && act.assigned_role === 'Admin' && act.stage1_status !== 'APPROVED' && !act.final_recorded)
                              )) ||
                              (activeRole === 'Project Manager' && (
                                (pmSubTab === 'queue' && !isGeotechTask && act.stage1_status === 'APPROVED' && !act.final_recorded) ||
                                (act.assigned_role === 'Project Manager' && !act.final_recorded)
                              ))
                            );

                          return (
                            <div
                              key={act.id}
                              className={`p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                                isSelected
                                  ? 'bg-brand-50/40'
                                  : act.final_recorded
                                  ? 'bg-emerald-50/15 hover:bg-emerald-50/30'
                                  : act.stage1_status === 'APPROVED'
                                  ? isGeotechTask
                                    ? 'bg-teal-50/20 hover:bg-teal-50/40'
                                    : 'bg-amber-50/20 hover:bg-amber-50/40'
                                  : act.validation_status === 'REJECTED'
                                  ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              {/* Left details */}
                              <div className="flex items-start gap-3">
                                {canValidate && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectActivity(act.id)}
                                    className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                                  />
                                )}

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      {act.code || `ACT-${act.id}`}
                                    </span>
                                    <h5 className="font-bold text-slate-900 text-xs">
                                      {act.name}
                                    </h5>
                                    {act.is_critical && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                        CRITICAL PATH
                                      </span>
                                    )}
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                        isGeotechTask || act.assigned_role === 'Site Engineer'
                                          ? 'bg-teal-50 text-teal-800 border-teal-300'
                                          : act.assigned_role === 'Site Manager'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                          : act.assigned_role === 'Admin'
                                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                                          : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                      }`}
                                    >
                                      Owner: {isGeotechTask || act.assigned_role === 'Site Engineer' ? 'Site Engineer' : act.assigned_role || 'Site Manager'}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <span>
                                      Location:{' '}
                                      <strong className="text-slate-700 font-semibold">
                                        {act.tower || 'Tower A'} • Floor {act.floor}
                                      </strong>
                                    </span>
                                    <span>
                                      Work Package:{' '}
                                      <strong className="text-slate-700 font-semibold">
                                        {act.work_package || 'General'}
                                      </strong>
                                    </span>
                                    <span>
                                      Planned Duration:{' '}
                                      <strong className="text-slate-700 font-semibold">
                                        {act.planned_duration} days
                                      </strong>
                                    </span>
                                    <span>
                                      Labor Muster:{' '}
                                      <strong className="text-slate-700 font-semibold">
                                        {act.required_labour || 5} crew
                                      </strong>
                                    </span>
                                  </div>

                                  {/* Multi-Tier Provenance Trace */}
                                  <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                                    {act.stage1_status === 'APPROVED' && (
                                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-semibold">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Stage 1 Validated: {act.stage1_validated_by || (isGeotechTask ? 'Liam Chen (Site Engineer)' : 'Authorized Lead')}
                                      </span>
                                    )}
                                    {act.pm_verification_status === 'VERIFIED' && (
                                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1 font-semibold">
                                        <CheckCheck className="w-3 h-3 text-indigo-600" />
                                        Stage 2 Verified: {act.pm_verified_by || (isGeotechTask ? 'Alexander Vance (Admin)' : 'Marcus Brody (PM)')}
                                      </span>
                                    )}
                                    {act.stage1_notes && (
                                      <span className="text-slate-500 italic max-w-md truncate">
                                        "{act.stage1_notes}"
                                      </span>
                                    )}
                                    {act.pm_verification_notes && (
                                      <span className="text-indigo-700 italic max-w-md truncate">
                                        "{act.pm_verification_notes}"
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right status & action buttons */}
                              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end lg:self-center">
                                {/* Status Indicator Stamp */}
                                {act.final_recorded ? (
                                  <div className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs flex items-center gap-1.5 shadow-xs">
                                    <Award className="w-4 h-4 text-emerald-600" />
                                    <span>OFFICIALLY RECORDED</span>
                                  </div>
                                ) : act.stage1_status === 'APPROVED' ? (
                                  isGeotechTask ? (
                                    <div className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 border border-teal-300 font-bold text-xs flex items-center gap-1 animate-pulse">
                                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                                      <span>Awaiting Admin Verification</span>
                                    </div>
                                  ) : (
                                    <div className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1 animate-pulse">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Awaiting PM Verification</span>
                                    </div>
                                  )
                                ) : act.validation_status === 'REJECTED' ? (
                                  <div className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>REJECTED</span>
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs">
                                    Pending Review
                                  </div>
                                )}

                                {/* Validation Actions */}
                                {canValidate && (
                                  <div className="flex items-center gap-1.5">
                                    {/* Action: Site Engineer Validating Geotech/Excavation Task in Stage 1 */}
                                    {activeRole === 'Site Engineer' &&
                                      isGeotechTask &&
                                      act.stage1_status !== 'APPROVED' &&
                                      !act.final_recorded && (
                                        <button
                                          onClick={() => handleValidateYes(act)}
                                          disabled={loadingActivityId === act.id}
                                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                          title="Validate & Forward to Admin for Final Verification"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Validate & Send to Admin (YES)</span>
                                        </button>
                                      )}

                                    {/* Action: Admin Stage 2 Verification of Geotech Queue */}
                                    {activeRole === 'Admin' &&
                                      adminSubTab === 'geotech_queue' &&
                                      isGeotechTask &&
                                      act.stage1_status === 'APPROVED' &&
                                      !act.final_recorded && (
                                        <button
                                          onClick={() => handleValidateYes(act)}
                                          disabled={loadingActivityId === act.id}
                                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                          title="Verify & Countersign: Officially Record in Master Ledger"
                                        >
                                          <CheckCheck className="w-3.5 h-3.5" />
                                          <span>Verify & Record (YES)</span>
                                        </button>
                                      )}

                                    {/* Action: Admin Stage 1 Validation of Statutory Tasks */}
                                    {activeRole === 'Admin' &&
                                      adminSubTab === 'statutory' &&
                                      !isGeotechTask &&
                                      act.stage1_status !== 'APPROVED' &&
                                      !act.final_recorded && (
                                        <button
                                          onClick={() => handleValidateYes(act)}
                                          disabled={loadingActivityId === act.id}
                                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                          title="Validate YES (Pass to Project Manager)"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Validate (YES)</span>
                                        </button>
                                      )}

                                    {/* Action: Project Manager Actions */}
                                    {activeRole === 'Project Manager' &&
                                      !act.final_recorded &&
                                      !isGeotechTask &&
                                      (act.stage1_status === 'APPROVED' || act.assigned_role === 'Project Manager') && (
                                        <button
                                          onClick={() => handleValidateYes(act)}
                                          disabled={loadingActivityId === act.id}
                                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                          title={
                                            act.assigned_role === 'Project Manager'
                                              ? 'Approve & Record Direct PM Activity'
                                              : 'Countersign & Officially Record this activity'
                                          }
                                        >
                                          <CheckCheck className="w-3.5 h-3.5" />
                                          <span>
                                            {act.assigned_role === 'Project Manager'
                                              ? 'Validate & Record (YES)'
                                              : 'Verify & Record (YES)'}
                                          </span>
                                        </button>
                                      )}

                                    {/* Action: Site Manager Stage 1 Validation */}
                                    {activeRole === 'Site Manager' &&
                                      !isGeotechTask &&
                                      act.stage1_status !== 'APPROVED' &&
                                      !act.final_recorded && (
                                        <button
                                          onClick={() => handleValidateYes(act)}
                                          disabled={loadingActivityId === act.id}
                                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                          title="Validate YES (Pass to Project Manager)"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Validate (YES)</span>
                                        </button>
                                      )}

                                    {/* Action: Reject button */}
                                    {!act.final_recorded && (
                                      <button
                                        onClick={() => setRejectingActivity(act)}
                                        disabled={loadingActivityId === act.id}
                                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-colors"
                                        title="Reject with notes"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Action: Reset */}
                                    {(act.final_recorded || act.stage1_status === 'APPROVED' || act.validation_status === 'REJECTED') && (
                                      <button
                                        onClick={() => handleResetActivity(act)}
                                        disabled={loadingActivityId === act.id}
                                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                        title="Reset back to PENDING"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
