"""Task status rules. Every status change in the application goes through `transition`.

Planned task:    DRAFT -> IN_PROGRESS -> COMPLETED            (IN_PROGRESS <-> BLOCKED)
Unplanned task:  DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_PROGRESS -> COMPLETED
                                           -> REJECTED -> DRAFT (edit) / PENDING_APPROVAL (resubmit)
Approval never starts work: APPROVED only means the task may be started.
"""
from datetime import date
from typing import Dict, Optional, Set

DRAFT, PENDING, APPROVED, REJECTED = "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"
IN_PROGRESS, BLOCKED, COMPLETED = "IN_PROGRESS", "BLOCKED", "COMPLETED"
ALL_STATUSES = [DRAFT, PENDING, APPROVED, REJECTED, IN_PROGRESS, BLOCKED, COMPLETED]

# action -> (allowed from-statuses, to-status, who may do it, applies to)
#   who: "worker" = site team (engineer / site manager / PM / admin), "approver" = PM or admin
#   applies: "any", "planned", "unplanned"
ACTIONS: Dict[str, dict] = {
    "submit":   {"from": {DRAFT, REJECTED}, "to": PENDING, "who": "worker", "applies": "unplanned"},
    "approve":  {"from": {PENDING}, "to": APPROVED, "who": "approver", "applies": "unplanned"},
    "reject":   {"from": {PENDING}, "to": REJECTED, "who": "approver", "applies": "unplanned"},
    "start":    {"from": {DRAFT, APPROVED}, "to": IN_PROGRESS, "who": "worker", "applies": "any"},
    "block":    {"from": {IN_PROGRESS}, "to": BLOCKED, "who": "worker", "applies": "any"},
    "unblock":  {"from": {BLOCKED}, "to": IN_PROGRESS, "who": "worker", "applies": "any"},
    "complete": {"from": {IN_PROGRESS}, "to": COMPLETED, "who": "worker", "applies": "any"},
}
EDITABLE = {DRAFT, REJECTED}
# Statuses whose work counts towards the planned activity's progress
COUNTED_FOR_PROGRESS = {APPROVED, IN_PROGRESS, BLOCKED, COMPLETED}

WORKER_ROLES = {"Site Engineer", "Engineer", "Site Manager", "Project Manager", "Admin"}
APPROVER_ROLES = {"Project Manager", "Admin"}


class WorkflowError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.status_code = status_code


def allowed_actions(task) -> Set[str]:
    """Actions that make sense for the task in its current status (permissions are checked separately)."""
    out = set()
    for name, rule in ACTIONS.items():
        if task.status not in rule["from"]:
            continue
        if rule["applies"] == "planned" and task.is_unplanned:
            continue
        if rule["applies"] == "unplanned" and not task.is_unplanned:
            continue
        # an unplanned task must be approved before it can start
        if name == "start" and task.is_unplanned and task.status != APPROVED:
            continue
        out.add(name)
    return out


def check_role(action: str, user_role: str) -> None:
    allowed = APPROVER_ROLES if ACTIONS[action]["who"] == "approver" else WORKER_ROLES
    if user_role not in allowed:
        raise WorkflowError(f"Role {user_role} cannot {action} a task", 403)


def transition(task, action: str, user_role: str, today: Optional[date] = None,
               on_date: Optional[date] = None, reason: Optional[str] = None) -> str:
    """Apply an action to the task object in memory. Returns the previous status. Raises WorkflowError."""
    if action not in ACTIONS:
        raise WorkflowError(f"Unknown action {action}", 400)
    check_role(action, user_role)
    today = today or date.today()
    if action not in allowed_actions(task):
        if task.status == COMPLETED:
            raise WorkflowError("A completed task cannot be changed", 409)
        hint = ""
        if action == "start" and task.is_unplanned and task.status != APPROVED:
            hint = " (an unplanned task must be approved by the PM first)"
        raise WorkflowError(f"Cannot {action} a task that is {task.status}{hint}", 409)

    previous = task.status
    rule = ACTIONS[action]
    if action == "submit":
        if not (task.unplanned_reason or "").strip():
            raise WorkflowError("An unplanned task needs a reason before it is submitted", 422)
    elif action == "reject":
        if not (reason or "").strip():
            raise WorkflowError("A rejection needs a reason", 422)
        task.rejection_reason = reason.strip()
    elif action == "start":
        when = on_date or today
        if when > today:
            raise WorkflowError("The actual start date cannot be in the future", 422)
        task.actual_start_date = when
    elif action == "complete":
        when = on_date or today
        if when > today:
            raise WorkflowError("The actual finish date cannot be in the future", 422)
        if task.actual_start_date and when < task.actual_start_date:
            raise WorkflowError("The actual finish date is before the actual start date", 422)
        task.actual_end_date = when
        task.progress_percent = 100.0
    elif action == "block":
        task.blocked_note = (reason or "").strip() or None
    elif action == "unblock":
        task.blocked_note = None

    if action in ("approve", "reject"):
        from datetime import datetime
        task.decided_at = datetime.utcnow()
    if action == "approve":
        task.rejection_reason = None
    task.status = rule["to"]
    return previous


def set_progress(task, percent: float) -> None:
    if task.status != IN_PROGRESS:
        raise WorkflowError(f"Progress can only be updated while the task is IN_PROGRESS (it is {task.status})", 409)
    if not 0 <= percent <= 100:
        raise WorkflowError("Progress must be between 0 and 100", 422)
    if percent < (task.progress_percent or 0):
        raise WorkflowError("Progress cannot go down; ask the PM if a correction is needed", 422)
    if percent >= 100:
        raise WorkflowError("Use the complete action to finish a task (it records the finish date)", 422)
    task.progress_percent = float(percent)
