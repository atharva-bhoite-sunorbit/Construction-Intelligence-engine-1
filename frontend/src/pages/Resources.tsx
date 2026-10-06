import React, { useState, useEffect } from 'react';
import { Users, Package, Wrench, AlertTriangle, CheckCircle2, TrendingUp, Plus } from 'lucide-react';
import { ResourceSummary, ResourceItem, Project } from '../types';
import { apiClient } from '../api/client';
import { KPICard } from '../components/KPICard';

interface ResourcesPageProps {
  project: Project;
}

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ project }) => {
  const [data, setData] = useState<ResourceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'Labour' | 'Materials' | 'Equipment'>('Labour');

  const fetchResources = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getResources(project.id);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [project.id]);

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <Users className="w-5 h-5 animate-pulse text-brand-400" />
        <span>Loading resource allocations and capacity metrics...</span>
      </div>
    );
  }

  const totals = data.totals;
  const currentList = data.resources[activeCategory] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide">RESOURCE MANAGEMENT & ALLOCATION</h1>
          <p className="text-xs text-slate-500">
            Real-time capacity tracking, trade labour shortages, material forecast buffers, and heavy plant equipment
          </p>
        </div>
      </div>

      {/* Top 3 Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveCategory('Labour')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeCategory === 'Labour'
              ? 'bg-white border-brand-500 shadow-xs border border-slate-200 ring-1 ring-brand-500/50'
              : 'bg-white border-slate-200 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Site Labour</span>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white mb-2">
            {totals.Labour.available} <span className="text-xs font-normal text-slate-500">workers available</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
            <div>
              Required: <span className="text-white font-semibold">{totals.Labour.required}</span>
            </div>
            <div>
              Shortage:{' '}
              <span className={`font-semibold ${totals.Labour.shortage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totals.Labour.shortage}
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveCategory('Materials')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeCategory === 'Materials'
              ? 'bg-white border-brand-500 shadow-xs border border-slate-200 ring-1 ring-brand-500/50'
              : 'bg-white border-slate-200 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Primary Materials</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white mb-2">
            {totals.Materials.available.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">stock buffer</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
            <div>
              Required: <span className="text-white font-semibold">{totals.Materials.required.toLocaleString()}</span>
            </div>
            <div>
              Shortage:{' '}
              <span className={`font-semibold ${totals.Materials.shortage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totals.Materials.shortage.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveCategory('Equipment')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeCategory === 'Equipment'
              ? 'bg-white border-brand-500 shadow-xs border border-slate-200 ring-1 ring-brand-500/50'
              : 'bg-white border-slate-200 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Heavy Plant & Equipment</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white mb-2">
            {totals.Equipment.available} <span className="text-xs font-normal text-slate-500">units mobilized</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
            <div>
              Required: <span className="text-white font-semibold">{totals.Equipment.required}</span>
            </div>
            <div>
              Shortage:{' '}
              <span className={`font-semibold ${totals.Equipment.shortage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totals.Equipment.shortage}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {activeCategory === 'Labour' ? (
              <Users className="w-5 h-5 text-brand-400" />
            ) : activeCategory === 'Materials' ? (
              <Package className="w-5 h-5 text-amber-400" />
            ) : (
              <Wrench className="w-5 h-5 text-emerald-400" />
            )}
            <h3 className="font-bold text-slate-900 text-sm">{activeCategory} Resource Utilization Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">{currentList.length} Items Configured</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Resource Name</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3">Available Capacity</th>
                <th className="py-3 px-3">Planned Required</th>
                <th className="py-3 px-3">Allocated</th>
                <th className="py-3 px-3">Shortage</th>
                <th className="py-3 px-4">Utilization %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {currentList.map((r) => {
                const hasShortage = r.shortage > 0;
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900">{r.type_name}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{r.unit}</td>
                    <td className="py-3 px-3 font-mono text-slate-800">{r.available_capacity.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-800">{r.total_required.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-brand-400">{r.total_allocated.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {hasShortage ? (
                        <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                          -{r.shortage.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-normal">Sufficient</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-slate-50 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${r.utilization_percent}%` }}
                            className={`h-full ${
                              r.utilization_percent > 90
                                ? 'bg-amber-500'
                                : r.utilization_percent > 70
                                ? 'bg-brand-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-700">{r.utilization_percent}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
