import { Layers, Truck, Rotate3d } from 'lucide-react';
import { SourceBadge } from '../SourceBadge';
import { VEHICLE_IMAGE_MAP, getStrataTheme, getExcavabilityBadge } from '../../../pages/GeotechnicalReportPageConstants';
import { GeotechReportCtx } from './useGeotechReportState';

export const LayersTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { setActiveTab, rawLayersList } = ctx;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" />
            <span>Layer-by-Layer Subsurface Parsing & Engineering Specifications</span>
          </h3>
          <p className="text-xs text-slate-500">
            Comprehensive geological stratification, excavability classifications (Class I–V), bulking expansions & equipment assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('3d_cutaway')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-colors shadow-2xs"
          >
            <Rotate3d className="w-3.5 h-3.5" />
            View 3D Cube Cutaway
          </button>
          <SourceBadge sourceType="REPORT" confidence="HIGH" />
        </div>
      </div>

      {/* Stratum Layer Cards Grid */}
      <div className="space-y-4">
        {rawLayersList.map((layer, idx) => {
          const theme = getStrataTheme(layer.material_key || layer.material);
          const cls = getExcavabilityBadge(layer.excavability_class_num);
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl border bg-white border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0 bg-gradient-to-br ${theme.gradient} text-white`}>
                    {theme.iconSymbol}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        Layer {idx + 1} • {layer.category}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-2xs ${cls.bg}`}>
                        Class {layer.excavability_class_num}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mt-0.5">
                      {layer.material}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                      {layer.description}
                    </p>
                  </div>
                </div>

                {/* Depth & Thickness Pill */}
                <div className="flex items-center gap-4 text-xs font-mono self-end lg:self-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-sans">Depth Range</span>
                    <span className="font-bold text-slate-800">
                      {layer.top_m}m – {layer.bottom_m}m
                    </span>
                  </div>
                  <div className="h-7 w-px bg-slate-200" />
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-sans">Thickness</span>
                    <span className="font-bold text-brand-700">
                      {layer.thickness_m.toFixed(2)} m
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Parameters Matrix */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Excavability</span>
                  <span className="font-bold text-slate-800 mt-0.5 block truncate" title={cls.label}>
                    {cls.label}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Bulking Factor</span>
                  <span className="font-bold text-amber-700 mt-0.5 block font-mono">
                    {layer.bulking_factor || 1.25}x (+{Math.round(((layer.bulking_factor || 1.25) - 1) * 100)}% Loose)
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Compressive Strength</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                    {layer.ucs_mpa ? `${layer.ucs_mpa} MPa` : 'Soil Horizon'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Rock Quality (RQD)</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                    {layer.rqd_pct ? `${layer.rqd_pct}%` : 'N/A (Soil)'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Excavation Method</span>
                  <span className="font-semibold text-slate-700 mt-0.5 block truncate" title={layer.excavation_method}>
                    {layer.excavation_method || cls.desc}
                  </span>
                </div>
              </div>

              {/* Recommended Machinery Chips */}
              {layer.recommended_machinery && layer.recommended_machinery.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Required Machinery:
                  </span>
                  {layer.recommended_machinery.map((mKey: string) => {
                    const vMeta = VEHICLE_IMAGE_MAP[mKey];
                    return (
                      <span
                        key={mKey}
                        onClick={() => setActiveTab('machinery')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
                      >
                        <Truck className="w-3 h-3 text-slate-500" />
                        <span>{vMeta?.label || mKey}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
