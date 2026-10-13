import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/client';
import type { BuildingData, BuildingLevel, BuildingWing } from '../../types';
import { BuildingView } from './BuildingView';

const CHIP: Record<string, string> = {
  DONE: 'bg-green-600 text-white', IN_PROGRESS: 'bg-blue-600 text-white', NOT_STARTED: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

/** The 3D building with each floor filled by how much of its slab is done. Hidden when a project has no floor-wise plan. */
export const BuildingProgress: React.FC<{
  projectId: number;
  onOpenActivity: (activityId: number) => void;
  /** Small summary card with a button to the full 3D page (used on the overview). */
  onOpenFull?: () => void;
  /** Tall viewer for the dedicated 3D page. */
  large?: boolean;
}> = ({ projectId, onOpenActivity, onOpenFull, large = false }) => {
  const [data, setData] = useState<BuildingData | null>(null);
  // what-if: null shows the real progress; a number shows the building as if that much were finished
  const [whatIf, setWhatIf] = useState<number | null>(null);
  const deferredWhatIf = useDeferredValue(whatIf);
  const shown = useMemo(() => (data && deferredWhatIf !== null ? simulate(data, deferredWhatIf) : data), [data, deferredWhatIf]);

  useEffect(() => {
    let alive = true;
    setData(null);
    apiClient.getBuilding(projectId).then((d) => alive && setData(d)).catch(() => alive && setData({ source: 'none', unit: 'm', wings: [] }));
    const timer = window.setInterval(() => apiClient.getBuilding(projectId).then((d) => alive && setData(d)).catch(() => undefined), 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [projectId]);

  if (!data || !shown || data.wings.length === 0) return null;
  const actual = actualPercent(data);
  const open = (level: BuildingLevel, _wing: BuildingWing) => { if (level.activity_ids.length) onOpenActivity(level.activity_ids[0]); };

  const chips = (
    <ul className="flex flex-wrap gap-2 text-sm">
      {data.wings.map((w) => (
        <li key={w.name} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <span className="font-medium text-slate-900">{w.name}</span> · {w.summary.done} of {w.summary.levels} floors done
          {w.summary.running > 0 && <span className="text-blue-700">, {w.summary.running} in progress</span>}
        </li>
      ))}
    </ul>
  );
  if (onOpenFull) {
    return (
      <section className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Building progress">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Building progress</h2>
          <div className="mt-2">{chips}</div>
        </div>
        <button onClick={onOpenFull} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Open 3D view</button>
      </section>
    );
  }
  const viewHeight = large ? Math.max(520, (typeof window === 'undefined' ? 800 : window.innerHeight) - 300) : undefined;

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Building progress">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Building progress</h2>
          <p className="text-xs text-slate-500">Structure (slab by slab). Drag to turn, scroll to zoom, click a floor for details.</p>
        </div>
        {chips}
      </div>

      {large && (
        <div className={`mb-3 rounded-xl border px-4 py-3 ${whatIf !== null ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label htmlFor="what-if" className="font-medium text-slate-900">
              {whatIf !== null ? `What it would look like at ${whatIf}% complete` : `Actual progress: ${actual}% complete`}
            </label>
            <span className="flex items-center gap-2">
              {whatIf !== null && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">Preview only, not real progress</span>}
              {whatIf !== null && <button onClick={() => setWhatIf(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Back to actual ({actual}%)</button>}
            </span>
          </div>
          <input id="what-if" type="range" min={0} max={100} step={1} value={whatIf ?? actual} onChange={(e) => setWhatIf(Number(e.target.value))}
            className="w-full accent-blue-600" aria-valuetext={`${whatIf ?? actual} percent`} />
          <div className="flex justify-between text-xs text-slate-500"><span>0%</span><span>Drag to preview how the building looks at that much completed</span><span>100%</span></div>
        </div>
      )}
      <BuildingView data={shown} onSelectLevel={open} height={viewHeight} />
      {data.source === 'drawing' && (
        <p className="mt-2 text-xs text-slate-500">Shape taken from the project drawing.{data.note ? ` ${data.note}` : ''}</p>
      )}
      {data.source === 'placeholder' && (
        <p className="mt-2 text-xs text-slate-500">Each tower is drawn as a plain block for now. The real shape will appear once the project drawing is added.</p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">Show floors as a list</summary>
        <div className="mt-3 space-y-4">
          {data.wings.map((w) => (
            <div key={w.name}>
              <h3 className="mb-1.5 text-sm font-medium text-slate-800">{w.name}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {[...w.levels].reverse().map((l) => (
                  <li key={l.index}>
                    <button onClick={() => open(l, w)} className={`rounded-md px-2 py-1 text-xs font-medium ${CHIP[l.state]} ${l.late && l.state !== 'DONE' ? 'outline outline-2 outline-red-500' : ''}`}
                      title={`${l.label}: ${l.state === 'IN_PROGRESS' ? `${Math.round(l.progress_percent)}%` : l.state === 'DONE' ? 'done' : 'not started'}`}>
                      {l.label.replace('Foundation and basement', 'Foundation')}{l.state === 'IN_PROGRESS' ? ` ${Math.round(l.progress_percent)}%` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
};

/** Overall completion across every floor, so the slider starts where the real building is. */
const actualPercent = (d: BuildingData): number => {
  const levels = d.wings.flatMap((w) => w.levels);
  if (levels.length === 0) return 0;
  return Math.round(levels.reduce((n, l) => n + (l.state === 'DONE' ? 100 : l.state === 'IN_PROGRESS' ? l.progress_percent : 0), 0) / levels.length);
};

/** The same building as if `percent` of it were finished: floors from the bottom up are done, the next one is part-filled. */
const simulate = (d: BuildingData, percent: number): BuildingData => ({
  ...d,
  wings: d.wings.map((w) => {
    const x = (percent / 100) * w.levels.length;
    const whole = Math.floor(x);
    const frac = x - whole;
    const levels = w.levels.map((l, i): BuildingLevel => {
      if (i < whole) return { ...l, state: 'DONE', progress_percent: 100, late: false };
      if (i === whole && frac > 0.001) return { ...l, state: 'IN_PROGRESS', progress_percent: Math.round(frac * 100), late: false };
      return { ...l, state: 'NOT_STARTED', progress_percent: 0, late: false };
    });
    const structure = levels.filter((l) => l.kind !== 'foundation');
    return { ...w, levels, summary: { ...w.summary, done: structure.filter((l) => l.state === 'DONE').length, running: structure.filter((l) => l.state === 'IN_PROGRESS').length } };
  }),
});
