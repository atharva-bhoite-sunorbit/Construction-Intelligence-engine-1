import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, Calendar, Clock, CheckCircle2, FileText, Pickaxe, Flame, Sparkles } from 'lucide-react';
import { Activity, Project } from '../types';
import { apiClient } from '../api/client';

interface LogHindranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activities: Activity[];
  defaultActivityId?: number;
  onHindranceCreated: () => void;
}

const HINDRANCE_CATEGORIES = [
  'Geotechnical & Strata Obstruction',
  'Groundwater & Water Ingress',
  'Underground Utility Clash',
  'Statutory / Environmental Clearance Delay',
  'Material Supply & Batch Non-Conformance',
  'Subcontractor & Gang Shortage',
  'Plant & Heavy Equipment Breakdown',
  'Severe Weather & Monsoon Stoppage',
  'Design / Drawing Conflict',
  'Site Access & Right of Way Problem',
  'Other Field Difficulty',
];

export const LogHindranceModal: React.FC<LogHindranceModalProps> = ({
  isOpen,
  onClose,
  project,
  activities,
  defaultActivityId,
  onHindranceCreated,
}) => {
  const [activityId, setActivityId] = useState<number | undefined>(defaultActivityId);
  const [category, setCategory] = useState<string>(HINDRANCE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [difficultyCause, setDifficultyCause] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [hindranceState, setHindranceState] = useState<'ACTIVE_HINDRANCE' | 'UNDER_REVIEW' | 'MITIGATION_IN_PROGRESS' | 'RESOLVED'>('ACTIVE_HINDRANCE');
  const [delayImpactDays, setDelayImpactDays] = useState<number>(3);
  const [openedDate, setOpenedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedResolution, setExpectedResolution] = useState('');
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the difficulty encountered.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.createHindrance(project.id, {
        activity_id: activityId ? Number(activityId) : undefined,
        category,
        description: description.trim(),
        severity,
        opened_date: openedDate,
        expected_resolution: expectedResolution || undefined,
        mitigation_plan: mitigationPlan.trim() || undefined,
        hindrance_state: hindranceState,
        delay_impact_days: Number(delayImpactDays),
        difficulty_cause: difficultyCause.trim() || undefined,
      });

      onHindranceCreated();
      onClose();
    } catch (err: any) {
      console.error('Error logging hindrance:', err);
      setError(err.response?.data?.detail || 'Failed to record hindrance. Please verify fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-600 to-amber-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Contractual & Field Record Register
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
            Log Project Hindrance & Difficulty Record
          </h2>
          <p className="text-xs text-amber-100 mt-1">
            Formally log obstacles, subsurface surprises, and bottlenecks to maintain a persistent record for manager review and schedule compensation.
          </p>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-800">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Project & Affected Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Project
              </label>
              <input
                type="text"
                disabled
                value={`${project.name} (${project.code})`}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Affected Activity (Optional)
              </label>
              <select
                value={activityId || ''}
                onChange={(e) => setActivityId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">General Project-Wide Hindrance</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `[${a.code}] ` : ''}{a.name} ({a.phase})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Hindrance State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Difficulty Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {HINDRANCE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Hindrance State
              </label>
              <select
                value={hindranceState}
                onChange={(e) => setHindranceState(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ACTIVE_HINDRANCE">ACTIVE HINDRANCE (Work Impeded)</option>
                <option value="UNDER_REVIEW">UNDER REVIEW (Engineering Assessment)</option>
                <option value="MITIGATION_IN_PROGRESS">MITIGATION IN PROGRESS</option>
                <option value="RESOLVED">RESOLVED (Difficulty Cleared)</option>
              </select>
            </div>
          </div>

          {/* Severity & Impact Days */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Severity Level
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    className={`py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                      severity === lvl
                        ? lvl === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : lvl === 'HIGH'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Estimated Delay Impact (Days)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={delayImpactDays}
                onChange={(e) => setDelayImpactDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Hindrance Encounter Date
              </label>
              <input
                type="date"
                required
                value={openedDate}
                onChange={(e) => setOpenedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Target Resolution Date
              </label>
              <input
                type="date"
                value={expectedResolution}
                onChange={(e) => setExpectedResolution(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Description of Difficulty */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Difficulty & Obstacle Description *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the exact difficulty encountered on site (e.g. Unforeseen hard basalt rock boulder layer encountered at -4.5m excavation requiring pneumatic breakers, halting footing reinforcement)..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
            />
          </div>

          {/* Root Cause / Difficulty Cause */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Root Cause / Subsurface or Logistical Trigger
            </label>
            <input
              type="text"
              value={difficultyCause}
              onChange={(e) => setDifficultyCause(e.target.value)}
              placeholder="e.g. High groundwater seepage exceeding single sump pump discharge capacity"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
            />
          </div>

          {/* Mitigation / Recovery Plan */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Proposed Mitigation / Catch-Up Action
            </label>
            <textarea
              rows={2}
              value={mitigationPlan}
              onChange={(e) => setMitigationPlan(e.target.value)}
              placeholder="e.g. Mobilize 2 additional 15HP submersible dewatering pumps and deploy hydraulic rock breaker attachment for night shift..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md shadow-amber-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Record Hindrance in Official Register</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
