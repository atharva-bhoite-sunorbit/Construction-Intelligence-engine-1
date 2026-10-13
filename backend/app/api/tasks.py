from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, Task, TaskCheck, User
from backend.app.services.audit_service import AuditService
from backend.app.services.notifications import APPROVER_ROLES as NOTIFY_APPROVERS, notify, notify_user, project_recipients, short
from backend.app.services.progress_rollup import rollup_activity
from backend.app.services.readiness import clear_later_steps, first_open_before, issue_checks, unmet_mandatory, work_type_for
from backend.app.services.sequence import sequence_index
from backend.app.services.task_workflow import (
    ACTIONS, APPROVER_ROLES, DRAFT, EDITABLE, WORKER_ROLES, WorkflowError, allowed_actions, check_role, set_progress,
    transition,
)
from backend.app.utils.access import allowed_towers, assert_project_access, tower_allowed
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Tasks"])


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    activity_id: Optional[int] = Field(default=None, description="Planned activity this task belongs to (required unless unplanned)")
    is_unplanned: bool = False
    unplanned_reason: Optional[str] = None
    tower: Optional[str] = Field(default=None, max_length=100, description="Required for unplanned tasks; planned tasks use their activity's tower")
    planned_days: int = Field(default=1, ge=1, le=365)
    assigned_to: Optional[str] = Field(default=None, max_length=255)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    unplanned_reason: Optional[str] = None
    planned_days: Optional[int] = Field(default=None, ge=1, le=365)
    assigned_to: Optional[str] = Field(default=None, max_length=255)


class TaskAction(BaseModel):
    on_date: Optional[date] = Field(default=None, description="Actual start/finish date (defaults to today, never in the future)")
    reason: Optional[str] = Field(default=None, description="Needed to reject; optional note when blocking")


class ProgressUpdate(BaseModel):
    percent: float = Field(ge=0, le=100)


class TaskResponse(BaseModel):
    id: int
    project_id: int
    activity_id: Optional[int]
    activity_code: Optional[str]
    activity_name: Optional[str]
    tower: str
    title: str
    description: Optional[str]
    is_unplanned: bool
    unplanned_reason: Optional[str]
    status: str
    planned_days: int
    progress_percent: float
    assigned_to: Optional[str]
    actual_start_date: Optional[date]
    actual_end_date: Optional[date]
    created_by_user_id: Optional[int]
    decided_by_user_id: Optional[int]
    decided_at: Optional[datetime]
    rejection_reason: Optional[str]
    blocked_note: Optional[str]
    created_at: Optional[datetime]
    allowed_actions: List[str]
    activity_progress_percent: Optional[float] = None
    work_type: Optional[str] = None
    checks_total: int = 0
    checks_done: int = 0
    unmet_checks: List[str] = []   # mandatory checks still open: the task cannot start until this is empty
    sequence_step: Optional[int] = None  # position of its activity in the planned order
    waiting_on: List[str] = []           # earlier activities in the plan that are not done yet (guidance, not a lock)


class CheckResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    mandatory: bool
    passed: bool
    waived: bool
    waiver_reason: Optional[str]
    note: Optional[str]
    checked_by_user_id: Optional[int]
    checked_at: Optional[datetime]
    step: int = 0                       # 1-based position in the checklist
    locked: bool = False                # an earlier mandatory step is still open
    locked_by: Optional[str] = None     # that earlier step


class CheckUpdate(BaseModel):
    passed: bool
    note: Optional[str] = None


class CheckWaive(BaseModel):
    reason: str = Field(min_length=3)


def _to_response(task: Task, activity: Optional[Activity] = None, db: Optional[Session] = None, seq: Optional[dict] = None) -> TaskResponse:
    activity = activity or task.activity
    if seq is None and task.activity_id and (db or Session.object_session(task)) is not None:
        seq = sequence_index((db or Session.object_session(task)), task.project_id)
    info = (seq or {}).get(task.activity_id) if task.activity_id else None
    data = {c.name: getattr(task, c.name) for c in Task.__table__.columns}
    checks = _checks_for(task, db)
    return TaskResponse(
        **data,
        work_type=work_type_for(activity) if activity else None,
        checks_total=len(checks),
        checks_done=sum(1 for c in checks if c.passed or c.waived),
        unmet_checks=[c.name for c in checks if c.mandatory and not (c.passed or c.waived)],
        sequence_step=info["step"] if info else None,
        waiting_on=info["waiting_on"] if info and task.status in ("DRAFT", "APPROVED") else [],
        activity_code=activity.code if activity else None,
        activity_name=activity.name if activity else None,
        activity_progress_percent=activity.progress_percent if activity else None,
        allowed_actions=sorted(allowed_actions(task)),
    )


def _checks_for(task: Task, db: Optional[Session]) -> List[TaskCheck]:
    if db is None:
        db = Session.object_session(task)
    if db is None or task.id is None:
        return []
    return db.query(TaskCheck).filter(TaskCheck.task_id == task.id).order_by(TaskCheck.sort_order, TaskCheck.id).all()


