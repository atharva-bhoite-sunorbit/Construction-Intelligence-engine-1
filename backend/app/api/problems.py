from datetime import date, datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, Blocker, Task, User
from backend.app.services.audit_service import AuditService
from backend.app.services.notifications import APPROVER_ROLES as NOTIFY_APPROVERS, DIRECTOR_ROLES, notify, notify_user, project_recipients, short
from backend.app.services.problems import (
    CATEGORIES, SEVERITIES, delay_summary, estimate_changed_since_confirmed, needs_review, refresh_proposal,
)
from backend.app.services.task_workflow import APPROVER_ROLES, IN_PROGRESS, WORKER_ROLES, BLOCKED, WorkflowError, transition
from backend.app.utils.access import allowed_towers, assert_project_access, tower_allowed
from backend.app.utils.security import get_current_user

router = APIRouter(tags=["Problems"])


class ProblemCreate(BaseModel):
    task_id: Optional[int] = Field(default=None, description="The running task this problem is holding up")
    activity_id: Optional[int] = None
    category: str
    description: str = Field(min_length=3, max_length=2000)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    owner: Optional[str] = Field(default=None, max_length=255, description="Who is responsible for fixing it")
    expected_resolution: Optional[date] = None


class ProblemResolve(BaseModel):
    note: Optional[str] = None
    on_date: Optional[date] = Field(default=None, description="Date it was fixed (defaults to today, never in the future)")


class ImpactDecision(BaseModel):
    decision: Literal["CONFIRM", "NO_IMPACT"]
    days: Optional[float] = Field(default=None, ge=0, le=3650, description="Working days the activity is held up (defaults to the system estimate)")
    project_days: Optional[float] = Field(default=None, ge=0, le=3650, description="Days the project end slips (defaults to the system estimate)")
    note: Optional[str] = None


class ProblemResponse(BaseModel):
    id: int
    project_id: int
    task_id: Optional[int]
    task_title: Optional[str]
    activity_id: Optional[int]
    activity_name: Optional[str]
    tower: Optional[str]
    category: str
    description: str
    severity: str
    owner: Optional[str]
    opened_date: date
    expected_resolution: Optional[date]
    resolved_date: Optional[date]
    status: str
    days_open: int
    resolution_note: Optional[str]
    reported_by_name: Optional[str]
    impact_status: str
    needs_review: bool
    proposed_delay_days: Optional[float]
    proposed_project_delay_days: Optional[float]
    proposed_on_critical_path: Optional[bool]
    proposal_note: Optional[str]
    confirmed_delay_days: Optional[float]
    confirmed_project_delay_days: Optional[float]
    impact_note: Optional[str]
    impact_decided_by_name: Optional[str]
    impact_decided_at: Optional[datetime]
    estimate_changed: bool


