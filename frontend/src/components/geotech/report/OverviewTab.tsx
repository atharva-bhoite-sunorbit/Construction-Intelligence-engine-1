import { Drill, CheckCircle2, Building2 } from 'lucide-react';
import { SourceBadge } from '../SourceBadge';
import { GeotechReportCtx } from './useGeotechReportState';

export const OverviewTab: React.FC<{ ctx: GeotechReportCtx }> = ({ ctx }) => {
  const { openFieldInspect, pInfo, invInfo, valData } = ctx;
  return (
    <div className="space-y-6">
      {/* Validation Banner */}
      {valData && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
            valData.is_valid
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                ENGINEERING VALIDATION STATUS: {valData.status}
              </span>
            </div>
            <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {valData.passed_checks.map((chk: string, i: number) => (
                <span key={i} className="flex items-center gap-1 text-[11px]">
                  ✓ {chk}
                </span>
              ))}
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
            Validated: {new Date(valData.validation_timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Project & Investigation Two-Column Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Information Card (Section 3) */}
        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span>Project Information</span>
            </h3>
            <span className="text-[10px] text-slate-400">Section 3.0</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { label: 'Project Name', key: 'project_name' },
              { label: 'Client / Developer', key: 'client' },
              { label: 'Site Location', key: 'location' },
              { label: 'Building Structure', key: 'building_configuration' },
              { label: 'Number of Floors', key: 'number_of_floors' },
              { label: 'Investigation Date', key: 'investigation_date' },
              { label: 'Report Date', key: 'report_date' },
              { label: 'Geotechnical Consultant', key: 'consultant' },
              { label: 'Report Number', key: 'report_number' },
              { label: 'Revision', key: 'revision_number' },
            ].map(({ label, key }) => {
              const field = pInfo?.[key];
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">{label}</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {field?.display || 'Not specified in report'}
                    </span>
                  </div>
                  {field && (
                    <SourceBadge
                      sourceType={field.source_type}
                      confidence={field.confidence}
                      page={field.source_page}
                      onViewSource={() => openFieldInspect(label, field)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Investigation Information Card (Section 4) */}
        <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Drill className="w-4 h-4 text-brand-600" />
              <span>Investigation Methodology & Standards</span>
            </h3>
            <span className="text-[10px] text-slate-400">Section 4.0</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { label: 'Number of Boreholes', key: 'number_of_boreholes' },
              { label: 'Borehole IDs', key: 'borehole_ids' },
              { label: 'Investigation Depth', key: 'investigation_depth_m' },
              { label: 'Drilling Methodology', key: 'drilling_method' },
              { label: 'SPT Methodology', key: 'spt_methodology' },
              { label: 'Rock Coring Method', key: 'rock_coring_methodology' },
              { label: 'Relevant IS Standards', key: 'relevant_is_standards' },
              { label: 'Laboratory Testing Scope', key: 'laboratory_testing_information' },
            ].map(({ label, key }) => {
              const field = invInfo?.[key];
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                  <div className="max-w-[65%]">
                    <span className="text-[10px] text-slate-400 font-semibold block">{label}</span>
                    <span className="font-bold text-slate-800 font-mono break-words">
                      {field?.display || 'Not specified in report'}
                    </span>
                  </div>
                  {field && (
                    <SourceBadge
                      sourceType={field.source_type}
                      confidence={field.confidence}
                      page={field.source_page}
                      onViewSource={() => openFieldInspect(label, field)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
