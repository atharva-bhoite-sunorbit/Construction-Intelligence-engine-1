import React, { useState } from 'react';
import { GeotechnicalAuditRecord } from '../../types';
import { History, Eye, Search, Filter } from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { ViewSourceModal } from './ViewSourceModal';

interface GeotechAuditTrailProps {
  auditTrail: GeotechnicalAuditRecord[];
}

export const GeotechAuditTrail: React.FC<GeotechAuditTrailProps> = ({ auditTrail }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('ALL');
  const [inspectRecord, setInspectRecord] = useState<GeotechnicalAuditRecord | null>(null);

  if (!auditTrail || auditTrail.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        No audit entries recorded for this report session.
      </div>
    );
  }

  const sections = ['ALL', ...Array.from(new Set(auditTrail.map((a) => a.section)))];

  const filtered = auditTrail.filter((item) => {
    const matchesSearch =
      item.parameter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.extracted_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.source_text_snippet && item.source_text_snippet.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSec = filterSection === 'ALL' || item.section === filterSection;
    return matchesSearch && matchesSec;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parameter, value, or text..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All Sections' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Audit ID</th>
                <th className="py-2.5 px-4">Section / Domain</th>
                <th className="py-2.5 px-4">Parameter</th>
                <th className="py-2.5 px-4">Extracted Value</th>
                <th className="py-2.5 px-4">Source Type</th>
                <th className="py-2.5 px-4">Confidence</th>
                <th className="py-2.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.audit_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                    {item.audit_id}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-700">{item.section}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{item.parameter}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                    {item.extracted_value}
                  </td>
                  <td className="py-2.5 px-4">
                    <SourceBadge
                      sourceType={item.source_type}
                      page={item.source_page}
                      onViewSource={() => setInspectRecord(item)}
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.confidence === 'HIGH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.confidence === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.confidence}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setInspectRecord(item)}
                      className="px-2 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-medium text-[11px] border border-brand-200 inline-flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Source</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {inspectRecord && (
        <ViewSourceModal
          isOpen={Boolean(inspectRecord)}
          onClose={() => setInspectRecord(null)}
          title={inspectRecord.parameter}
          fieldData={{
            display: inspectRecord.extracted_value,
            value: inspectRecord.extracted_value,
            source_type: inspectRecord.source_type,
            source_page: inspectRecord.source_page,
            source_section: inspectRecord.section,
            source_text: inspectRecord.source_text_snippet,
            confidence: inspectRecord.confidence,
            method: inspectRecord.extraction_method,
          }}
        />
      )}
    </div>
  );
};
