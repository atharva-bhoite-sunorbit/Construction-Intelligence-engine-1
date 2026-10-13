"""What needs a person's attention on a project, worked out from the data (nothing is stored).

Project managers get an action list: approvals waiting, problems to review, blocked tasks, late activities, work that
should have started. Directors get the same items only when they are overdue or serious, as escalations.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, Blocker, Task, User
from backend.app.services.sequence import compute_sequence

APPROVER_ROLES = {"Project Manager", "Admin"}
ESCALATE_AFTER_DAYS = 3
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _age(moment: Optional[datetime], today: date) -> int:
    return max((today - moment.date()).days, 0) if moment else 0


def _item(kind: str, severity: str, title: str, detail: str, days: int, tab: str, entity_type: str, entity_id: int, tower: Optional[str] = None) -> Dict[str, Any]:
    return {"kind": kind, "severity": severity, "title": title, "detail": detail, "days": days, "tab": tab,
            "entity_type": entity_type, "entity_id": entity_id, "tower": tower}


def build_attention(db: Session, project_id: int, user: User, today: Optional[date] = None, limit: int = 12) -> List[Dict[str, Any]]:
    if user.role not in APPROVER_ROLES and user.role != "Top Management":
        return []
    director = user.role == "Top Management"
    today = today or date.today()
    items: List[Dict[str, Any]] = []
    plural = lambda n, w: f"{n} {w}{'' if n == 1 else 's'}"  # noqa: E731

    for t in db.query(Task).filter(Task.project_id == project_id, Task.status == "PENDING_APPROVAL").all():
        age = _age(t.updated_at, today)
        if director and age < ESCALATE_AFTER_DAYS:
            continue
        items.append(_item("APPROVAL", "high" if age >= ESCALATE_AFTER_DAYS else "medium", f"Approve: {t.title}",
                           f"Unplanned work in {t.tower}, waiting {plural(age, 'day')}" if age else f"Unplanned work in {t.tower}, sent today",
                           age, "tasks", "task", t.id, t.tower))

    act_names = {a.id: a for a in db.query(Activity).filter(Activity.project_id == project_id).all()}
    for b in db.query(Blocker).filter(Blocker.project_id == project_id, Blocker.impact_status.in_(["NOT_ASSESSED", "PROPOSED"])).all():
        age = _age(b.created_at, today) or max((today - b.opened_date).days, 0)
        serious = (b.proposed_project_delay_days or 0) > 0 or b.severity in ("HIGH", "CRITICAL")
        if director and age < ESCALATE_AFTER_DAYS:
            continue
        a = act_names.get(b.activity_id)
        where = a.name if a else "whole project"
        effect = (f"; may move the project end by {b.proposed_project_delay_days:g} days" if (b.proposed_project_delay_days or 0) > 0 else "")
        items.append(_item("PROBLEM_REVIEW", "high" if serious else "medium", f"Review: {b.category}",
                           f"{where}{effect}; {'fixed, but ' if b.status == 'RESOLVED' else ''}not yet reviewed ({plural(age, 'day')})",
                           age, "problems", "problem", b.id, a.tower if a else None))

    if not director:
        for t in db.query(Task).filter(Task.project_id == project_id, Task.status == "BLOCKED").all():
            age = _age(t.updated_at, today)
            items.append(_item("BLOCKED_TASK", "high" if age >= ESCALATE_AFTER_DAYS else "medium", f"Blocked: {t.title}",
                               f"{t.tower}. {t.blocked_note or 'Held up by a problem'}" + (f" ({plural(age, 'day')})" if age else ""),
                               age, "tasks", "task", t.id, t.tower))

    seq = compute_sequence(db, project_id, today)
    late = []
    for i in seq:
        if i["state"] != "DONE" and i["end_date"] and i["end_date"] < today and i["progress_percent"] < 100:
            late.append((today - i["end_date"]).days)
            items.append(_item("LATE_ACTIVITY", "high" if (today - i["end_date"]).days >= 7 else "medium", f"Late: {i['name']}",
                               f"{i['tower']}, planned to finish {i['end_date']:%d %b}, {int(i['progress_percent'])}% done",
                               (today - i["end_date"]).days, "schedule", "activity", i["activity_id"], i["tower"]))
    if not director:
        for i in seq:
            if i["state"] in ("READY", "WAITING") and i["start_date"] and i["start_date"] < today - timedelta(days=1) and not i["progress_percent"]:
                days = (today - i["start_date"]).days
                why = f"waiting for {', '.join(i['waiting_on'][:2])}" if i["waiting_on"] else "ready, nobody has started"
                items.append(_item("SHOULD_HAVE_STARTED", "medium", f"Should have started: {i['name']}",
                                   f"{i['tower']}, planned start {i['start_date']:%d %b}, {why}", days, "schedule", "activity",
                                   i["activity_id"], i["tower"]))

    items.sort(key=lambda x: (SEVERITY_ORDER[x["severity"]], -x["days"]))
    # keep a mix: never let one kind crowd out the rest
    picked, per_kind = [], {}
    for it in items:
        if per_kind.get(it["kind"], 0) >= 4:
            continue
        per_kind[it["kind"]] = per_kind.get(it["kind"], 0) + 1
        picked.append(it)
    return picked[:limit]


def activity_detail(db: Session, activity: Activity, towers=None) -> Dict[str, Any]:
    from backend.app.models.all_models import ActivityDependency
    from backend.app.utils.access import tower_allowed

    seq = {i["activity_id"]: i for i in compute_sequence(db, activity.project_id)}
    me = seq[activity.id]
    deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == activity.project_id,
                                               ActivityDependency.predecessor_id == activity.id).all()
    successors = []
    for d in deps:
        s = seq.get(d.successor_id)
        if s:
            successors.append({"id": s["activity_id"], "name": s["name"], "type": d.dependency_type or "FS", "lag_days": d.lag_days or 0,
                               "state": s["state"], "tower": s["tower"]})
    tasks = db.query(Task).filter(Task.activity_id == activity.id).order_by(Task.id).all()
    problems = db.query(Blocker).filter(Blocker.activity_id == activity.id).order_by(Blocker.opened_date.desc()).all()
    variance = (activity.end_date - activity.baseline_end_date).days if activity.end_date and activity.baseline_end_date else None
    task_days = sum(max(t.planned_days, 1) for t in tasks if t.status in ("APPROVED", "IN_PROGRESS", "BLOCKED", "COMPLETED"))
    return {
        "id": activity.id, "name": activity.name, "tower": activity.tower, "phase": activity.phase, "work_package": activity.work_package,
        "status": activity.status, "progress_percent": activity.progress_percent or 0.0, "planned_duration": activity.planned_duration,
        "start_date": activity.start_date, "end_date": activity.end_date, "baseline_start_date": activity.baseline_start_date,
        "baseline_end_date": activity.baseline_end_date, "actual_start_date": activity.actual_start_date,
        "actual_end_date": activity.actual_end_date, "finish_variance_days": variance, "is_critical": bool(activity.is_critical),
        "total_float": activity.total_float, "step": me["step"], "state": me["state"], "waiting_on": me["waiting_on"],
        "predecessors": me["predecessors"], "successors": successors, "task_days_planned": task_days,
        "tasks": [{"id": t.id, "title": t.title, "status": t.status, "progress_percent": t.progress_percent,
                   "planned_days": t.planned_days, "is_unplanned": t.is_unplanned} for t in tasks],
        "problems": [{"id": b.id, "category": b.category, "status": b.status, "impact_status": b.impact_status,
                      "description": b.description, "opened_date": b.opened_date, "resolved_date": b.resolved_date,
                      "confirmed_delay_days": b.confirmed_delay_days, "confirmed_project_delay_days": b.confirmed_project_delay_days,
                      "proposed_delay_days": b.proposed_delay_days} for b in problems],
    }


def project_digest(db: Session, project, days: int = 7, towers=None, today: Optional[date] = None) -> Dict[str, Any]:
    from backend.app.services.problems import delay_summary
    from backend.app.utils.access import tower_allowed

    today = today or date.today()
    since = today - timedelta(days=days)
    in_scope = lambda tower: tower_allowed(towers, tower)  # noqa: E731
    tasks = [t for t in db.query(Task).filter(Task.project_id == project.id).all() if in_scope(t.tower)]
    acts = {a.id: a for a in db.query(Activity).filter(Activity.project_id == project.id).all()}
    problems = [b for b in db.query(Blocker).filter(Blocker.project_id == project.id).all()
                if b.activity_id is None or in_scope((acts.get(b.activity_id).tower if acts.get(b.activity_id) else None))]
    finished = [t for t in tasks if t.actual_end_date and since <= t.actual_end_date <= today]
    started = [t for t in tasks if t.actual_start_date and since <= t.actual_start_date <= today]
    decided = [t for t in tasks if t.decided_at and since <= t.decided_at.date() <= today]
    done_acts = [a for a in acts.values() if a.actual_end_date and since <= a.actual_end_date <= today and in_scope(a.tower)]
    reported = [b for b in problems if since <= b.opened_date <= today]
    resolved = [b for b in problems if b.resolved_date and since <= b.resolved_date <= today]
    confirmed_now = [b for b in problems if b.impact_status == "CONFIRMED" and b.impact_decided_at and since <= b.impact_decided_at.date() <= today]
    summary = delay_summary(db, project.id, towers)
    planned = project.target_completion_date
    expected = planned + timedelta(days=round(summary["largest_confirmed_project_delay_days"])) if planned else None
    return {
        "days": days, "since": since, "until": today,
        "tasks_finished": len(finished), "tasks_started": len(started), "activities_finished": len(done_acts),
        "approvals_decided": len(decided), "problems_reported": len(reported), "problems_resolved": len(resolved),
        "delay_confirmed_this_period_days": round(sum((b.confirmed_project_delay_days or 0) for b in confirmed_now), 1),
        "recent_finished": [{"title": t.title, "tower": t.tower, "date": t.actual_end_date} for t in sorted(finished, key=lambda x: x.actual_end_date, reverse=True)[:5]],
        "planned_finish": planned, "expected_finish": expected,
        "confirmed_project_delay_days": summary["largest_confirmed_project_delay_days"],
    }
