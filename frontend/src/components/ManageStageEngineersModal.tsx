import React, { useState, useEffect } from 'react';
import { X, HardHat, Save, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Project } from '../types';
import { apiClient } from '../api/client';
import { StageEngineersSelector, getDefaultStageEngineers } from './StageEngineersSelector';

interface ManageStageEngineersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdated: (updatedProject: Project) => void;
}

export const ManageStageEngineersModal: React.FC<ManageStageEngineersModalProps> = ({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}) => {
  const [stageEngineers, setStageEngineers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      if (project.stage_engineers && Object.keys(project.stage_engineers).length > 0) {
        setStageEngineers(project.stage_engineers);
      } else {
        setStageEngineers(getDefaultStageEngineers());
      }
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await apiClient.updateProject(project.id, {
        stage_engineers: stageEngineers,
      });
      setSuccessMsg('Site engineer stage assignments saved successfully.');
      onProjectUpdated(updated);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Error updating stage engineers:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to save site engineers.');
    } finally {
      setSaving(false);
    }
  };

  const totalAssigned = Object.values(stageEngineers).reduce((sum, list) => sum + (list?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shadow-xs">
                <HardHat className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Site Engineers by Project Stage
                  </h2>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {project.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Assign & manage specialized site engineers for <span className="font-semibold text-slate-700">{project.name}</span> across all 6 construction stages
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {successMsg && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Interactive Checkbox Component */}
          <div className="mt-5">
            <StageEngineersSelector
              value={stageEngineers}
              onChange={setStageEngineers}
            />
          </div>
        </div>

        {/* Footer controls */}
        <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700 font-mono">{totalAssigned}</span> engineers checked across project stages
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm transition-all text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Assignments...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Stage Engineers</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
