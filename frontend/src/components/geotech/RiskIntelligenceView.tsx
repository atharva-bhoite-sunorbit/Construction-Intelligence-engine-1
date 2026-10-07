import React from 'react';
import { GeotechnicalRiskRecord } from '../../types';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { SourceBadge } from './SourceBadge';

interface RiskIntelligenceViewProps {
  risks: GeotechnicalRiskRecord[];
}

export const RiskIntelligenceView: React.FC<RiskIntelligenceViewProps> = ({ risks }) => {
  if (!risks || risks.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        No high or medium geotechnical risks detected in report.
      </div>
    );
  }

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>AI Geotechnical Risk Assessment & Subsurface Vulnerabilities</span>
          </h3>
          <p className="text-xs text-slate-500">
            Source-grounded hazard interpretation layer based on site boreholes and report findings.
          </p>
        </div>
        <SourceBadge sourceType="AI_INTERPRETATION" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risks.map((risk, idx) => (
          <div
            key={idx}
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  {risk.category}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{risk.risk_title}</h4>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getSeverityBadge(
                  risk.severity
                )}`}
              >
                {risk.severity} RISK
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900 block mb-1">Observation / Cause:</span>
              {risk.reason}
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Recommended Engineering Mitigation:</span>
              </div>
              <p className="leading-relaxed">{risk.recommended_action}</p>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
              <span>Source Grounding: {risk.source}</span>
              <span className="font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                AI Interpretation
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
