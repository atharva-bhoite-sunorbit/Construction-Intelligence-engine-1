import React, { useState, useMemo } from 'react';
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
  CheckCheck
} from 'lucide-react';
import { Activity, Project } from '../types';
import { apiClient } from '../api/client';

interface PMActivitySectionValidationProps {
  project: Project;
  activities: Activity[];
  onRefreshData: () => void;
}

type GroupByOption = 'phase' | 'work_package' | 'floor';
type StatusFilterOption = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const REJECTION_PRESETS = [
  'Predecessor activity / structural sign-off not certified',
  'Crew manpower & subcontractor capacity inadequate',
  'Material delivery schedule / batch cert unverified',
  'Conflicting site workfront / safety hazard reported',
  'Engineering drawing revision pending consultant approval',
  'Duration underestimated for site environmental condition'
];

export const PMActivitySectionValidation: React.FC<PMActivitySectionValidationProps> = ({
  project,
  activities,
  onRefreshData,
}) => {
  // PM Role switch state (for demonstration / testing role enforcement)
  const [currentUserRole, setCurrentUserRole] = useState<'Project Manager' | 'Site Engineer' | 'Safety Officer'>('Project Manager');
  const isProjectManager = currentUserRole === 'Project Manager';

  // Grouping & Filtering state
  const [groupBy, setGroupBy] = useState<GroupByOption>('phase');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Action states
  const [loadingActivityId, setLoadingActivityId] = useState<number | null>(null);
  const [loadingSectionName, setLoadingSectionName] = useState<string | null>(null);
  const [rejectingActivity, setRejectingActivity] = useState<Activity | null>(null);
  const [rejectingSection, setRejectingSection] = useState<{ sectionName: string; activityIds: number[] } | null>(null);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_PRESETS[0]);
  const [customRejectionNote, setCustomRejectionNote] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Group activities
  const sections = useMemo(() => {
    const map = new Map<string, Activity[]>();

    activities.forEach((act) => {
      let key = 'General';
      if (groupBy === 'phase') {
        key = act.phase || 'Unassigned Phase';
      } else if (groupBy === 'work_package') {
        key = act.work_package || (act.category ? act.category : 'General Works');
      } else if (groupBy === 'floor') {
        key = act.floor !== undefined && act.floor !== null ? `Floor ${act.floor} (${act.tower || 'Tower A'})` : 'Ground Level';
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(act);
    });

    return Array.from(map.entries()).map(([sectionName, sectionActivities]) => {
      const filtered = sectionActivities.filter((act) => {
        const matchesSearch =
          act.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (act.code && act.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (act.work_package && act.work_package.toLowerCase().includes(searchQuery.toLowerCase()));

        const currentStatus = act.validation_status || 'PENDING';
        const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;

        return matchesSearch && matchesStatus;
      });

      const totalCount = sectionActivities.length;
      const approvedCount = sectionActivities.filter((a) => a.validation_status === 'APPROVED').length;
      const rejectedCount = sectionActivities.filter((a) => a.validation_status === 'REJECTED').length;
      const pendingCount = sectionActivities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length;

      return {
        sectionName,
        allActivities: sectionActivities,
        filteredActivities: filtered,
        totalCount,
        approvedCount,
        rejectedCount,
        pendingCount,
        percentApproved: totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0,
      };
    });
  }, [activities, groupBy, statusFilter, searchQuery]);

  // Overall Stats
  const overallStats = useMemo(() => {
    const total = activities.length;
    const approved = activities.filter((a) => a.validation_status === 'APPROVED').length;
    const rejected = activities.filter((a) => a.validation_status === 'REJECTED').length;
    const pending = activities.filter((a) => !a.validation_status || a.validation_status === 'PENDING').length;
    const percent = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, rejected, pending, percent };
  }, [activities]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: prev[sectionName] === undefined ? false : !prev[sectionName],
    }));
  };

  const isSectionExpanded = (sectionName: string) => {
    return expandedSections[sectionName] !== false; // expanded by default
  };

  // Validate single activity (YES / APPROVE)
  const handleValidateYes = async (activity: Activity) => {
    if (!isProjectManager) {
      showToast('Action restricted: Only the Project Manager can validate activities.', 'error');
      return;
    }

    setLoadingActivityId(activity.id);
    try {
      await apiClient.validateActivity(activity.id, {
        validation_status: 'APPROVED',
        validated_by: 'Marcus Brody (Project Manager)',
        validation_notes: 'Approved by PM: verified duration, crew muster, and predecessor logic.',
      });
      showToast(`Activity "${activity.name}" APPROVED (YES)`);
      onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to approve activity.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Confirm single activity (NO / REJECT)
  const handleConfirmRejectActivity = async () => {
    if (!rejectingActivity) return;
    const note = customRejectionNote.trim() ? `${rejectionReason} - ${customRejectionNote.trim()}` : rejectionReason;

    setLoadingActivityId(rejectingActivity.id);
    try {
      await apiClient.validateActivity(rejectingActivity.id, {
        validation_status: 'REJECTED',
        validated_by: 'Marcus Brody (Project Manager)',
        validation_notes: note,
      });
      showToast(`Activity "${rejectingActivity.name}" REJECTED (NO)`);
      setRejectingActivity(null);
      setCustomRejectionNote('');
      onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to reject activity.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Reset single activity to PENDING
  const handleResetToPending = async (activity: Activity) => {
    if (!isProjectManager) return;
    setLoadingActivityId(activity.id);
    try {
      await apiClient.validateActivity(activity.id, {
        validation_status: 'PENDING',
        validated_by: 'Marcus Brody (Project Manager)',
        validation_notes: 'Reset to pending review by PM',
      });
      showToast(`Activity "${activity.name}" reset to Pending`);
      onRefreshData();
    } catch (err: any) {
      showToast('Failed to reset status.', 'error');
    } finally {
      setLoadingActivityId(null);
    }
  };

  // Bulk Validate Section (YES / ALL)
  const handleBulkApproveSection = async (sectionName: string, activityIds: number[]) => {
    if (!isProjectManager) {
      showToast('Action restricted: Only Project Manager can validate sections.', 'error');
      return;
    }
    if (activityIds.length === 0) return;

    setLoadingSectionName(sectionName);
    try {
      const res = await apiClient.bulkValidateActivities(project.id, {
        activity_ids: activityIds,
        validation_status: 'APPROVED',
        validated_by: 'Marcus Brody (Project Manager)',
        validation_notes: `Bulk approved by PM for section: ${sectionName}`,
      });
      showToast(`Section "${sectionName}": ${res.updated_count} activities APPROVED (YES)`);
      onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Bulk section approval failed.', 'error');
    } finally {
      setLoadingSectionName(null);
    }
  };

  // Confirm Bulk Reject Section (NO / ALL)
  const handleConfirmRejectSection = async () => {
    if (!rejectingSection) return;
    const note = customRejectionNote.trim() ? `${rejectionReason} - ${customRejectionNote.trim()}` : rejectionReason;

    setLoadingSectionName(rejectingSection.sectionName);
    try {
      const res = await apiClient.bulkValidateActivities(project.id, {
        activity_ids: rejectingSection.activityIds,
        validation_status: 'REJECTED',
        validated_by: 'Marcus Brody (Project Manager)',
        validation_notes: `Bulk rejected by PM for section ${rejectingSection.sectionName}: ${note}`,
      });
      showToast(`Section "${rejectingSection.sectionName}": ${res.updated_count} activities REJECTED (NO)`);
      setRejectingSection(null);
      setCustomRejectionNote('');
      onRefreshData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Bulk section rejection failed.', 'error');
    } finally {
      setLoadingSectionName(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {feedbackToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border transition-all ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Role & PM Validation Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-700/60 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-300">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
              </div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>PROJECT MANAGER SECTION-WISE VALIDATION GATEWAY</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ISO-19650 Quality Controlled
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              PM validation authority required before execution release. Review activities section by section with
              one-click <strong>YES (Approve)</strong> or <strong>NO (Reject with Reason)</strong>. Only authorized
              Project Managers can certify these items.
            </p>
          </div>

          {/* PM Role Simulation Switcher */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 min-w-[280px]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                {isProjectManager ? (
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                )}
                Active Reviewer Role:
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                  isProjectManager
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isProjectManager ? 'PM Authorization Active' : 'Read-Only Mode'}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/80">
              <button
                onClick={() => setCurrentUserRole('Project Manager')}
                className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  currentUserRole === 'Project Manager'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <HardHat className="w-3 h-3" />
                <span>Project Manager</span>
              </button>
              <button
                onClick={() => setCurrentUserRole('Site Engineer')}
                className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  currentUserRole === 'Site Engineer'
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Site Engineer</span>
              </button>
            </div>
            <div className="text-[10px] text-slate-400 text-center font-mono">
              Signed in as: <strong className="text-slate-200">Marcus Brody</strong> (Head PM)
            </div>
          </div>
        </div>
      </div>

      {/* High-Level Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Total Activities</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{overallStats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across all project sections</div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-emerald-800 flex items-center justify-between">
            <span>Approved (YES)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{overallStats.approved}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {overallStats.percent}% certified for site execution
          </div>
        </div>

        <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-rose-800 flex items-center justify-between">
            <span>Rejected (NO)</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1">{overallStats.rejected}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Requires engineering revision</div>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-medium text-amber-800 flex items-center justify-between">
            <span>Pending PM Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1">{overallStats.pending}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Awaiting manager sign-off</div>
        </div>

        <div className="col-span-2 md:col-span-1 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Overall Readiness</div>
            <div className="text-xl font-bold text-brand-600 mt-1">{overallStats.percent}%</div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all duration-500"
              style={{ width: `${overallStats.percent}%` }}
              title={`Approved: ${overallStats.approved}`}
            />
            <div
              className="bg-rose-500 h-2 transition-all duration-500"
              style={{
                width: `${overallStats.total > 0 ? (overallStats.rejected / overallStats.total) * 100 : 0}%`,
              }}
              title={`Rejected: ${overallStats.rejected}`}
            />
          </div>
        </div>
      </div>

      {/* Control Bar: Section Grouping, Status Filter & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-xs">
        {/* Section Grouping Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-brand-600" />
            Group By Section:
          </span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setGroupBy('phase')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                groupBy === 'phase'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phase / Milestone
            </button>
            <button
              onClick={() => setGroupBy('work_package')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                groupBy === 'work_package'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Work Package
            </button>
            <button
              onClick={() => setGroupBy('floor')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                groupBy === 'floor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Floor / Level
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved (YES) Only</option>
              <option value="REJECTED">Rejected (NO) Only</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 w-44"
            />
          </div>

          {/* Quick Collapse/Expand All */}
          <button
            onClick={() => {
              const allCollapsed = sections.every((s) => expandedSections[s.sectionName] === false);
              const newState: Record<string, boolean> = {};
              sections.forEach((s) => {
                newState[s.sectionName] = allCollapsed;
              });
              setExpandedSections(newState);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold transition-colors"
          >
            Toggle All Sections
          </button>
        </div>
      </div>

      {/* Warning for non-PM */}
      {!isProjectManager && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Read-Only Mode:</strong> Only the Project Manager role has authority to approve or reject activities. Switch role above to test PM actions.
            </span>
          </div>
          <button
            onClick={() => setCurrentUserRole('Project Manager')}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-md text-[11px] font-bold hover:bg-amber-700 transition-colors shadow-xs"
          >
            Switch to PM
          </button>
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl text-slate-400">
            No activities found matching filters.
          </div>
        ) : (
          sections.map((section) => {
            const isExpanded = isSectionExpanded(section.sectionName);
            const isSectionLoading = loadingSectionName === section.sectionName;
            const pendingIds = section.allActivities
              .filter((a) => !a.validation_status || a.validation_status === 'PENDING')
              .map((a) => a.id);

            return (
              <div
                key={section.sectionName}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Section Header */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Title & Stats */}
                  <div
                    onClick={() => toggleSection(section.sectionName)}
                    className="flex items-center gap-3 cursor-pointer select-none flex-1"
                  >
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {section.sectionName}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {section.totalCount} {section.totalCount === 1 ? 'Activity' : 'Activities'}
                        </span>
                        {section.percentApproved === 100 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                            100% Certified
                          </span>
                        )}
                      </div>

                      {/* Mini visual summary */}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {section.approvedCount} Approved
                        </span>
                        <span className="flex items-center gap-1 text-rose-700 font-medium">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          {section.rejectedCount} Rejected
                        </span>
                        <span className="flex items-center gap-1 text-amber-700 font-medium">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {section.pendingCount} Pending
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section-Level Quick Actions (YES TO ALL / NO TO ALL) */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {/* Approve All in Section */}
                    <button
                      onClick={() =>
                        handleBulkApproveSection(
                          section.sectionName,
                          section.allActivities.map((a) => a.id)
                        )
                      }
                      disabled={!isProjectManager || isSectionLoading || section.approvedCount === section.totalCount}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs"
                      title={
                        !isProjectManager
                          ? 'Only Project Manager can bulk approve'
                          : 'Approve all activities in this section (YES to all)'
                      }
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSectionLoading ? 'Approving...' : 'Validate Section (YES All)'}</span>
                    </button>

                    {/* Reject All in Section */}
                    <button
                      onClick={() =>
                        setRejectingSection({
                          sectionName: section.sectionName,
                          activityIds: section.allActivities.map((a) => a.id),
                        })
                      }
                      disabled={!isProjectManager || isSectionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-xs"
                      title={
                        !isProjectManager
                          ? 'Only Project Manager can bulk reject'
                          : 'Reject all activities in this section (NO to all)'
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Section (NO)</span>
                    </button>
                  </div>
                </div>

                {/* Section Progress Bar */}
                <div className="w-full bg-slate-100 h-1 flex">
                  <div
                    className="bg-emerald-500 h-1 transition-all"
                    style={{ width: `${section.percentApproved}%` }}
                  />
                  <div
                    className="bg-rose-500 h-1 transition-all"
                    style={{
                      width: `${section.totalCount > 0 ? (section.rejectedCount / section.totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Activities Rows */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {section.filteredActivities.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No activities match the current filter in this section.
                      </div>
                    ) : (
                      section.filteredActivities.map((activity) => {
                        const status = activity.validation_status || 'PENDING';
                        const isApproved = status === 'APPROVED';
                        const isRejected = status === 'REJECTED';
                        const isPending = status === 'PENDING';
                        const isActLoading = loadingActivityId === activity.id;

                        return (
                          <div
                            key={activity.id}
                            className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                              isApproved
                                ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                : isRejected
                                ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Left: Info */}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {activity.code && (
                                  <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {activity.code}
                                  </span>
                                )}
                                <span className="font-semibold text-slate-900 text-xs truncate">
                                  {activity.name}
                                </span>
                                {activity.is_critical && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Critical Path
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {activity.start_date} → {activity.end_date} ({activity.planned_duration}d)
                                </span>
                                {activity.tower && (
                                  <span>
                                    {activity.tower} • Floor {activity.floor}
                                  </span>
                                )}
                                {activity.required_labour > 0 && (
                                  <span>Required Crew: {activity.required_labour} pax</span>
                                )}
                                {activity.work_package && (
                                  <span className="text-slate-400">Pkg: {activity.work_package}</span>
                                )}
                              </div>

                              {/* Validation Status & Audit Details */}
                              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                {isApproved && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    VALIDATED (YES)
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    REJECTED (NO)
                                  </span>
                                )}
                                {isPending && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Awaiting PM Review
                                  </span>
                                )}

                                {activity.validated_by && (
                                  <span className="text-[10px] text-slate-400">
                                    By: <strong className="text-slate-600">{activity.validated_by}</strong>
                                    {activity.validated_at && (
                                      <span> • {new Date(activity.validated_at).toLocaleDateString()}</span>
                                    )}
                                  </span>
                                )}

                                {activity.validation_notes && (
                                  <span className="text-[10px] text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-md truncate">
                                    "{activity.validation_notes}"
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: The YES / NO PM Decision Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Option YES (Approve) */}
                              <button
                                onClick={() => handleValidateYes(activity)}
                                disabled={!isProjectManager || isActLoading || isApproved}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                  isApproved
                                    ? 'bg-emerald-600 text-white cursor-default shadow-emerald-500/20'
                                    : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-500 disabled:opacity-40'
                                }`}
                                title={
                                  !isProjectManager
                                    ? 'Restricted to Project Manager'
                                    : isApproved
                                    ? 'Activity is certified (YES)'
                                    : 'Certify Activity as APPROVED (YES)'
                                }
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isApproved ? 'YES (Approved)' : 'YES'}</span>
                              </button>

                              {/* Option NO (Reject) */}
                              <button
                                onClick={() => setRejectingActivity(activity)}
                                disabled={!isProjectManager || isActLoading || isRejected}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                  isRejected
                                    ? 'bg-rose-600 text-white cursor-default shadow-rose-500/20'
                                    : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 hover:border-rose-500 disabled:opacity-40'
                                }`}
                                title={
                                  !isProjectManager
                                    ? 'Restricted to Project Manager'
                                    : isRejected
                                    ? 'Activity is rejected (NO)'
                                    : 'Reject Activity (NO) with Reason'
                                }
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{isRejected ? 'NO (Rejected)' : 'NO'}</span>
                              </button>

                              {/* Reset to Pending (Undo) */}
                              {!isPending && isProjectManager && (
                                <button
                                  onClick={() => handleResetToPending(activity)}
                                  disabled={isActLoading}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                  title="Reset status back to Pending"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Reject Single Activity (NO Dialog with Reason) */}
      {rejectingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">PM Validation: REJECT ACTIVITY (NO)</h3>
                  <p className="text-xs text-slate-500">Record reason for rejection / rework order</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingActivity(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="text-slate-500 font-mono text-[11px]">{rejectingActivity.code}</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{rejectingActivity.name}</div>
                <div className="text-slate-500 mt-1">
                  Section: {rejectingActivity.phase} • Duration: {rejectingActivity.planned_duration} days
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Primary Reason for Rejection (Required):
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {REJECTION_PRESETS.map((preset) => (
                    <label
                      key={preset}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        rejectionReason === preset
                          ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectionReason"
                        checked={rejectionReason === preset}
                        onChange={() => setRejectionReason(preset)}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <span>{preset}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Engineer Instructions or Corrective Action:
                </label>
                <textarea
                  value={customRejectionNote}
                  onChange={(e) => setCustomRejectionNote(e.target.value)}
                  placeholder="e.g. Please re-check bearing capacity with geotechnical consultant before re-submitting..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRejectingActivity(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejectActivity}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Confirm Rejection (NO)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Entire Section (NO to All) */}
      {rejectingSection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">REJECT ENTIRE SECTION (NO TO ALL)</h3>
                  <p className="text-xs text-slate-500">
                    Section: {rejectingSection.sectionName} ({rejectingSection.activityIds.length} activities)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingSection(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to mark all activities in <strong>{rejectingSection.sectionName}</strong> as{' '}
                <span className="text-rose-600 font-bold">REJECTED (NO)</span>? This will record a section-wide rejection
                in the audit trail.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Section Rejection Reason:
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {REJECTION_PRESETS.map((preset) => (
                    <label
                      key={preset}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        rejectionReason === preset
                          ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sectionRejectionReason"
                        checked={rejectionReason === preset}
                        onChange={() => setRejectionReason(preset)}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <span>{preset}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Notes for Lead Engineer:
                </label>
                <textarea
                  value={customRejectionNote}
                  onChange={(e) => setCustomRejectionNote(e.target.value)}
                  placeholder="e.g. Entire section requires re-sequencing due to site condition changes..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRejectingSection(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejectSection}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject Entire Section (NO)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