def _name(db: Session, user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user.full_name.replace(" (" + user.role + ")", "") if user else None


def _to_response(db: Session, b: Blocker) -> ProblemResponse:
    activity = db.query(Activity).filter(Activity.id == b.activity_id).first() if b.activity_id else None
    task = db.query(Task).filter(Task.id == b.task_id).first() if b.task_id else None
    end = b.resolved_date or date.today()
    return ProblemResponse(
        id=b.id, project_id=b.project_id, task_id=b.task_id, task_title=task.title if task else None,
        activity_id=b.activity_id, activity_name=activity.name if activity else None,
        tower=activity.tower if activity else (task.tower if task else None),
        category=b.category, description=b.description, severity=b.severity, owner=b.owner,
        opened_date=b.opened_date, expected_resolution=b.expected_resolution, resolved_date=b.resolved_date,
        status=b.status, days_open=max((end - b.opened_date).days, 0), resolution_note=b.resolution_note,
        reported_by_name=_name(db, b.reported_by_user_id), impact_status=b.impact_status,
        needs_review=needs_review(b), proposed_delay_days=b.proposed_delay_days,
        proposed_project_delay_days=b.proposed_project_delay_days, proposed_on_critical_path=b.proposed_on_critical_path,
        proposal_note=b.proposal_note, confirmed_delay_days=b.confirmed_delay_days,
        confirmed_project_delay_days=b.confirmed_project_delay_days, impact_note=b.impact_note,
        impact_decided_by_name=_name(db, b.impact_decided_by_user_id), impact_decided_at=b.impact_decided_at,
        estimate_changed=estimate_changed_since_confirmed(b),
    )


def _load(db: Session, problem_id: int) -> Blocker:
    b = db.query(Blocker).filter(Blocker.id == problem_id).first()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found")
    return b


def _require_worker(user: User) -> None:
    if user.role not in WORKER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Role {user.role} cannot report or resolve problems")


@router.get("/api/problem-categories", response_model=List[str])
def problem_categories(current_user: User = Depends(get_current_user)):
    return CATEGORIES


@router.post("/api/projects/{project_id}/problems", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED)
def report_problem(project_id: int, body: ProblemCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    _require_worker(current_user)
    if body.category not in CATEGORIES:
        raise HTTPException(422, f"Category must be one of: {', '.join(CATEGORIES)}")
    if body.severity not in SEVERITIES:
        raise HTTPException(422, "Unknown severity")
    towers = allowed_towers(db, current_user, project_id)

    task = None
    activity_id = body.activity_id
    if body.task_id is not None:
        task = db.query(Task).filter(Task.id == body.task_id, Task.project_id == project_id).first()
        if not task:
            raise HTTPException(404, "Task not found in this project")
        if not tower_allowed(towers, task.tower):
            raise HTTPException(403, f"Your access does not include {task.tower}")
        if task.status != IN_PROGRESS:
            raise HTTPException(409, f"Only a running task can be held up by a problem (this one is {task.status})")
        activity_id = task.activity_id
    if activity_id is not None:
        activity = db.query(Activity).filter(Activity.id == activity_id, Activity.project_id == project_id).first()
        if not activity:
            raise HTTPException(404, "Activity not found in this project")
        if not tower_allowed(towers, activity.tower):
            raise HTTPException(403, f"Your access does not include {activity.tower}")
    elif task is None and current_user.role not in APPROVER_ROLES:
        raise HTTPException(422, "Say which task or activity the problem is holding up")

    blocker = Blocker(
        project_id=project_id, activity_id=activity_id, task_id=task.id if task else None, category=body.category,
        description=body.description.strip(), severity=body.severity, owner=(body.owner or "").strip() or None,
        opened_date=date.today(), expected_resolution=body.expected_resolution, status="OPEN",
        hindrance_state="ACTIVE_HINDRANCE", reported_by_user_id=current_user.id, impact_status="NOT_ASSESSED",
    )
    db.add(blocker)
    db.flush()
    if task is not None:
        try:
            transition(task, "block", current_user.role, reason=f"{body.category}: {body.description.strip()}"[:500])
        except WorkflowError as exc:
            db.rollback()
            raise HTTPException(exc.status_code, str(exc))
    refresh_proposal(db, blocker)
    where = (activity.name if activity_id is not None else "the whole project")
    notify(db, project_recipients(db, project_id, NOTIFY_APPROVERS, exclude_user_id=current_user.id), project_id=project_id,
           kind="PROBLEM_REPORTED", title=f"Problem to review: {blocker.category}",
           body=f"{short(blocker.description, 110)} ({where})", entity_type="problem", entity_id=blocker.id)
    db.commit()
    db.refresh(blocker)
    AuditService.log_action(db, action="PROBLEM_REPORT", entity_name="Blocker", entity_id=str(blocker.id),
                            new_values={"category": blocker.category, "severity": blocker.severity,
                                        "activity_id": activity_id, "task_id": blocker.task_id},
                            user_id=current_user.id)
    return _to_response(db, blocker)


@router.get("/api/projects/{project_id}/problems", response_model=List[ProblemResponse])
def list_problems(project_id: int, status_filter: Optional[str] = Query(None, alias="status"),
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    towers = allowed_towers(db, current_user, project_id)
    query = db.query(Blocker).filter(Blocker.project_id == project_id)
    if status_filter:
        query = query.filter(Blocker.status == status_filter)
    result = []
    for b in query.order_by(Blocker.status.asc(), Blocker.opened_date.desc(), Blocker.id.desc()).all():
        if towers is not None and b.activity_id is not None:
            act = db.query(Activity).filter(Activity.id == b.activity_id).first()
            if act and not tower_allowed(towers, act.tower):
                continue
        elif towers is not None and b.activity_id is None and b.task_id is None:
            continue  # project-wide problems are for the project team leads
        result.append(_to_response(db, b))
    return result


@router.get("/api/problems/{problem_id}", response_model=ProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _to_response(db, _load(db, problem_id))


@router.post("/api/problems/{problem_id}/resolve", response_model=ProblemResponse)
def resolve_problem(problem_id: int, body: Optional[ProblemResolve] = None, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    _require_worker(current_user)
    body = body or ProblemResolve()
    b = _load(db, problem_id)
    if b.status == "RESOLVED":
        raise HTTPException(409, "This problem is already resolved")
    when = body.on_date or date.today()
    if when > date.today():
        raise HTTPException(422, "The resolution date cannot be in the future")
    if when < b.opened_date:
        raise HTTPException(422, "The resolution date is before the problem was reported")
    b.status = "RESOLVED"
    b.hindrance_state = "RESOLVED"
    b.resolved_date = when
    b.resolution_note = (body.note or "").strip() or None
    task = db.query(Task).filter(Task.id == b.task_id).first() if b.task_id else None
    if task is not None and task.status == BLOCKED:
        other_open = db.query(Blocker).filter(Blocker.task_id == task.id, Blocker.status != "RESOLVED", Blocker.id != b.id).count()
        if not other_open:
            try:
                transition(task, "unblock", current_user.role)
            except WorkflowError as exc:
                db.rollback()
                raise HTTPException(exc.status_code, str(exc))
    refresh_proposal(db, b)  # the real held-up time is now known
    notify(db, project_recipients(db, b.project_id, NOTIFY_APPROVERS, exclude_user_id=current_user.id), project_id=b.project_id,
           kind="PROBLEM_RESOLVED", title=f"Problem resolved: {b.category}",
           body="Confirm whether it cost any time." if needs_review(b) else "The confirmed delay stands unless you update it.",
           entity_type="problem", entity_id=b.id)
    db.commit()
    db.refresh(b)
    AuditService.log_action(db, action="PROBLEM_RESOLVE", entity_name="Blocker", entity_id=str(b.id),
                            new_values={"resolved_date": str(when), "note": b.resolution_note}, user_id=current_user.id)
    return _to_response(db, b)


@router.post("/api/problems/{problem_id}/impact", response_model=ProblemResponse)
def decide_impact(problem_id: int, body: ImpactDecision, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    """Project manager confirms (and may adjust) the schedule impact, or says there is none.
    Only confirmed impact is counted in delay reports."""
    if current_user.role not in APPROVER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a Project Manager or Admin can confirm schedule impact")
    b = _load(db, problem_id)
    old = {"impact_status": b.impact_status, "confirmed_delay_days": b.confirmed_delay_days,
           "confirmed_project_delay_days": b.confirmed_project_delay_days}
    if body.decision == "NO_IMPACT":
        b.impact_status = "NO_IMPACT"
        b.confirmed_delay_days = 0.0
        b.confirmed_project_delay_days = 0.0
    else:
        days = body.days if body.days is not None else b.proposed_delay_days
        project_days = body.project_days if body.project_days is not None else b.proposed_project_delay_days
        if days is None:
            raise HTTPException(422, "There is no system estimate for this problem; enter the delay in days")
        b.impact_status = "CONFIRMED"
        b.confirmed_delay_days = float(days)
        b.confirmed_project_delay_days = float(project_days or 0.0)
        # A problem on one activity cannot move the project end by more than it holds that activity up.
        if b.activity_id is not None and b.confirmed_project_delay_days > b.confirmed_delay_days + 0.05:
            raise HTTPException(422, "The project cannot slip by more than the activity is held up")
    b.impact_note = (body.note or "").strip() or None
    b.impact_decided_by_user_id = current_user.id
    b.impact_decided_at = datetime.utcnow()
    if b.impact_status == "CONFIRMED":
        verdict = f"Delay confirmed: {b.confirmed_delay_days:g} working days on the activity, project end moves {b.confirmed_project_delay_days:g}."
    else:
        verdict = "The project manager confirmed there is no delay."
    notify_user(db, b.reported_by_user_id, current_user.id, project_id=b.project_id, kind="IMPACT_DECIDED",
                title=f"Reviewed: {b.category}", body=verdict, entity_type="problem", entity_id=b.id)
    if b.impact_status == "CONFIRMED" and (b.confirmed_project_delay_days or 0) > 0:
        notify(db, project_recipients(db, b.project_id, DIRECTOR_ROLES, exclude_user_id=current_user.id), project_id=b.project_id,
               kind="DELAY_CONFIRMED", title=f"Project end moves {b.confirmed_project_delay_days:g} days",
               body=f"{b.category}: {short(b.description, 100)}", entity_type="problem", entity_id=b.id)
    db.commit()
    db.refresh(b)
    AuditService.log_action(db, action="PROBLEM_IMPACT", entity_name="Blocker", entity_id=str(b.id), old_values=old,
                            new_values={"impact_status": b.impact_status, "confirmed_delay_days": b.confirmed_delay_days,
                                        "confirmed_project_delay_days": b.confirmed_project_delay_days},
                            user_id=current_user.id)
    return _to_response(db, b)


@router.get("/api/projects/{project_id}/delay-summary")
def get_delay_summary(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return delay_summary(db, project_id, allowed_towers(db, current_user, project_id))
