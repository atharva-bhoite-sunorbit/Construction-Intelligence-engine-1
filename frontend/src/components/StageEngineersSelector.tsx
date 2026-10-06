import React, { useState } from 'react';
import { HardHat, Check, Plus, Users, ShieldCheck, CheckSquare, Square, Sparkles } from 'lucide-react';

export interface StageConfig {
  key: string;
  label: string;
  shortDesc: string;
  accentColor: string;
  defaultEngineers: string[];
}

export const STANDARD_PROJECT_STAGES: StageConfig[] = [
  {
    key: 'Pre-Construction',
    label: 'Pre-Construction',
    shortDesc: 'Surveys, geotech, permits, foundation layout & logistics planning',
    accentColor: 'border-cyan-500 text-cyan-700 bg-cyan-50',
    defaultEngineers: [
      'Liam Chen (Lead Structural Engineer)',
      'Vikram Malhotra (Geotechnical & Site Survey Engineer)',
      'Sofia Alvarez (Planning & Estimation Engineer)',
      'Arvind Rao (Statutory & Permits Liaison Engineer)',
    ],
  },
  {
    key: 'Substructure',
    label: 'Substructure',
    shortDesc: 'Piling, deep excavation, shoring, raft footing & basement retaining walls',
    accentColor: 'border-amber-500 text-amber-700 bg-amber-50',
    defaultEngineers: [
      'Liam Chen (Lead Structural Engineer)',
      'Rahul Deshmukh (Piling & Deep Foundation Engineer)',
      'Amit Patel (Excavation & Shoring Engineer)',
      'Elena Rostova (Site Quality & Safety Engineer)',
    ],
  },
  {
    key: 'Superstructure',
    label: 'Superstructure',
    shortDesc: 'RCC columns, shear walls, post-tensioned slabs & structural steel frames',
    accentColor: 'border-blue-500 text-blue-700 bg-blue-50',
    defaultEngineers: [
      'Liam Chen (Lead Structural Engineer)',
      'Marcus Brody (QC & Concrete Technology Engineer)',
      'Daniel Kim (Formwork & Post-Tensioning Engineer)',
      'Rohan Kulkarni (High-Rise Frame & Steel Engineer)',
    ],
  },
  {
    key: 'MEP',
    label: 'MEP',
    shortDesc: 'Electrical distribution, plumbing stacks, HVAC ducting & fire protection',
    accentColor: 'border-purple-500 text-purple-700 bg-purple-50',
    defaultEngineers: [
      'Sarah Jenkins (Senior Electrical Engineer)',
      'Tariq Mansoor (HVAC & Firefighting Systems Engineer)',
      'Neha Verma (Plumbing & Sanitation Engineer)',
      'Kevin O\'Connor (BMS & Low Voltage Engineer)',
    ],
  },
  {
    key: 'Finishing',
    label: 'Finishing',
    shortDesc: 'AAC block masonry, plastering, tile flooring, curtain wall & interior fit-out',
    accentColor: 'border-emerald-500 text-emerald-700 bg-emerald-50',
    defaultEngineers: [
      'Priya Sharma (Architectural Finishes Engineer)',
      'Carlos Mendez (Curtain Wall & Glazing Engineer)',
      'David Wong (Interior Fit-Out Engineer)',
      'Sunita Mehra (Flooring & Waterproofing Engineer)',
    ],
  },
  {
    key: 'Handover',
    label: 'Handover',
    shortDesc: 'Snagging rectification, testing, commissioning, compliance & client handover',
    accentColor: 'border-indigo-500 text-indigo-700 bg-indigo-50',
    defaultEngineers: [
      'Alexander Vance (Testing, Commissioning & QA Engineer)',
      'Elena Rostova (Snagging & Defect Rectification Engineer)',
      'Ananya Roy (Handover & As-Built Documentation Engineer)',
      'James Wilson (Client Inspection & Handover Engineer)',
    ],
  },
];

export const getDefaultStageEngineers = (): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  STANDARD_PROJECT_STAGES.forEach((stage) => {
    // Pick the first 2-3 standard engineers as pre-checked defaults
    result[stage.key] = stage.defaultEngineers.slice(0, 2);
  });
  return result;
};

interface StageEngineersSelectorProps {
  value: Record<string, string[]>;
  onChange: (val: Record<string, string[]>) => void;
  compact?: boolean;
}

