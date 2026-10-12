import { Activity } from '../types';

const getActivityScope = (activity: Activity) =>
  [
    activity.phase,
    activity.work_package,
    activity.category,
    activity.subcategory,
    activity.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const isStructureOrHandoverActivity = (activity: Activity) => {
  const scope = getActivityScope(activity);
  const phase = activity.phase.trim().toLowerCase();

  return (
    phase === 'substructure' ||
    phase === 'superstructure' ||
    phase === 'handover' ||
    /\b(substructure|superstructure|structural|structure|rcc|shear wall|foundation)\b/.test(scope) ||
    /\b(handover|commissioning|occupancy certificate|completion certificate|statutory clearance|noc)\b/.test(scope)
  );
};

export const compareActivitiesByBaseline = (left: Activity, right: Activity) => {
  const leftStart = left.baseline_start_date || left.start_date;
  const rightStart = right.baseline_start_date || right.start_date;
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);

  const leftTaskId = left.baseline_task_id ?? left.sort_order ?? left.id;
  const rightTaskId = right.baseline_task_id ?? right.sort_order ?? right.id;
  if (leftTaskId !== rightTaskId) return leftTaskId - rightTaskId;

  const leftEnd = left.baseline_end_date || left.end_date;
  const rightEnd = right.baseline_end_date || right.end_date;
  return leftEnd.localeCompare(rightEnd) || left.id - right.id;
};

export const getBriefActivityExplanation = (activity: Activity) => {
  const scope = getActivityScope(activity);
  const packageName =
    activity.subcategory ||
    activity.category ||
    activity.work_package ||
    activity.phase ||
    'general works';
  const location = [
    activity.tower || activity.building || 'site-wide',
    activity.floor > 0 ? `Floor ${activity.floor}` : 'Ground / substructure',
    activity.zone && activity.zone.toLowerCase() !== 'zone 1' ? activity.zone : '',
  ]
    .filter(Boolean)
    .join(', ');
  const isSummaryRow = [activity.category, activity.subcategory, activity.work_package]
    .filter(Boolean)
    .some((value) => value?.toLowerCase() === 'summary header');

  if (isSummaryRow) {
    return `This is the master-schedule roll-up for ${activity.name} at ${location}. Use its baseline dates as the delivery window for the underlying work package, not as a separate field operation.`;
  }

  if (/\b(handover|commissioning|occupancy certificate|completion certificate|statutory clearance|noc)\b/.test(scope)) {
    return `Complete this ${packageName} milestone at ${location}; close applicable inspections and defects, compile acceptance records, and secure the required handover sign-off.`;
  }
  if (/\b(excavation|earthwork|dewatering|piling)\b/.test(scope)) {
    return `Carry out ${activity.name.toLowerCase()} for ${packageName} at ${location}; verify set-out and formation levels, maintain safe ground support, and obtain inspection approval before follow-on work.`;
  }
  if (/\b(structural|structure|rcc|shear wall|foundation|substructure|superstructure|slab|column|beam|raft|concrete)\b/.test(scope)) {
    return `Deliver ${activity.name.toLowerCase()} within ${packageName} at ${location} to approved drawings; coordinate predecessor sign-offs, verify quantities and quality inspections, then release the next linked activity.`;
  }
  if (/\b(mep|electrical|plumbing|fire fighting|hvac|lift|elevator)\b/.test(scope)) {
    return `Install and coordinate ${activity.name.toLowerCase()} within ${packageName} at ${location}; complete required service checks and record inspection results before concealment or handover.`;
  }
  if (/\b(finishing|paint|tiling|plaster|facade|waterproofing|flooring)\b/.test(scope)) {
    return `Complete ${activity.name.toLowerCase()} to the approved ${packageName} specification at ${location}; inspect interfaces and finish quality, record acceptance, and protect completed work.`;
  }
  if (/\b(mobilization|procurement|advance|submittal|delivery)\b/.test(scope)) {
    return `Prepare ${activity.name.toLowerCase()} for ${packageName} at ${location}; confirm approved submittals, resource readiness, access, and delivery timing against the baseline before releasing follow-on work.`;
  }

  return `Complete ${activity.name.toLowerCase()} within ${packageName} at ${location}; follow approved documents, coordinate predecessor activities, verify the planned quantity and applicable quality checks, and record sign-off.`;
};
