export type GovernanceRole = 'Site Engineer' | 'Site Manager' | 'Admin' | 'Project Manager' | 'Top Management';


export type GroupByOption = 'phase' | 'work_package' | 'floor';
export type StatusFilterOption = 'all' | 'PENDING' | 'AWAITING_ADMIN_VERIFICATION' | 'AWAITING_PM_VERIFICATION' | 'RECORDED' | 'REJECTED';

export const REJECTION_PRESETS = [
  'Predecessor activity / structural sign-off not certified',
  'Crew manpower & trade subcontractor muster inadequate',
  'Material delivery schedule / test cube cert unverified',
  'Conflicting site workfront / safety clearance unresolved',
  'Engineering drawing revision pending consultant signoff',
  'Duration underestimated for current weather / site conditions',
  'Geotechnical SPT N-value / core borelog density unverified',
  'Excavation slope stability / pit dewatering discharge capacity inadequate'
];