export const StageEngineersSelector: React.FC<StageEngineersSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [activeStageKey, setActiveStageKey] = useState<string>('Pre-Construction');
  const [customEngineerName, setCustomEngineerName] = useState<string>('');
  const [engineerPool, setEngineerPool] = useState<Record<string, string[]>>(() => {
    const pool: Record<string, string[]> = {};
    STANDARD_PROJECT_STAGES.forEach((s) => {
      // Ensure all standard engineers plus any already selected are in pool
      const selected = value[s.key] || [];
      const combined = Array.from(new Set([...s.defaultEngineers, ...selected]));
      pool[s.key] = combined;
    });
    return pool;
  });

  const activeStage =
    STANDARD_PROJECT_STAGES.find((s) => s.key === activeStageKey) || STANDARD_PROJECT_STAGES[0];

  const currentSelectedList = value[activeStage.key] || [];
  const currentPoolList = engineerPool[activeStage.key] || activeStage.defaultEngineers;

  // Toggle engineer checkbox
  const handleToggleEngineer = (stageKey: string, engineerName: string) => {
    const current = value[stageKey] || [];
    let updated: string[];
    if (current.includes(engineerName)) {
      updated = current.filter((name) => name !== engineerName);
    } else {
      updated = [...current, engineerName];
    }
    onChange({
      ...value,
      [stageKey]: updated,
    });
  };

  // Select all for current stage
  const handleSelectAll = (stageKey: string) => {
    const pool = engineerPool[stageKey] || [];
    onChange({
      ...value,
      [stageKey]: [...pool],
    });
  };

  // Deselect all for current stage
  const handleClearAll = (stageKey: string) => {
    onChange({
      ...value,
      [stageKey]: [],
    });
  };

  // Add custom engineer
  const handleAddCustomEngineer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customEngineerName.trim();
    if (!trimmed) return;

    // Add to pool if not present
    const pool = engineerPool[activeStage.key] || [];
    if (!pool.includes(trimmed)) {
      setEngineerPool({
        ...engineerPool,
        [activeStage.key]: [...pool, trimmed],
      });
    }

    // Also auto-select it
    if (!currentSelectedList.includes(trimmed)) {
      onChange({
        ...value,
        [activeStage.key]: [...currentSelectedList, trimmed],
      });
    }

    setCustomEngineerName('');
  };

  // Count total assignments
  const totalAssigned = Object.values(value).reduce((sum, list) => sum + (list?.length || 0), 0);

  return (
    <div className="space-y-3.5 bg-slate-50/80 rounded-xl p-4 border border-slate-200">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
            <HardHat className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Site Engineers Checklist by Project Stage</span>
              <span className="text-[10px] bg-brand-50 text-brand-700 font-mono font-bold px-2 py-0.5 rounded-full border border-brand-200">
                {totalAssigned} Selected
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Select or assign specialized site engineers for each stage of construction
            </p>
          </div>
        </div>

        {/* Global summary badge */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleSelectAll(activeStage.key)}
            className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold hover:underline"
          >
            Select All Stage
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => handleClearAll(activeStage.key)}
            className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold hover:underline"
          >
            Clear Stage
          </button>
        </div>
      </div>

      {/* Stage Tab Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {STANDARD_PROJECT_STAGES.map((stage) => {
          const isActive = stage.key === activeStageKey;
          const stageCount = (value[stage.key] || []).length;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActiveStageKey(stage.key)}
              className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between ${
                isActive
                  ? 'bg-white border-brand-600 ring-2 ring-brand-500/20 shadow-xs'
                  : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[11px] font-bold truncate ${isActive ? 'text-brand-900' : 'text-slate-800'}`}>
                  {stage.label}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    stageCount > 0
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {stageCount}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1">
                {stageCount === 0 ? 'No engineer' : `${stageCount} engineer${stageCount > 1 ? 's' : ''}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Stage Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
        {/* Stage description banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${activeStage.accentColor}`}>
              {activeStage.label} Stage
            </span>
            <span className="text-slate-600 text-xs">{activeStage.shortDesc}</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {currentSelectedList.length} of {currentPoolList.length} checked
          </span>
        </div>

        {/* Checkbox Site Engineers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {currentPoolList.map((engineerName) => {
            const isChecked = currentSelectedList.includes(engineerName);
            return (
              <label
                key={engineerName}
                onClick={() => handleToggleEngineer(activeStage.key, engineerName)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-brand-50/50 border-brand-500/70 text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent div onClick
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {engineerName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Assigned for {activeStage.label} execution & site supervision
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Add custom engineer inline */}
        <div className="pt-2 border-t border-slate-100">
          <form onSubmit={handleAddCustomEngineer} className="flex gap-2">
            <input
              type="text"
              placeholder={`Add custom site engineer for ${activeStage.label}...`}
              value={customEngineerName}
              onChange={(e) => setCustomEngineerName(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-1 focus:ring-brand-600/30 transition-all"
            />
            <button
              type="submit"
              disabled={!customEngineerName.trim()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add & Select</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