def _load(db: Session, task_id: int) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


def _require_worker(user: User) -> None:
    if user.role not in WORKER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Role {user.role} cannot create or change tasks")


def _audit(db, user, task, action, old=None, new=None):
    AuditService.log_action(db, action=f"TASK_{action.upper()}", entity_name="Task", entity_id=str(task.id),
                            old_values=old, new_values=new, user_id=user.id)


@router.post("/api/projects/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(project_id: int, body: TaskCreate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    _require_worker(current_user)
    towers = allowed_towers(db, current_user, project_id)
    activity = None
    if body.is_unplanned:
        if body.activity_id is not None:
            raise HTTPException(422, "An unplanned task is not linked to a planned activity")
        if not (body.unplanned_reason or "").strip():
            raise HTTPException(422, "An unplanned task needs a reason")
        if not (body.tower or "").strip():
            raise HTTPException(422, "An unplanned task needs a tower")
        tower = body.tower.strip()
    else:
        if body.activity_id is None:
            raise HTTPException(422, "A planned task must be linked to a planned activity (or mark it unplanned with a reason)")
        activity = db.query(Activity).filter(Activity.id == body.activity_id, Activity.project_id == project_id).first()
        if not activity:
            raise HTTPException(404, "Activity not found in this project")
        tower = activity.tower
    if not tower_allowed(towers, tower):
        raise HTTPException(403, f"Your access does not include {tower}")

    task = Task(
        project_id=project_id, activity_id=activity.id if activity else None, tower=tower, title=body.title.strip(),
        description=body.description, is_unplanned=body.is_unplanned,
        unplanned_reason=(body.unplanned_reason or "").strip() or None, planned_days=body.planned_days,
        assigned_to=body.assigned_to, created_by_user_id=current_user.id,
    )
    db.add(task)
    db.flush()
    if activity is not None:
        issue_checks(db, task, activity)
    db.commit()
    db.refresh(task)
    _audit(db, current_user, task, "create", new={"title": task.title, "activity_id": task.activity_id,
                                                  "is_unplanned": task.is_unplanned, "tower": task.tower})
    return _to_response(task, activity, db)


@router.get("/api/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_tasks(project_id: int, status_filter: Optional[str] = Query(None, alias="status"),
               activity_id: Optional[int] = Query(None), tower: Optional[str] = Query(None),
               unplanned: Optional[bool] = Query(None), db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    towers = allowed_towers(db, current_user, project_id)
    query = db.query(Task).filter(Task.project_id == project_id)
    if towers is not None:
        query = query.filter(Task.tower.in_(towers | {"Common", "All"}))
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if activity_id is not None:
        query = query.filter(Task.activity_id == activity_id)
    if tower:
        query = query.filter(Task.tower == tower)
    if unplanned is not None:
        query = query.filter(Task.is_unplanned == unplanned)
    seq = sequence_index(db, project_id)
    rows = [_to_response(t, db=db, seq=seq) for t in query.all()]
    # Plan order first (unplanned work, which has no step, goes last), newest first within the same step
    rows.sort(key=lambda r: (r.sequence_step is None, r.sequence_step or 0, -r.id))
    return rows


@router.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _to_response(_load(db, task_id), db=db)


@router.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    _require_worker(current_user)
    task = _load(db, task_id)
    if task.status not in EDITABLE:
        raise HTTPException(409, f"A task that is {task.status} can no longer be edited")
    changes = body.model_dump(exclude_unset=True)
    if "unplanned_reason" in changes and not task.is_unplanned:
        raise HTTPException(422, "Only unplanned tasks have a reason")
    if task.is_unplanned and "unplanned_reason" in changes and not (changes["unplanned_reason"] or "").strip():
        raise HTTPException(422, "An unplanned task needs a reason")
    old = {k: getattr(task, k) for k in changes}
    for key, value in changes.items():
        setattr(task, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(task)
    _audit(db, current_user, task, "update", old=old, new=changes)
    return _to_response(task, db=db)


def _finish(db: Session, user: User, task: Task, action: str, old_status: str) -> TaskResponse:
    activity = rollup_activity(db, task.activity_id)
    db.commit()
    db.refresh(task)
    _audit(db, user, task, action, old={"status": old_status}, new={"status": task.status,
                                                                      "progress_percent": task.progress_percent})
    return _to_response(task, activity, db)


def _notify_task_event(db: Session, actor: User, task: Task, action: str, reason: Optional[str]) -> None:
    if action == "submit":
        notify(db, project_recipients(db, task.project_id, NOTIFY_APPROVERS, exclude_user_id=actor.id), project_id=task.project_id,
               kind="APPROVAL_NEEDED", title=f"Approval needed: {task.title}", body=short(task.unplanned_reason),
               entity_type="task", entity_id=task.id)
    elif action == "approve":
        notify_user(db, task.created_by_user_id, actor.id, project_id=task.project_id, kind="TASK_APPROVED",
                    title=f"Approved: {task.title}", body="You can start this work now.", entity_type="task", entity_id=task.id)
    elif action == "reject":
        notify_user(db, task.created_by_user_id, actor.id, project_id=task.project_id, kind="TASK_REJECTED",
                    title=f"Sent back: {task.title}", body=short(reason), entity_type="task", entity_id=task.id)


@router.post("/api/tasks/{task_id}/progress", response_model=TaskResponse)
def update_progress(task_id: int, body: ProgressUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    _require_worker(current_user)
    task = _load(db, task_id)
    old = task.progress_percent
    try:
        set_progress(task, body.percent)
    except WorkflowError as exc:
        raise HTTPException(exc.status_code, str(exc))
    activity = rollup_activity(db, task.activity_id)
    db.commit()
    db.refresh(task)
    _audit(db, current_user, task, "progress", old={"progress_percent": old}, new={"progress_percent": task.progress_percent})
    return _to_response(task, activity, db)


@router.get("/api/tasks/{task_id}/checks", response_model=List[CheckResponse])
def list_checks(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = _load(db, task_id)
    ordered = _checks_for(task, db)
    out = []
    for step, ch in enumerate(ordered, start=1):
        blocker = None if (ch.passed or ch.waived) else first_open_before(ordered, ch)
        out.append(CheckResponse(**{c.name: getattr(ch, c.name) for c in TaskCheck.__table__.columns if c.name in CheckResponse.model_fields},
                                 step=step, locked=blocker is not None, locked_by=blocker.name if blocker else None))
    return out


def _load_check(db: Session, task: Task, check_id: int) -> TaskCheck:
    check = db.query(TaskCheck).filter(TaskCheck.id == check_id, TaskCheck.task_id == task.id).first()
    if not check:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Check not found on this task")
    return check


@router.post("/api/tasks/{task_id}/checks/{check_id}", response_model=TaskResponse)
def set_check(task_id: int, check_id: int, body: CheckUpdate, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    """Mark a readiness check done (or not done). Only before the task has started."""
    _require_worker(current_user)
    task = _load(db, task_id)
    if task.status != DRAFT:
        raise HTTPException(409, f"Checks are locked once a task is past DRAFT (it is {task.status})")
    check = _load_check(db, task, check_id)
    ordered = _checks_for(task, db)
    cleared: List[str] = []
    if body.passed and not check.passed:
        earlier = first_open_before(ordered, check)
        if earlier is not None:
            raise HTTPException(409, f"Do the steps in order: '{earlier.name}' comes first")
    if not body.passed and check.passed:
        cleared = clear_later_steps(ordered, check)   # going back a step means redoing the steps after it
    check.passed = body.passed
    check.note = (body.note or "").strip() or None
    check.checked_by_user_id = current_user.id if body.passed else None
    check.checked_at = datetime.utcnow() if body.passed else None
    db.commit()
    _audit(db, current_user, task, "check", new={"check": check.name, "passed": body.passed, "cleared_later": cleared})
    return _to_response(task, db=db)


@router.post("/api/tasks/{task_id}/checks/{check_id}/waive", response_model=TaskResponse)
def waive_check(task_id: int, check_id: int, body: CheckWaive, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """PM exception: let this one task start without a mandatory check. Needs a reason and is audited."""
    if current_user.role not in APPROVER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a Project Manager or Admin can waive a readiness check")
    task = _load(db, task_id)
    if task.status != DRAFT:
        raise HTTPException(409, f"Checks are locked once a task is past DRAFT (it is {task.status})")
    check = _load_check(db, task, check_id)
    earlier = first_open_before(_checks_for(task, db), check)
    if earlier is not None:
        raise HTTPException(409, f"Do the steps in order: '{earlier.name}' comes first")
    check.waived = True
    check.waived_by_user_id = current_user.id
    check.waiver_reason = body.reason.strip()
    db.commit()
    _audit(db, current_user, task, "check_waive", new={"check": check.name, "reason": check.waiver_reason})
    return _to_response(task, db=db)


@router.post("/api/tasks/{task_id}/{action}", response_model=TaskResponse)
def task_action(task_id: int, action: str, body: Optional[TaskAction] = None, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """submit / approve / reject / start / block / unblock / complete. Approval never starts the work."""
    if action not in ACTIONS:
        raise HTTPException(404, f"Unknown action {action}. Use one of: {', '.join(sorted(ACTIONS))}")
    task = _load(db, task_id)
    body = body or TaskAction()
    try:
        check_role(action, current_user.role)
        if action == "start" and not task.is_unplanned and task.status in EDITABLE | {DRAFT}:
            open_checks = unmet_mandatory(db, task.id)
            if open_checks:
                raise WorkflowError("Complete the mandatory readiness checks before starting: " + "; ".join(open_checks), 409)
        previous = transition(task, action, current_user.role, on_date=body.on_date, reason=body.reason)
    except WorkflowError as exc:
        db.rollback()
        raise HTTPException(exc.status_code, str(exc))
    if action in ("approve", "reject"):
        task.decided_by_user_id = current_user.id
    _notify_task_event(db, current_user, task, action, body.reason)
    return _finish(db, current_user, task, action, previous)
