import React, { useState } from 'react';
import { X, Building2, Calendar, MapPin, Ruler, UserCheck, RefreshCw, HardHat } from 'lucide-react';
import { apiClient } from '../api/client';
import { Project } from '../types';
import { StageEngineersSelector, getDefaultStageEngineers } from './StageEngineersSelector';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

const CONSTRUCTION_TYPES = [
  'Residential High-Rise',
  'Commercial Office',
  'Industrial Factory',
  'Commercial Mall',
  'High-Rise',
  'Residential',
  'Commercial',
  'Mall',
  'Factory',
  'Industrial',
  'Hotel',
  'Hospital',
  'Warehouse',
  'Infrastructure',
  'Other',
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const generateNewCode = () => `PRJ-${Math.floor(100 + Math.random() * 900)}`;

  const [formData, setFormData] = useState({
    name: '',
    code: generateNewCode(),
    construction_type: 'High-Rise',
    location: '',
    num_floors: 10,
    num_towers: 1,
    built_up_area: 25000,
    plot_area: 8000,
    planned_start_date: new Date().toISOString().split('T')[0],
    target_completion_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    project_manager: 'Marcus Brody',
    site_manager: 'Elena Rostova',
    contractor: 'Apex Prime Contractors Ltd.',
    description: '',
  });

  const [stageEngineers, setStageEngineers] = useState<Record<string, string[]>>(getDefaultStageEngineers());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate dates
    if (new Date(formData.target_completion_date) <= new Date(formData.planned_start_date)) {
      setError('Target completion date must be later than planned start date.');
      setLoading(false);
      return;
    }

    try {
      const payload: Partial<Project> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        construction_type: formData.construction_type,
        location: formData.location.trim(),
        num_floors: Number(formData.num_floors) || 1,
        num_towers: Number(formData.num_towers) || 1,
        built_up_area: Number(formData.built_up_area) || 1000,
        plot_area: formData.plot_area ? Number(formData.plot_area) : undefined,
        planned_start_date: formData.planned_start_date,
        target_completion_date: formData.target_completion_date,
        project_manager: formData.project_manager.trim() || undefined,
        site_manager: formData.site_manager.trim() || undefined,
        contractor: formData.contractor.trim() || undefined,
        description: formData.description.trim() || undefined,
        stage_engineers: stageEngineers,
      };

      const created = await apiClient.createProject(payload);
      onProjectCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Project creation error:', err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        const msgs = detail.map((d: any) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
          return field ? `${field}: ${d.msg}` : d.msg || 'Invalid field';
        });
        setError(msgs.join(', '));
      } else if (detail && typeof detail === 'object') {
        setError(JSON.stringify(detail));
      } else {
        setError(err.message || 'Failed to create project. Please verify inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Create New Construction Project</h2>
              <p className="text-xs text-slate-500">Initialize project scope, location, baseline schedule, and key staff</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <span className="font-bold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Phoenix Business Hub"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Project Code *
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, code: generateNewCode() })}
                  className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono font-medium focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Construction Type *
              </label>
              <select
                value={formData.construction_type}
                onChange={(e) => setFormData({ ...formData, construction_type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              >
                {CONSTRUCTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Location *
              </label>
              <input
                type="text"
                required
                placeholder="City, District, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Number of Floors
              </label>
              <input
                type="number"
                min="1"
                value={formData.num_floors}
                onChange={(e) => setFormData({ ...formData, num_floors: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Number of Towers / Blocks
              </label>
              <input
                type="number"
                min="1"
                value={formData.num_towers}
                onChange={(e) => setFormData({ ...formData, num_towers: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Built-Up Area (m² or sq.ft) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.built_up_area}
                onChange={(e) => setFormData({ ...formData, built_up_area: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Plot Area (m² or sq.ft)
              </label>
              <input
                type="number"
                min="0"
                value={formData.plot_area}
                onChange={(e) => setFormData({ ...formData, plot_area: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Planned Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.planned_start_date}
                onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Completion Date *
              </label>
              <input
                type="date"
                required
                value={formData.target_completion_date}
                onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project Manager
              </label>
              <input
                type="text"
                placeholder="Manager Name"
                value={formData.project_manager}
                onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Site Manager / Site Lead
              </label>
              <input
                type="text"
                placeholder="Site Manager Name"
                value={formData.site_manager}
                onChange={(e) => setFormData({ ...formData, site_manager: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Contractor / EPC Partner
              </label>
              <input
                type="text"
                placeholder="Contractor Agency"
                value={formData.contractor}
                onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
              />
            </div>
          </div>

          {/* Site Engineers Checkbox Selector by Project Stage */}
          <div className="pt-2">
            <StageEngineersSelector
              value={stageEngineers}
              onChange={setStageEngineers}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Project Description & Scope
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Key specifications, structural methodology, milestones..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm transition-all text-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Initializing Project...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
