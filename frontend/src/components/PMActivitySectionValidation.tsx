import React from 'react';
import { Activity, Project, User } from '../types';
import { usePMValidationState } from './governance/usePMValidationState';
import { FeedbackToast } from './governance/FeedbackToast';
import { RejectionModal } from './governance/RejectionModal';
import { AdminSubNav } from './governance/AdminSubNav';
import { PMSubNav } from './governance/PMSubNav';
import { TopMgmtSubNav } from './governance/TopMgmtSubNav';
import { ExecutiveSummary } from './governance/ExecutiveSummary';
import { ActivityWorkspace } from './governance/ActivityWorkspace';
import { RoleBanner } from './governance/RoleBanner';

export type { GovernanceRole } from './governance/shared';

interface PMActivitySectionValidationProps {
  project: Project;
  activities: Activity[];
  currentUser?: User | null;
  onRefreshData: () => void;
}

export const PMActivitySectionValidation: React.FC<PMActivitySectionValidationProps> = (props) => {
  const ctx = usePMValidationState(props);
  const { activeRole, topMgmtSubTab, rejectingActivity, feedbackToast, governanceSummary } = ctx;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackToast && <FeedbackToast ctx={ctx} />}

      {/* Rejection Reason Modal */}
      {rejectingActivity && <RejectionModal ctx={ctx} />}

      {/* Role Switcher & Governance Banner */}
      <RoleBanner ctx={ctx} />

      {/* Admin Sub-Navigation Bar */}
      {activeRole === 'Admin' && <AdminSubNav ctx={ctx} />}

      {/* Role-Specific Sub-Navigation Bar */}
      {activeRole === 'Project Manager' && <PMSubNav ctx={ctx} />}

      {activeRole === 'Top Management' && <TopMgmtSubNav ctx={ctx} />}

      {/* Top Management: Executive Summary Cards & Matrix View */}
      {activeRole === 'Top Management' && topMgmtSubTab === 'summary' && governanceSummary && <ExecutiveSummary ctx={ctx} />}

      {/* Main Workspace (Site Manager, Admin, PM, or Top Management Recorded Table) */}
      {(activeRole !== 'Top Management' || topMgmtSubTab === 'recorded') && <ActivityWorkspace ctx={ctx} />}
    </div>
  );
};
