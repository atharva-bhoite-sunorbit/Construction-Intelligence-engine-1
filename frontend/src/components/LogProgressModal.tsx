import React, { useState } from 'react';
import { X, ClipboardCheck, Users, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Activity } from '../types';

interface LogProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  defaultActivityId?: number;
  onProgressLogged: () => void;
}

export const LogProgressModal: React.FC<LogProgressModalProps> = ({
  isOpen,
  onClose,
  activities,
  defaultActivityId,
  onProgressLogged,
}) => {
  const [activityId, setActivityId] = useState<number>(
    defaultActivityId || (activities[0]?.id || 0)
  );
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [plannedQty, setPlannedQty] = useState<number>(20);
  const [actualQty, setActualQty] = useState<number>(18);
  const [workersAvail, setWorkersAvail] = useState<number>(12);
  const [workersAssign, setWorkersAssign] = useState<number>(10);
  const [workingHours, setWorkingHours] = useState<number>(8.0);
  const [matAvail, setMatAvail] = useState<number>(90);
  const [eqAvail, setEqAvail] = useState<number>(100);
  const [weather, setWeather] = useState<string>('Clear');
  const [issues, setIssues] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentAct = activities.find((a) => a.id === activityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.submitProgress({
        activity_id: activityId,
        report_date: reportDate,
        planned_quantity: Number(plannedQty),
        actual_quantity: Number(actualQty),
        workers_available: Number(workersAvail),
        workers_assigned: Number(workersAssign),
        working_hours: Number(workingHours),
        material_availability_percent: Number(matAvail),
        equipment_availability_percent: Number(eqAvail),
        weather,
        issues: issues || undefined,
        remarks: remarks || undefined,
      });
      onProgressLogged();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit daily progress.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-wide">LOG DAILY SITE PROGRESS</h2>
              <p className="text-xs text-slate-500">Update actual quantities, labor muster, and site conditions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Select Construction Activity *
            </label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.tower} F{a.floor}] {a.name} ({a.status} - {a.progress_percent}%)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Report Date
              </label>
              <input
                type="date"
                required
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Planned Qty ({currentAct?.unit || 'units'})
              </label>
              <input
                type="number"
                value={plannedQty}
                onChange={(e) => setPlannedQty(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Actual Qty Achieved
              </label>
              <input
                type="number"
                value={actualQty}
                onChange={(e) => setActualQty(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Workers Available
              </label>
              <input
                type="number"
                value={workersAvail}
                onChange={(e) => setWorkersAvail(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Workers Assigned
              </label>
              <input
                type="number"
                value={workersAssign}
                onChange={(e) => setWorkersAssign(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Working Hours
              </label>
              <input
                type="number"
                step="0.5"
                value={workingHours}
                onChange={(e) => setWorkingHours(parseFloat(e.target.value) || 8.0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Material Avail %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={matAvail}
                onChange={(e) => setMatAvail(parseFloat(e.target.value) || 100)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Equipment Avail %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={eqAvail}
                onChange={(e) => setEqAvail(parseFloat(e.target.value) || 100)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Weather
              </label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="Clear">Clear</option>
                <option value="Cloudy">Cloudy</option>
                <option value="Rain">Rain</option>
                <option value="Extreme Heat">Extreme Heat</option>
                <option value="Storm">Storm</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Issues & Blockers Encountered
            </label>
            <input
              type="text"
              placeholder="e.g. Scaffolding delay, access road congested..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Site Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Inspection status, curing instructions..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 text-sm disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Submit Daily Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
