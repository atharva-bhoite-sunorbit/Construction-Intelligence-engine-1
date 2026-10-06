import React, { useState } from 'react';
import { X, PlusCircle, Calendar, Layers, ShieldAlert, HardHat, CheckSquare, Square } from 'lucide-react';
import { apiClient } from '../api/client';
import { Activity } from '../types';
import { STANDARD_PROJECT_STAGES } from './StageEngineersSelector';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onActivityAdded: (activity: Activity) => void;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onActivityAdded,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    code: `ACT-${Math.floor(100 + Math.random() * 900)}`,
    phase: 'Execution',
    work_package: 'Structure',
    category: 'Concrete',
    subcategory: 'Slab',
    building: 'Main Building',
    tower: 'Tower A',
    floor: 1,
    zone: 'Zone 1',
    quantity: 100,
    unit: 'sq.m',
    planned_duration: 5,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    required_labour: 12,
    required_material: 'Concrete M35, TMT Rebar',
    required_equipment: 'Concrete Pump, Transit Mixer',
    priority: 'MEDIUM',
  });

  const getStageEngineersForPhase = (phaseName: string) => {
    const stage = STANDARD_PROJECT_STAGES.find((s) => s.key === phaseName) ||
      (phaseName === 'Execution' ? STANDARD_PROJECT_STAGES.find((s) => s.key === 'Superstructure') : STANDARD_PROJECT_STAGES[0]);
    return stage?.defaultEngineers || [];
  };

  const [selectedEngineers, setSelectedEngineers] = useState<string[]>(() => {
    return getStageEngineersForPhase('Execution').slice(0, 1);
  });

  const [loading, setLoading] = useState(false);

  const handlePhaseChange = (newPhase: string) => {
    setFormData({ ...formData, phase: newPhase });
    const pool = getStageEngineersForPhase(newPhase);
    setSelectedEngineers(pool.slice(0, 1));
  };

  const toggleEngineer = (name: string) => {
    if (selectedEngineers.includes(name)) {
      setSelectedEngineers(selectedEngineers.filter((e) => e !== name));
    } else {
      setSelectedEngineers([...selectedEngineers, name]);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const created = await apiClient.createActivity(projectId, {
        ...formData,
        project_id: projectId,
        floor: Number(formData.floor),
        quantity: Number(formData.quantity),
        planned_duration: Number(formData.planned_duration),
        required_labour: Number(formData.required_labour),
      });
      onActivityAdded(created);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create activity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-slate-900 tracking-wide">+ ADD CONSTRUCTION ACTIVITY</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Activity Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Slab Reinforcement Steel & Formwork"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Phase *
              </label>
              <select
                value={formData.phase}
                onChange={(e) => handlePhaseChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none"
              >
                <option value="Pre-Construction">Pre-Construction</option>
                <option value="Substructure">Substructure</option>
                <option value="Superstructure">Superstructure</option>
                <option value="Execution">Execution</option>
                <option value="MEP">MEP</option>
                <option value="Finishing">Finishing</option>
                <option value="Handover">Handover</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Floor
              </label>
              <input
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Unit
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Planned Duration (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.planned_duration}
                onChange={(e) => setFormData({ ...formData, planned_duration: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Workers Needed
              </label>
              <input
                type="number"
                value={formData.required_labour}
                onChange={(e) => setFormData({ ...formData, required_labour: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Required Material
              </label>
              <input
                type="text"
                placeholder="e.g. Cement, TMT Bars"
                value={formData.required_material}
                onChange={(e) => setFormData({ ...formData, required_material: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Required Equipment
              </label>
              <input
                type="text"
                placeholder="e.g. Tower Crane, Concrete Pump"
                value={formData.required_equipment}
                onChange={(e) => setFormData({ ...formData, required_equipment: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Site Engineers for this Stage */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <HardHat className="w-3.5 h-3.5 text-brand-600" />
                <span>Site Engineers ({formData.phase} Stage):</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedEngineers.length} Checked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {getStageEngineersForPhase(formData.phase).map((engName) => {
                const checked = selectedEngineers.includes(engName);
                return (
                  <label
                    key={engName}
                    onClick={() => toggleEngineer(engName)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                      checked
                        ? 'bg-white border-brand-500 text-brand-900 shadow-xs ring-1 ring-brand-500/20'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                    />
                    <span className="truncate font-medium">{engName}</span>
                  </label>
                );
              })}
            </div>
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
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-lg shadow-brand-500/20 text-sm disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
