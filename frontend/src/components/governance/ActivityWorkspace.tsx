import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Search, Check, X, RotateCcw, CheckCheck, Award } from 'lucide-react';
import { PMValidationCtx } from './usePMValidationState';

export const ActivityWorkspace: React.FC<{ ctx: PMValidationCtx }> = ({ ctx }) => {
  const { activeRole, adminSubTab, pmSubTab, groupBy, setGroupBy, statusFilter, setStatusFilter, searchQuery, setSearchQuery, showOtherRolesInReadOnly, setShowOtherRolesInReadOnly, selectedActivityIds, loadingActivityId, isBulkLoading, setRejectingActivity, sections, toggleSection, isSectionExpanded, handleValidateYes, handleResetActivity, handleBulkValidate, toggleSelectActivity, selectAllInView, clearSelection } = ctx;
  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Filters, Grouping, Bulk Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeRole} activities...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none"
            >
              <option value="phase">By Phase</option>
              <option value="work_package">By Work Package</option>
              <option value="floor">By Floor</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="AWAITING_PM_VERIFICATION">Awaiting PM Verification</option>
              <option value="RECORDED">Officially Recorded</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {activeRole !== 'Top Management' && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showOtherRolesInReadOnly}
                onChange={(e) => setShowOtherRolesInReadOnly(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Show all project roles (read-only)</span>
            </label>
          )}
        </div>

        {/* Bulk Actions for Authorized Roles */}
        {activeRole !== 'Top Management' && (
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            {selectedActivityIds.length > 0 ? (
              <>
                <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                  {selectedActivityIds.length} Selected
                </span>
                <button
                  onClick={() => handleBulkValidate('APPROVED')}
                  disabled={isBulkLoading}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{activeRole === 'Project Manager' ? 'Bulk Verify & Record' : 'Bulk Validate YES'}</span>
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px]"
                >
                  Clear
                </button>
              </>
            ) : (
              <button
                onClick={selectAllInView}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
              >
                Select All in View
              </button>
            )}
          </div>
        )}
      </div>

      {/* Activity Sections */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
            <h4 className="font-bold text-sm text-slate-700">No Activities Found</h4>
            <p className="text-xs max-w-md mx-auto">
              No activities matching the current filter in this role's workspace.
            </p>
          </div>
        ) : (
          sections.map((sec) => {
            const expanded = isSectionExpanded(sec.sectionName);
            return (
              <div
                key={sec.sectionName}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Section Header */}
                <div
                  onClick={() => toggleSection(sec.sectionName)}
                  className="p-4 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs tracking-tight flex items-center gap-2">
                        <span>{sec.sectionName}</span>
                        <span className="text-[10px] font-normal text-slate-500 font-mono">
                          ({sec.totalCount} items)
                        </span>
                      </h4>
                    </div>
                  </div>

                  {/* Section mini badges */}
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    {sec.recordedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {sec.recordedCount} Recorded
                      </span>
                    )}
                    {sec.awaitingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {sec.awaitingCount} Awaiting Verification
                      </span>
                    )}
                    {sec.pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {sec.pendingCount} Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Section Activity Items */}
                {expanded && (
                  <div className="divide-y divide-slate-100">
                    {sec.activities.map((act) => {
                      const isSelected = selectedActivityIds.includes(act.id);
                      const isGeotechTask =
                        act.assigned_role === 'Site Engineer' ||
                        act.work_package === 'Geotechnical & Excavation' ||
                        (act.code && act.code.toUpperCase().startsWith('GX-')) ||
                        (act.category && act.category.toLowerCase().includes('excavation')) ||
                        (act.name && (
                          act.name.toLowerCase().includes('geotech') ||
                          act.name.toLowerCase().includes('soil') ||
                          act.name.toLowerCase().includes('borehole') ||
                          act.name.toLowerCase().includes('excavation')
                        ));

                      const isOwnRole =
                        (isGeotechTask
                          ? activeRole === 'Site Engineer'
                          : (act.assigned_role || 'Site Manager') === activeRole) ||
                        (activeRole === 'Project Manager' && pmSubTab === 'queue' && !isGeotechTask) ||
                        (activeRole === 'Admin' && adminSubTab === 'geotech_queue' && isGeotechTask);

                      const canValidate =
                        activeRole !== 'Top Management' &&
                        (
                          (activeRole === 'Site Engineer' && isGeotechTask && act.stage1_status !== 'APPROVED' && !act.final_recorded) ||
                          (activeRole === 'Site Manager' && !isGeotechTask && act.assigned_role === 'Site Manager' && act.stage1_status !== 'APPROVED' && !act.final_recorded) ||
                          (activeRole === 'Admin' && (
                            (adminSubTab === 'geotech_queue' && isGeotechTask && act.stage1_status === 'APPROVED' && !act.final_recorded) ||
                            (adminSubTab === 'statutory' && !isGeotechTask && act.assigned_role === 'Admin' && act.stage1_status !== 'APPROVED' && !act.final_recorded)
                          )) ||
                          (activeRole === 'Project Manager' && (
                            (pmSubTab === 'queue' && !isGeotechTask && act.stage1_status === 'APPROVED' && !act.final_recorded) ||
                            (act.assigned_role === 'Project Manager' && !act.final_recorded)
                          ))
                        );

                      return (
                        <div
                          key={act.id}
                          className={`p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                            isSelected
                              ? 'bg-brand-50/40'
                              : act.final_recorded
                              ? 'bg-emerald-50/15 hover:bg-emerald-50/30'
                              : act.stage1_status === 'APPROVED'
                              ? isGeotechTask
                                ? 'bg-teal-50/20 hover:bg-teal-50/40'
                                : 'bg-amber-50/20 hover:bg-amber-50/40'
                              : act.validation_status === 'REJECTED'
                              ? 'bg-rose-50/20 hover:bg-rose-50/40'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Left details */}
                          <div className="flex items-start gap-3">
                            {canValidate && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectActivity(act.id)}
                                className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                              />
                            )}

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {act.code || `ACT-${act.id}`}
                                </span>
                                <h5 className="font-bold text-slate-900 text-xs">
                                  {act.name}
                                </h5>
                                {act.is_critical && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                    CRITICAL PATH
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                    isGeotechTask || act.assigned_role === 'Site Engineer'
                                      ? 'bg-teal-50 text-teal-800 border-teal-300'
                                      : act.assigned_role === 'Site Manager'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : act.assigned_role === 'Admin'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-slate-50 text-slate-800 border-slate-300'
                                  }`}
                                >
                                  Owner: {isGeotechTask || act.assigned_role === 'Site Engineer' ? 'Site Engineer' : act.assigned_role || 'Site Manager'}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span>
                                  Location:{' '}
                                  <strong className="text-slate-700 font-semibold">
                                    {act.tower || 'Tower A'} • Floor {act.floor}
                                  </strong>
                                </span>
                                <span>
                                  Work Package:{' '}
                                  <strong className="text-slate-700 font-semibold">
                                    {act.work_package || 'General'}
                                  </strong>
                                </span>
                                <span>
                                  Planned Duration:{' '}
                                  <strong className="text-slate-700 font-semibold">
                                    {act.planned_duration} days
                                  </strong>
                                </span>
                                <span>
                                  Labor Muster:{' '}
                                  <strong className="text-slate-700 font-semibold">
                                    {act.required_labour || 5} crew
                                  </strong>
                                </span>
                              </div>

                              {/* Multi-Tier Provenance Trace */}
                              <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                                {act.stage1_status === 'APPROVED' && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-semibold">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    Stage 1 Validated: {act.stage1_validated_by || (isGeotechTask ? 'Liam Chen (Site Engineer)' : 'Authorized Lead')}
                                  </span>
                                )}
                                {act.pm_verification_status === 'VERIFIED' && (
                                  <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200 flex items-center gap-1 font-semibold">
                                    <CheckCheck className="w-3 h-3 text-slate-600" />
                                    Stage 2 Verified: {act.pm_verified_by || (isGeotechTask ? 'Alexander Vance (Admin)' : 'Marcus Brody (PM)')}
                                  </span>
                                )}
                                {act.stage1_notes && (
                                  <span className="text-slate-500 italic max-w-md truncate">
                                    "{act.stage1_notes}"
                                  </span>
                                )}
                                {act.pm_verification_notes && (
                                  <span className="text-slate-700 italic max-w-md truncate">
                                    "{act.pm_verification_notes}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right status & action buttons */}
                          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end lg:self-center">
                            {/* Status Indicator Stamp */}
                            {act.final_recorded ? (
                              <div className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs flex items-center gap-1.5 shadow-xs">
                                <Award className="w-4 h-4 text-emerald-600" />
                                <span>OFFICIALLY RECORDED</span>
                              </div>
                            ) : act.stage1_status === 'APPROVED' ? (
                              isGeotechTask ? (
                                <div className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 border border-teal-300 font-bold text-xs flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                                  <span>Awaiting Admin Verification</span>
                                </div>
                              ) : (
                                <div className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Awaiting PM Verification</span>
                                </div>
                              )
                            ) : act.validation_status === 'REJECTED' ? (
                              <div className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>REJECTED</span>
                              </div>
                            ) : (
                              <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs">
                                Pending Review
                              </div>
                            )}

                            {/* Validation Actions */}
                            {canValidate && (
                              <div className="flex items-center gap-1.5">
                                {/* Action: Site Engineer Validating Geotech/Excavation Task in Stage 1 */}
                                {activeRole === 'Site Engineer' &&
                                  isGeotechTask &&
                                  act.stage1_status !== 'APPROVED' &&
                                  !act.final_recorded && (
                                    <button
                                      onClick={() => handleValidateYes(act)}
                                      disabled={loadingActivityId === act.id}
                                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                      title="Validate & Forward to Admin for Final Verification"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Validate & Send to Admin (YES)</span>
                                    </button>
                                  )}

                                {/* Action: Admin Stage 2 Verification of Geotech Queue */}
                                {activeRole === 'Admin' &&
                                  adminSubTab === 'geotech_queue' &&
                                  isGeotechTask &&
                                  act.stage1_status === 'APPROVED' &&
                                  !act.final_recorded && (
                                    <button
                                      onClick={() => handleValidateYes(act)}
                                      disabled={loadingActivityId === act.id}
                                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                      title="Verify & Countersign: Officially Record in Master Ledger"
                                    >
                                      <CheckCheck className="w-3.5 h-3.5" />
                                      <span>Verify & Record (YES)</span>
                                    </button>
                                  )}

                                {/* Action: Admin Stage 1 Validation of Statutory Tasks */}
                                {activeRole === 'Admin' &&
                                  adminSubTab === 'statutory' &&
                                  !isGeotechTask &&
                                  act.stage1_status !== 'APPROVED' &&
                                  !act.final_recorded && (
                                    <button
                                      onClick={() => handleValidateYes(act)}
                                      disabled={loadingActivityId === act.id}
                                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                      title="Validate YES (Pass to Project Manager)"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Validate (YES)</span>
                                    </button>
                                  )}

                                {/* Action: Project Manager Actions */}
                                {activeRole === 'Project Manager' &&
                                  !act.final_recorded &&
                                  !isGeotechTask &&
                                  (act.stage1_status === 'APPROVED' || act.assigned_role === 'Project Manager') && (
                                    <button
                                      onClick={() => handleValidateYes(act)}
                                      disabled={loadingActivityId === act.id}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                      title={
                                        act.assigned_role === 'Project Manager'
                                          ? 'Approve & Record Direct PM Activity'
                                          : 'Countersign & Officially Record this activity'
                                      }
                                    >
                                      <CheckCheck className="w-3.5 h-3.5" />
                                      <span>
                                        {act.assigned_role === 'Project Manager'
                                          ? 'Validate & Record (YES)'
                                          : 'Verify & Record (YES)'}
                                      </span>
                                    </button>
                                  )}

                                {/* Action: Site Manager Stage 1 Validation */}
                                {activeRole === 'Site Manager' &&
                                  !isGeotechTask &&
                                  act.stage1_status !== 'APPROVED' &&
                                  !act.final_recorded && (
                                    <button
                                      onClick={() => handleValidateYes(act)}
                                      disabled={loadingActivityId === act.id}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                                      title="Validate YES (Pass to Project Manager)"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Validate (YES)</span>
                                    </button>
                                  )}

                                {/* Action: Reject button */}
                                {!act.final_recorded && (
                                  <button
                                    onClick={() => setRejectingActivity(act)}
                                    disabled={loadingActivityId === act.id}
                                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-colors"
                                    title="Reject with notes"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Action: Reset */}
                                {(act.final_recorded || act.stage1_status === 'APPROVED' || act.validation_status === 'REJECTED') && (
                                  <button
                                    onClick={() => handleResetActivity(act)}
                                    disabled={loadingActivityId === act.id}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Reset back to PENDING"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
