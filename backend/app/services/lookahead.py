"""Today + next 5 days for the site team, with Plan B when something is stopped.

Plan A for a day is every open activity whose planned window covers that day (today also carries anything overdue or
already running). An item is stopped when an open problem sits on it or its tasks, a task is on hold, or the work it
follows in the plan is not done. Plan B is where the crew can go instead, in two kinds:
- "boost": work already running today that nothing stops, so more hands finish it sooner;
- "pull_forward": activities that are ready (everything before them in the plan is done), have no open problem and are
  planned to start within the next weeks, nearest first.
Towers that have stopped work are listed first.
Sundays are not working days, matching the 6-day week the sequence uses.
"""
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, Blocker, Task
from backend.app.services.readiness import unmet_mandatory, work_type_for
from backend.app.services.sequence import DONE, READY, RUNNING, WAITING, compute_sequence
from backend.app.utils.access import tower_allowed

OPEN_TASK = {"DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "BLOCKED"}
PULL_FORWARD_DAYS = 45
PLAN_B_LIMIT = 6


def working_days(start: date, count: int) -> List[date]:
    days, d = [], start
    while len(days) < count:
        if d.weekday() != 6:   # Sunday off
            days.append(d)
        d += timedelta(days=1)
    return days


def build_lookahead(db: Session, project_id: int, towers: Optional[Set[str]], today: Optional[date] = None,
                    days: int = 5) -> Dict[str, Any]:
    today = today or date.today()
    seq = [s for s in compute_sequence(db, project_id, today) if tower_allowed(towers, s["tower"])]
    acts = {a.id: a for a in db.query(Activity).filter(Activity.project_id == project_id)}
    tasks: Dict[int, List[Task]] = {}
    for t in db.query(Task).filter(Task.project_id == project_id, Task.status.in_(OPEN_TASK)):
        if t.activity_id:
            tasks.setdefault(t.activity_id, []).append(t)
    task_activity = {t.id: aid for aid, ts in tasks.items() for t in ts}
    problems: Dict[int, List[Blocker]] = {}
    for b in db.query(Blocker).filter(Blocker.project_id == project_id, Blocker.status != "RESOLVED"):
        aid = b.activity_id or task_activity.get(b.task_id)
        if aid:
            problems.setdefault(aid, []).append(b)

    def stoppers(s: Dict[str, Any], on: date) -> List[Dict[str, Any]]:
        out = []
        for b in problems.get(s["activity_id"], []):
            out.append({"kind": "problem", "text": f"{b.category}: {b.description}", "problem_id": b.id})
        for t in tasks.get(s["activity_id"], []):
            if t.status == "BLOCKED":
                out.append({"kind": "on_hold", "text": f"Task '{t.title}' is on hold" + (f": {t.blocked_note}" if t.blocked_note else ""), "task_id": t.id})
        if s["state"] == WAITING and s["start_date"] and s["start_date"] <= on:
            names = s["waiting_on"]
            out.append({"kind": "waiting", "text": "Waiting for " + ", ".join(names[:2]) + (f" and {len(names) - 2} more" if len(names) > 2 else "")})
        return out

    def item(s: Dict[str, Any], on: date) -> Dict[str, Any]:
        a = acts.get(s["activity_id"])
        open_tasks = tasks.get(s["activity_id"], [])
        notes = []
        if on == today:
            for t in open_tasks:
                if t.status == "DRAFT":
                    n = len(unmet_mandatory(db, t.id))
                    if n:
                        notes.append(f"{n} readiness check{'s' if n != 1 else ''} open on '{t.title}'")
        return {
            "activity_id": s["activity_id"], "name": s["name"], "tower": s["tower"], "state": s["state"],
            "progress_percent": s["progress_percent"], "start_date": s["start_date"], "end_date": s["end_date"],
            "work_type": work_type_for(a) if a else None,
            "late": bool(s["end_date"] and s["end_date"] < on and s["state"] != DONE),
            "starts": s["start_date"] == on, "finishes": s["end_date"] == on,
            "tasks": [{"id": t.id, "title": t.title, "status": t.status} for t in open_tasks],
            "stopped_by": stoppers(s, on), "notes": notes,
        }

    out_days = []
    for i, d in enumerate(working_days(today, days + 1)):
        chosen = []
        for s in seq:
            if s["state"] == DONE:
                continue
            covers = bool(s["start_date"] and s["end_date"] and s["start_date"] <= d <= s["end_date"])
            carried = i == 0 and (s["state"] == RUNNING or bool(s["end_date"] and s["end_date"] < today))
            if covers or carried:
                chosen.append(item(s, d))
        chosen.sort(key=lambda x: (not x["stopped_by"], not x["late"], x["start_date"] or d, x["name"]))
        out_days.append({"date": d, "is_today": i == 0, "items": chosen})

    today_items = out_days[0]["items"]
    stopped = [x for x in today_items if x["stopped_by"]]
    on_today = {x["activity_id"] for x in today_items}
    stopped_towers = {x["tower"] for x in stopped}
    horizon = today + timedelta(days=PULL_FORWARD_DAYS)
    candidates = [s for s in seq if s["state"] == READY and s["activity_id"] not in on_today
                  and not problems.get(s["activity_id"]) and s["start_date"] and today < s["start_date"] <= horizon]
    candidates.sort(key=lambda s: (s["tower"] not in stopped_towers, s["start_date"], s["step"]))
    plan_b = []
    if stopped:
        for x in sorted((x for x in today_items if not x["stopped_by"] and x["state"] == RUNNING),
                        key=lambda x: (x["tower"] not in stopped_towers, not x["late"], x["end_date"] or today))[:3]:
            plan_b.append({
                "kind": "boost", "activity_id": x["activity_id"], "name": x["name"], "tower": x["tower"],
                "work_type": x["work_type"], "start_date": x["start_date"], "end_date": x["end_date"], "days_early": 0,
                "open_task_id": next((t["id"] for t in x["tasks"]), None),
                "why": f"Running and nothing stops it ({round(x['progress_percent'])}% done)",
            })
    for s in candidates[:PLAN_B_LIMIT]:
        a = acts.get(s["activity_id"])
        open_task = next((t for t in tasks.get(s["activity_id"], [])), None)
        plan_b.append({
            "kind": "pull_forward", "activity_id": s["activity_id"], "name": s["name"], "tower": s["tower"],
            "work_type": work_type_for(a) if a else None, "start_date": s["start_date"], "end_date": s["end_date"],
            "days_early": (s["start_date"] - today).days, "open_task_id": open_task.id if open_task else None,
            "why": "Everything before it in the plan is done",
        })
    return {"today": today, "days": out_days, "stopped": len(stopped), "plan_b": plan_b,
            "summary": {"today_items": len(today_items), "late": sum(1 for x in today_items if x["late"]),
                        "running": sum(1 for x in today_items if x["state"] == RUNNING)}}
