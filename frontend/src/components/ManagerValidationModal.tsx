import React, { useState } from 'react';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  HardHat,
  Wind,
  Layers,
  FileCheck,
  Sparkles,
  UserCheck,
  Clock
} from 'lucide-react';
import { apiClient } from '../api/client';
import { DailyProgress, ValidationChecklistItem } from '../types';

interface ManagerValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressRecord?: DailyProgress | null;
  activityName?: string;
  projectId: number;
  onValidationComplete: () => void;
}

interface ChecklistTemplateItem {
  id: string;
  category: 'Safety & Environmental' | 'Quality & Structural' | 'Material & Testing' | 'Muster & Output' | 'Field Evidence';
  item: string;
  defaultStatus: 'PASS' | 'CONDITIONAL' | 'FAIL';
  helpText: string;
}

const DEFAULT_CHECKLIST_ITEMS: ChecklistTemplateItem[] = [
  {
    id: 'safe-1',
    category: 'Safety & Environmental',
    item: 'Atmospheric Wind & Weather Clearance',
    defaultStatus: 'PASS',
    helpText: 'Wind speed is verified below 38 km/h crane shutdown limit; no active rain washouts.'
  },
  {
    id: 'safe-2',
    category: 'Safety & Environmental',
    item: 'Fall Protection, Edge Barricading & Scaffold Tags',
    defaultStatus: 'PASS',
    helpText: 'Perimeter guardrails, toe-boards, and green scaffold inspection tags verified.'
  },
  {
    id: 'safe-3',
    category: 'Safety & Environmental',
    item: 'Excavation Shoring & Subsurface Dewatering Active',
    defaultStatus: 'PASS',
    helpText: 'Trench banks battered/shored; water table pumps operating without base heave.'
  },
  {
    id: 'qual-1',
    category: 'Quality & Structural',
    item: 'Rebar Placement, Lapping & Cover Block Verification',
    defaultStatus: 'PASS',
    helpText: 'Reinforcement bar diameter, spacing, and concrete cover blocks match structural drawings.'
  },
  {
    id: 'qual-2',
    category: 'Quality & Structural',
    item: 'Formwork Plumb, Bracing & Line Alignment Certified',
    defaultStatus: 'PASS',
    helpText: 'Formwork shuttering certified true to line and braced against hydrostatic concrete pressure.'
  },
  {
    id: 'qual-3',
    category: 'Quality & Structural',
    item: 'Soil Subgrade Compaction Test (>=95% Standard Proctor)',
    defaultStatus: 'PASS',
    helpText: 'Compaction test results verified on-site before blinding or slab cast.'
  },
  {
    id: 'mat-1',
    category: 'Material & Testing',
    item: 'Material Grade & Batch Delivery Ticket Verified',
    defaultStatus: 'PASS',
    helpText: 'Ready-mix batch ticket, cement grade, or steel mill certificate checked.'
  },
  {
    id: 'mat-2',
    category: 'Material & Testing',
    item: 'Fresh Concrete Slump & Compressive Test Cubes Sampled',
    defaultStatus: 'PASS',
    helpText: 'Slump measured within allowable 120±25mm tolerance; cube samples cast for 7 & 28 days.'
  },
  {
    id: 'must-1',
    category: 'Muster & Output',
    item: 'Headcount & Trade Labour Muster Cross-Checked',
    defaultStatus: 'PASS',
    helpText: 'Actual workers physically present on workfront match logged headcount.'
  },
  {
    id: 'must-2',
    category: 'Muster & Output',
    item: 'Physical Work Quantity Measured vs Claimed Output',
    defaultStatus: 'PASS',
    helpText: 'Executed square meters/linear meters verified against daily site progress log.'
  },
  {
    id: 'evid-1',
    category: 'Field Evidence',
    item: 'Time-Stamped Photographic Site Audit Attached',
    defaultStatus: 'PASS',
    helpText: 'Physical photo evidence verified with no unaddressed non-conformance defects.'
  }
];

