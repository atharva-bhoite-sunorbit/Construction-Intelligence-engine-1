import React, { useState } from 'react';
import { X, Sparkles, Wand2, Layers, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';

interface AutoPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectType: string;
  defaultFloors: number;
  defaultTowers: number;
  onPlanGenerated: () => void;
}

export const AutoPlanModal: React.FC<AutoPlanModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectType,
  defaultFloors,
  defaultTowers,
  onPlanGenerated,
}) => {
  const [numFloors, setNumFloors] = useState<number>(defaultFloors || 5);
  const [numTowers, setNumTowers] = useState<number>(defaultTowers || 1);
  const [zonesPerFloor, setZonesPerFloor] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);

    try {
      const res = await apiClient.generateAutoPlan(projectId, {
        num_floors: numFloors,
        num_towers: numTowers,
        zones_per_floor: zonesPerFloor,
        include_mep_finishes: true,
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        onPlanGenerated();
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to auto-generate plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xs border border-slate-200 p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AUTO PLAN GENERATION ENGINE</h2>
              <p className="text-xs text-slate-500">Template-driven construction sequencing & CPM baseline</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-sm font-semibold text-emerald-300">{successMsg}</div>
            <div className="text-xs text-slate-500">Applying CPM scheduling & baseline forward-pass...</div>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="mt-5 space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 font-medium">Selected Template Engine:</span>
              <div className="font-semibold text-brand-300">{projectType} Sequence Library</div>
              <p className="text-[11px] text-slate-500">
                Automatically builds multi-level hierarchy: Pre-construction, Substructure, Floor-wise Column/Beam/Slab cycles, MEP, Masonry, Finishing, and Handover.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Floors to Generate
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={numFloors}
                  onChange={(e) => setNumFloors(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Towers / Wings
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numTowers}
                  onChange={(e) => setNumTowers(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Zones Per Floor
              </label>
              <select
                value={zonesPerFloor}
                onChange={(e) => setZonesPerFloor(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value={1}>Single Zone (Zone 1)</option>
                <option value={2}>2 Zones (East / West Wings)</option>
                <option value={4}>4 Zones (North / South / East / West)</option>
              </select>
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-brand-500/20 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {loading ? 'Synthesizing Sequence...' : 'Generate Auto Plan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
