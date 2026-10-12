import { useState, useMemo, useEffect } from 'react';
import { Activity, Project, User, GovernanceSummary } from '../../types';
import { apiClient } from '../../api/client';
import { GovernanceRole, GroupByOption, StatusFilterOption, REJECTION_PRESETS } from './shared';

export interface PMValidationArgs {
  project: Project;
  activities: Activity[];
  currentUser?: User | null;
  onRefreshData: () => void;
}

export const usePMValidationState = ({
  project,
  activities,
  currentUser,
  onRefreshData,
}: PMValidationArgs) => {
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

  return {
    project,
    activities,
    currentUser,
    onRefreshData,
    initialRole,
    activeRole,
    setActiveRole,
    adminSubTab,
    setAdminSubTab,
    pmSubTab,
    setPmSubTab,
    topMgmtSubTab,
    setTopMgmtSubTab,
    groupBy,
    setGroupBy,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    expandedSections,
    setExpandedSections,
    showOtherRolesInReadOnly,
    setShowOtherRolesInReadOnly,
    selectedActivityIds,
    setSelectedActivityIds,
    loadingActivityId,
    setLoadingActivityId,
    isBulkLoading,
    setIsBulkLoading,
    rejectingActivity,
    setRejectingActivity,
    rejectionReason,
    setRejectionReason,
    customRejectionNote,
    setCustomRejectionNote,
    feedbackToast,
    setFeedbackToast,
    governanceSummary,
    setGovernanceSummary,
    fetchSummary,
    showToast,
    activeReviewerName,
    roleActivities,
    displayedActivities,
    roleStats,
    sections,
    toggleSection,
    isSectionExpanded,
    handleValidateYes,
    handleConfirmReject,
    handleResetActivity,
    handleBulkValidate,
    toggleSelectActivity,
    selectAllInView,
    clearSelection,
  };
};

export type PMValidationCtx = ReturnType<typeof usePMValidationState>;