export const ManagerValidationModal: React.FC<ManagerValidationModalProps> = ({
  isOpen,
  onClose,
  progressRecord,
  activityName,
  projectId,
  onValidationComplete,
}) => {
  const [managerName, setManagerName] = useState<string>('Marcus Brody (Project Director)');
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [overallDecision, setOverallDecision] = useState<'APPROVED' | 'CONDITIONAL' | 'REJECTED'>('APPROVED');
  const [itemsState, setItemsState] = useState<Record<string, { status: 'PASS' | 'CONDITIONAL' | 'FAIL'; comment: string }>>(
    DEFAULT_CHECKLIST_ITEMS.reduce((acc, curr) => ({
      ...acc,
      [curr.id]: { status: curr.defaultStatus, comment: '' }
    }), {})
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleItemStatusChange = (id: string, newStatus: 'PASS' | 'CONDITIONAL' | 'FAIL') => {
    setItemsState(prev => ({
      ...prev,
      [id]: { ...prev[id], status: newStatus }
    }));
  };

  const handleItemCommentChange = (id: string, comment: string) => {
    setItemsState(prev => ({
      ...prev,
      [id]: { ...prev[id], comment }
    }));
  };

  const handleSetAllPass = () => {
    const updated: any = {};
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
      updated[item.id] = { status: 'PASS', comment: '' };
    });
    setItemsState(updated);
    setOverallDecision('APPROVED');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const checklistPayload: ValidationChecklistItem[] = DEFAULT_CHECKLIST_ITEMS.map(item => ({
        category: item.category,
        item: item.item,
        status: itemsState[item.id]?.status || 'PASS',
        comment: itemsState[item.id]?.comment || undefined
      }));

      if (progressRecord && progressRecord.id) {
        // Validate specific progress record
        await apiClient.validateDailyProgress(progressRecord.id, {
          overall_decision: overallDecision,
          validated_by: managerName,
          validation_notes: validationNotes || undefined,
          checklist_items: checklistPayload,
          validation_type: 'DAILY_PROGRESS',
          activity_id: progressRecord.activity_id
        });
      } else {
        // General site validation checklist submission
        await apiClient.submitSiteValidation(projectId, {
          overall_decision: overallDecision,
          validated_by: managerName,
          validation_notes: validationNotes || undefined,
          checklist_items: checklistPayload,
          validation_type: 'SITE_QUALITY_VALIDATION'
        });
      }

      onValidationComplete();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit manager validation checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group items by category
  const categories = Array.from(new Set(DEFAULT_CHECKLIST_ITEMS.map(i => i.category)));

  const passCount = Object.values(itemsState).filter(s => s.status === 'PASS').length;
  const condCount = Object.values(itemsState).filter(s => s.status === 'CONDITIONAL').length;
  const failCount = Object.values(itemsState).filter(s => s.status === 'FAIL').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-wide">
                  MANAGER QUALITY & SAFETY VALIDATION CHECKLIST
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AUTHORITY GATE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rigorous multi-point validation protocol for project directors and senior site managers before sign-off
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Context Card */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Workfront Under Inspection</div>
            <div className="text-sm font-bold text-slate-900">
              {progressRecord?.activity_name || activityName || 'Site Stage & Progress Validation'}
            </div>
            {progressRecord && (
              <div className="text-slate-600 mt-0.5 font-mono text-[11px]">
                Date: {new Date(progressRecord.report_date).toLocaleDateString()} • Planned: {progressRecord.planned_quantity} • Actual: {progressRecord.actual_quantity} • Assigned: {progressRecord.workers_assigned} workers
              </div>
            )}
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {passCount} Passed
            </span>
            {condCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {condCount} Conditional
              </span>
            )}
            {failCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px] flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> {failCount} Failed
              </span>
            )}
            <button
              type="button"
              onClick={handleSetAllPass}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] shadow-xs"
            >
              Verify All (Pass)
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          
          {/* Categorized Checklist Items */}
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-4">
            {categories.map((cat) => {
              const catItems = DEFAULT_CHECKLIST_ITEMS.filter(i => i.category === cat);
              return (
                <div key={cat} className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                    <span>{cat}</span>
                  </div>

                  <div className="space-y-2">
                    {catItems.map((item) => {
                      const state = itemsState[item.id] || { status: 'PASS', comment: '' };
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border text-xs transition-colors ${
                            state.status === 'PASS'
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : state.status === 'CONDITIONAL'
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-rose-50/40 border-rose-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5 max-w-md">
                              <span className="font-bold text-slate-900">{item.item}</span>
                              <p className="text-[11px] text-slate-500">{item.helpText}</p>
                            </div>

                            {/* Status Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'PASS')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  state.status === 'PASS'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                Pass
                              </button>

                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'CONDITIONAL')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  state.status === 'CONDITIONAL'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                Conditional
                              </button>

                              <button
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, 'FAIL')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  state.status === 'FAIL'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                Fail
                              </button>
                            </div>
                          </div>

                          {/* Comment input if conditional or fail */}
                          {(state.status === 'CONDITIONAL' || state.status === 'FAIL') && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60">
                              <input
                                type="text"
                                placeholder="Specify required corrective action or punch-list remark..."
                                value={state.comment}
                                onChange={(e) => handleItemCommentChange(item.id, e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manager Decision & Sign-off Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Overall Validation Certification Decision *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallDecision('APPROVED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      overallDecision === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>APPROVED & CERTIFIED</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallDecision('CONDITIONAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      overallDecision === 'CONDITIONAL'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>CONDITIONAL APPROVAL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallDecision('REJECTED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      overallDecision === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>REJECT / REMEDIATION ORDER</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Signing Manager
                </label>
                <input
                  type="text"
                  required
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Managerial Endorsement Remarks & Instructions
              </label>
              <textarea
                rows={2}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="e.g. Workmanship complies with project specifications. Approved for proceeding to next floor slab reinforcement."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sign-off will be logged to the immutable compliance audit ledger.
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                  overallDecision === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : overallDecision === 'CONDITIONAL'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{submitting ? 'Certifying...' : 'Submit Validation Checklist'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
