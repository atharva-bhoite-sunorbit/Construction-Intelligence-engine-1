"""Create the "41 ZOY+" project from the real MSP baseline and fill it with sample work, in plan order.

    python scripts/seed_41zoy_plus.py            # uses DATABASE_URL (default: ./construction_intelligence.db)

What it does (safe to run again; it only adds what is missing):
  1. Creates project 41 ZOY+ and imports data/zoy/41_ZOY_baseline_master_2026-10-06.xlsx (real dates and predecessors).
  2. Archives the older "41 ZOY" project so it stops showing up (nothing is deleted).
  3. Gives the demo users access (PM and Site Manager: all; Aditya: Tower A; Vicky: Tower B; Director: all).
  4. Sample site work in the planned order: finished work has completed tasks, running work has a task in progress,
     the next ready work has tasks not started yet (some checks ticked), plus unplanned tasks in every state.
  5. Sample problems: resolved, waiting for review, confirmed, and one tied to a running task.
  6. Two small extra projects so the director's portfolio shows more than one.
Sample data is clearly sample: all dates are relative to TODAY below.
"""
import math
import os
import secrets
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402  (creates tables, migrations and starter checklists)
from backend.app.database.connection import SessionLocal  # noqa: E402
from backend.app.models.all_models import (  # noqa: E402
    Activity, ActivityDependency, Blocker, Project, ProjectMember, Task, User,
)
from backend.app.models.all_models import Notification  # noqa: E402
from backend.app.services.notifications import backfill_open_items  # noqa: E402
from backend.app.services.problems import refresh_proposal  # noqa: E402
from backend.app.services.schedule_import import apply_import, parse_workbook  # noqa: E402
from backend.app.services.sequence import DONE, READY, RUNNING, WAITING, compute_sequence  # noqa: E402
from backend.app.utils.security import create_access_token, get_password_hash  # noqa: E402

TODAY = date.today()
CODE = "PRJ-41ZOY-PLUS"
WORKBOOK = Path(__file__).resolve().parent.parent / "data" / "zoy" / "41_ZOY_baseline_master_2026-10-06.xlsx"
client = TestClient(app)

ROLES = {
    "admin@construction.ai": "Admin", "pm@construction.ai": "Project Manager", "sm@construction.ai": "Site Manager",
    "eng@construction.ai": "Site Engineer", "exec@construction.ai": "Top Management",
    "aditya.patil@construction.ai": "Site Engineer", "vicky.satpute@construction.ai": "Site Engineer",
}
ENGINEER = {"Tower A": "aditya.patil@construction.ai", "Tower B": "vicky.satpute@construction.ai"}
PM, ADMIN, EXEC = "pm@construction.ai", "admin@construction.ai", "exec@construction.ai"
CREWS = {"Excavation": "Excavation gang (Ramesh)", "Slab / RCC": "RCC gang (Suresh)", "Blockwork": "Masonry team",
         "Waterproofing": "Waterproofing team", "MEP": "MEP contractor", "Finishing": "Finishing team", "General": "Site team"}


def call(method, path, email, body=None, expect=(200, 201, 204)):
    headers = {"Authorization": "Bearer " + create_access_token({"sub": email, "role": ROLES[email]})}
    res = client.request(method, path, json=body if body is not None else {}, headers=headers)
    if res.status_code not in expect:
        raise RuntimeError(f"{method} {path} as {email} -> {res.status_code}: {res.text[:300]}")
    return res.json() if res.content else None


def get(path, email):
    return call("GET", path, email, None)


def ensure_users(db):
    for email, role in ROLES.items():
        if db.query(User).filter(User.email == email).first():
            continue
        name = email.split("@")[0].replace(".", " ").title()
        password = secrets.token_urlsafe(9)
        db.add(User(email=email, hashed_password=get_password_hash(password), full_name=name, role=role))
        print(f"created user {email} (password: {password})")
    db.commit()
    director = db.query(User).filter(User.email == EXEC).first()
    if director and "Vishal" not in director.full_name:
        director.full_name = "Vishal Agarwal (Director)"
        db.commit()


def member(db, project_id, email, scope="ALL"):
    user = db.query(User).filter(User.email == email).first()
    exists = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id,
                                            ProjectMember.scope == scope).first()
    if not exists:
        db.add(ProjectMember(project_id=project_id, user_id=user.id, scope=scope))
        db.commit()


def ensure_project(db):
    project = db.query(Project).filter(Project.code == CODE).first()
    if not project:
        project = Project(
            name="41 ZOY+", code=CODE, construction_type="High-Rise Residential", location="Hinjewadi, Pune",
            num_floors=35, num_towers=2, built_up_area=0.0, planned_start_date=date(2025, 7, 1),
            target_completion_date=date(2029, 1, 18), project_manager="Nishikant Dantkale", status="IN_PROGRESS",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        print("created project 41 ZOY+")
    if db.query(Activity).filter(Activity.project_id == project.id).count() == 0:
        parsed = parse_workbook(WORKBOOK.read_bytes())
        if parsed.errors:
            raise SystemExit(f"Baseline workbook has errors: {parsed.errors[:3]}")
        admin = db.query(User).filter(User.email == ADMIN).first()
        result = apply_import(db, project, admin, parsed, WORKBOOK.name)
        print(f"imported baseline: {result['created']} activities, {result['dependencies']} dependencies")
    old = db.query(Project).filter(Project.code == "PRJ-41ZOY", Project.status != "ARCHIVED").first()
    if old:
        old.status = "ARCHIVED"
        db.commit()
        print("archived the older '41 ZOY' project (nothing deleted)")
    for email in (PM, "sm@construction.ai", EXEC):
        member(db, project.id, email)
    member(db, project.id, ENGINEER["Tower A"], "Tower A")
    member(db, project.id, ENGINEER["Tower B"], "Tower B")
    member(db, project.id, "eng@construction.ai", "Tower A")
    return project


# ----------------------------------------------------------------------------------------- tasks
def clean(name):
    return " ".join(name.split())


def actor_for(tower):
    return ENGINEER.get(tower, PM)


def work_type(db, activity):
    from backend.app.services.readiness import work_type_for
    return work_type_for(activity)


def make_task(db, project_id, activity, title, days, email, crew=None):
    task = call("POST", f"/api/projects/{project_id}/tasks", email,
                {"title": title, "activity_id": activity.id, "planned_days": max(1, days), "assigned_to": crew})
    return task


def tick_checks(task_id, email, leave_open=0):
    checks = get(f"/api/tasks/{task_id}/checks", email)
    mandatory = [c for c in checks if c["mandatory"]]
    keep_open = {c["id"] for c in mandatory[len(mandatory) - leave_open:]} if leave_open else set()
    for c in checks:
        if c["id"] in keep_open:
            continue
        call("POST", f"/api/tasks/{task_id}/checks/{c['id']}", email, {"passed": True})


def run_task(task, email, start, end=None, percent=None):
    tick_checks(task["id"], email)
    call("POST", f"/api/tasks/{task['id']}/start", email, {"on_date": start.isoformat()})
    if percent:
        call("POST", f"/api/tasks/{task['id']}/progress", email, {"percent": percent})
    if end:
        call("POST", f"/api/tasks/{task['id']}/complete", email, {"on_date": end.isoformat()})


def split_days(total, parts):
    base = total // parts
    return [base + (total - base * parts if i == parts - 1 else 0) for i in range(parts)]


def seed_finished(db, project_id, a):
    dur = int(a.planned_duration or 0)
    start = a.actual_start_date or a.start_date
    end = min(a.actual_end_date or a.end_date, TODAY)
    parts = 1 if dur <= 20 else 2 if dur <= 60 else 3
    span = max((end - start).days, 0)
    crew = CREWS[work_type(db, a)]
    for i, days in enumerate(split_days(dur, parts)):
        s = start + timedelta(days=span * i // parts)
        e = start + timedelta(days=span * (i + 1) // parts) if i < parts - 1 else end
        title = clean(a.name) if parts == 1 else f"{clean(a.name)}, part {i + 1} of {parts}"
        t = make_task(db, project_id, a, title, days, actor_for(a.tower), crew)
        run_task(t, actor_for(a.tower), s, max(e, s))


def seed_running(db, project_id, a):
    dur = int(a.planned_duration or 0)
    email = actor_for(a.tower)
    crew = CREWS[work_type(db, a)]
    done_days = int(round(dur * (a.progress_percent or 0) / 100))
    start = a.actual_start_date or a.start_date
    mid = start + (max(TODAY - timedelta(days=2) - start, timedelta(0))) * 4 // 5
    mid = max(mid, start)
    if done_days >= 1:
        parts = max(1, min(3, math.ceil(done_days / 30)))
        span = max((mid - start).days, 0)
        for i, days in enumerate(split_days(done_days, parts)):
            s = start + timedelta(days=span * i // parts)
            e = start + timedelta(days=span * (i + 1) // parts) if i < parts - 1 else mid
            title = f"{clean(a.name)}, part {i + 1}" if parts > 1 or dur > 20 else clean(a.name)
            t = make_task(db, project_id, a, title + (" (completed)" if parts == 1 and dur > 20 else ""), days, email, crew)
            run_task(t, email, s, max(e, s))
    remaining = max(dur - done_days, 1)
    run_days = min(remaining, 30)
    t = make_task(db, project_id, a, clean(a.name) if done_days < 1 and dur <= 20 else f"{clean(a.name)}, current stretch", run_days, email, crew)
    run_task(t, email, min(max(mid + timedelta(days=1), start), TODAY), None, percent=20 if run_days >= 5 else None)


def seed_next(db, project_id, a, tick_all_but_one):
    email = actor_for(a.tower)
    t = make_task(db, project_id, a, clean(a.name), max(1, min(int(a.planned_duration or 1), 20)), email, CREWS[work_type(db, a)])
    tick_checks(t["id"], email, leave_open=1 if tick_all_but_one else 0)
    if not tick_all_but_one:
        # leave everything untouched: a brand-new task
        pass
    return t


def seed_tasks(db, project):
    pid = project.id
    seq = compute_sequence(db, pid)
    acts = {a.id: a for a in db.query(Activity).filter(Activity.project_id == pid).all()}
    ready_per_tower = {}
    counts = {"done": 0, "running": 0, "next": 0}
    for item in seq:
        a = acts[item["activity_id"]]
        if not a.planned_duration:  # milestones carry no site work
            continue
        if item["state"] == DONE:
            seed_finished(db, pid, a)
            counts["done"] += 1
        elif item["state"] == RUNNING:
            seed_running(db, pid, a)
            counts["running"] += 1
        elif item["state"] in (READY, WAITING) and a.start_date <= TODAY + timedelta(days=45) and a.tower in ENGINEER:
            n = ready_per_tower.get(a.tower, 0)
            if n < 2:  # leave the rest for the 'Next in the plan' suggestions
                seed_next(db, pid, a, tick_all_but_one=(n == 0))
                ready_per_tower[a.tower] = n + 1
                counts["next"] += 1
    print(f"sample tasks in plan order: {counts['done']} finished activities, {counts['running']} running, {counts['next']} next-up")


def seed_unplanned(db, pid):
    def unplanned(email, title, reason, tower):
        return call("POST", f"/api/projects/{pid}/tasks", email, {"title": title, "is_unplanned": True, "unplanned_reason": reason,
                                                                    "tower": tower, "planned_days": 4})
    a, b = ENGINEER["Tower A"], ENGINEER["Tower B"]

    t = unplanned(a, "Seal water seepage at podium expansion joint", "Water seepage found at the expansion joint while curing the podium slab", "Tower A")
    call("POST", f"/api/tasks/{t['id']}/submit", a)
    call("POST", f"/api/tasks/{t['id']}/approve", PM)
    call("POST", f"/api/tasks/{t['id']}/start", a, {"on_date": (TODAY - timedelta(days=6)).isoformat()})
    call("POST", f"/api/tasks/{t['id']}/progress", a, {"percent": 50})

    t = unplanned(a, "Extra shear wall near the lift core", "Client asked for an extra shear wall after the structural review", "Tower A")
    call("POST", f"/api/tasks/{t['id']}/submit", a)

    t = unplanned(a, "Temporary dewatering pump at the basement pit", "Groundwater at 3.2 m in the extended basement pit", "Tower A")
    call("POST", f"/api/tasks/{t['id']}/submit", a)
    call("POST", f"/api/tasks/{t['id']}/approve", PM)
    call("POST", f"/api/tasks/{t['id']}/start", a, {"on_date": (TODAY - timedelta(days=40)).isoformat()})
    call("POST", f"/api/tasks/{t['id']}/complete", a, {"on_date": (TODAY - timedelta(days=33)).isoformat()})

    t = unplanned(b, "Extra anchor bolts for the crane base", "Crane base needs additional anchor bolts", "Tower B")
    call("POST", f"/api/tasks/{t['id']}/submit", b)
    call("POST", f"/api/tasks/{t['id']}/reject", PM, {"reason": "Already covered by the lift scope. Add it to the planned task."})

    unplanned(b, "Repair site hoarding near the main gate", "Hoarding panels damaged by strong wind", "Tower B")
    print("sample unplanned tasks: 5 (in progress, waiting for approval, completed, sent back, draft)")


# ----------------------------------------------------------------------------------------- problems
def backdate(db, problem_id, opened, resolved=None, expected=None):
    b = db.query(Blocker).filter(Blocker.id == problem_id).first()
    b.opened_date = opened
    b.created_at = datetime.combine(opened, datetime.min.time())
    if resolved:
        b.resolved_date = resolved
    if expected:
        b.expected_resolution = expected
    refresh_proposal(db, b)
    db.commit()
    return b


def find(db, pid, tower, state_prefix=None, contains=None, status=None):
    q = db.query(Activity).filter(Activity.project_id == pid, Activity.tower == tower)
    for a in q.order_by(Activity.start_date).all():
        if (status and a.status != status) or (contains and contains not in a.name):
            continue
        return a
    return None


def seed_problems(db, pid):
    # 1. fixed, PM confirmed a short delay that float absorbed
    a1 = find(db, pid, "Tower B", contains="03 SLAB", status="COMPLETED")
    p = call("POST", f"/api/projects/{pid}/problems", PM, {"category": "Material not available", "description": "Rebar delivery delayed by a supplier strike",
                                                           "severity": "HIGH", "owner": "Purchase team", "activity_id": a1.id})
    b = backdate(db, p["id"], TODAY - timedelta(days=70), resolved=TODAY - timedelta(days=62))
    call("POST", f"/api/problems/{p['id']}/resolve", PM, {"note": "Alternate supplier delivered", "on_date": (TODAY - timedelta(days=62)).isoformat()}, expect=(200, 409))
    call("POST", f"/api/problems/{p['id']}/impact", PM, {"decision": "CONFIRM", "days": 6, "project_days": 0, "note": "Float absorbed it; project end unchanged"})

    # 2. fixed, no delay
    a2 = find(db, pid, "Tower A", contains="02 SLAB", status="COMPLETED")
    p = call("POST", f"/api/projects/{pid}/problems", PM, {"category": "Weather", "description": "Heavy rain stopped concreting for two days",
                                                           "severity": "LOW", "owner": "Site team", "activity_id": a2.id})
    backdate(db, p["id"], TODAY - timedelta(days=45), resolved=TODAY - timedelta(days=43))
    call("POST", f"/api/problems/{p['id']}/resolve", PM, {"note": "Pour moved to the next morning", "on_date": (TODAY - timedelta(days=43)).isoformat()}, expect=(200, 409))
    call("POST", f"/api/problems/{p['id']}/impact", PM, {"decision": "NO_IMPACT", "note": "Pour moved to the next morning"})

    # 3. open, waiting for the PM to review (system estimate only)
    a3 = find(db, pid, "Tower A", contains="04 SLAB", status="IN_PROGRESS")
    p = call("POST", f"/api/projects/{pid}/problems", ENGINEER["Tower A"], {
        "category": "Drawing or design approval pending", "description": "Revised beam layout for the next slab is waiting for the structural consultant's sign-off",
        "severity": "HIGH", "owner": "SSPA Consulting Engineers", "activity_id": a3.id})
    backdate(db, p["id"], TODAY - timedelta(days=5), expected=TODAY + timedelta(days=4))

    # 4. open, tied to a running task on Tower B (task becomes blocked), PM has confirmed the delay
    a4 = find(db, pid, "Tower B", contains="04 SLAB", status="IN_PROGRESS")
    running = [t for t in get(f"/api/projects/{pid}/tasks", PM) if t["activity_id"] == a4.id and t["status"] == "IN_PROGRESS"]
    if running:
        p = call("POST", f"/api/projects/{pid}/problems", ENGINEER["Tower B"], {
            "category": "Equipment unavailable", "description": "Tower crane is under repair, replacement part arrives in three days",
            "severity": "HIGH", "owner": "Equipment contractor", "task_id": running[0]["id"]})
        backdate(db, p["id"], TODAY - timedelta(days=9), expected=TODAY + timedelta(days=3))
        call("POST", f"/api/problems/{p['id']}/impact", PM, {"decision": "CONFIRM", "note": "Agreed with the planner"})

    # 5. open, project-wide, not reviewed yet
    p = call("POST", f"/api/projects/{pid}/problems", PM, {"category": "Client decision pending", "description": "Client has not finalised the facade colour scheme",
                                                           "severity": "MEDIUM", "owner": "Client"})
    backdate(db, p["id"], TODAY - timedelta(days=12))
    print("sample problems: 5 (2 resolved, 1 waiting for review, 1 confirmed and blocking a task, 1 project-wide)")


# ----------------------------------------------------------------------------------------- extra projects
# Other Krisala "41" projects, so the director's portfolio has more than one. Names and localities are real; all
# progress, dates and problems are SAMPLE data.
def ordinal(n):
    return f"{n}{'TH' if 10 <= n % 100 <= 20 else {1: 'ST', 2: 'ND', 3: 'RD'}.get(n % 10, 'TH')}"


def tower_plan(tower, floors, done_floors, partial, lag=0, finishing=None):
    """Sub-structure, stilt, floors 1..N, terrace for one tower: `done_floors` slabs finished, the next one `partial`% done.
    `lag` days: the plan expected it earlier, so unfinished slabs show as late."""
    levels = ["STILT FLOOR SLAB"] + [f"{ordinal(i)} FLOOR" for i in range(1, floors + 1)] + ["TERRACE FLOOR"]
    rows = [("SUB- STRUCTURE", tower, -(done_floors + 1) * 14 - 70 - lag, 60, 100)]
    for k, level in enumerate(levels):
        progress = 100 if k < done_floors else (partial if k == done_floors else 0)
        rows.append((f"{k + 1:02d} SLAB ({level})", tower, (k - done_floors) * 14 - lag, 12, progress))
    for title, offset, dur, progress in (finishing or []):
        rows.append((title, tower, offset, dur, progress))
    return rows


def extra_project(db, code, name, location, pm_name, cover, plan, problems, pending_task=None):
    if db.query(Project).filter(Project.code == code).first():
        return
    p = Project(name=name, code=code, construction_type="Residential", location=location, built_up_area=0.0, num_floors=15,
                num_towers=len({r[1] for r in plan}), planned_start_date=TODAY - timedelta(days=420),
                target_completion_date=TODAY + timedelta(days=330), project_manager=pm_name, status="IN_PROGRESS", cover_image_url=cover)
    db.add(p)
    db.commit()
    db.refresh(p)
    rows, prev = [], {}
    for i, (title, tower, start, dur, progress) in enumerate(plan):
        s0 = TODAY + timedelta(days=start)
        e0 = s0 + timedelta(days=dur)
        status = "COMPLETED" if progress >= 100 else "IN_PROGRESS" if progress > 0 else "NOT_STARTED"
        a = Activity(project_id=p.id, name=title, tower=tower, phase="Superstructure", planned_duration=dur, start_date=s0, end_date=e0,
                     baseline_start_date=s0, baseline_end_date=e0, progress_percent=float(progress), status=status, sort_order=i,
                     actual_start_date=s0 if progress > 0 else None, actual_end_date=e0 if progress >= 100 else None)
        db.add(a)
        db.flush()
        if tower in prev:
            db.add(ActivityDependency(project_id=p.id, predecessor_id=prev[tower].id, successor_id=a.id, dependency_type="FS", lag_days=0))
        prev[tower] = a
        rows.append(a)
    db.commit()
    for category, description, contains, tower, opened_ago, resolved_ago, status, confirmed in problems:
        target = next(r for r in rows if contains in r.name and (tower is None or r.tower == tower))
        b = Blocker(project_id=p.id, activity_id=target.id, category=category, description=description, severity="HIGH",
                    opened_date=TODAY - timedelta(days=opened_ago), status="RESOLVED" if resolved_ago is not None else "OPEN",
                    resolved_date=TODAY - timedelta(days=resolved_ago) if resolved_ago is not None else None,
                    hindrance_state="RESOLVED" if resolved_ago is not None else "ACTIVE_HINDRANCE", impact_status=status)
        if confirmed:
            b.confirmed_delay_days, b.confirmed_project_delay_days = confirmed
        db.add(b)
        db.flush()
        refresh_proposal(db, b)
        b.impact_status = status
    if pending_task:
        db.add(Task(project_id=p.id, tower=plan[0][1], title=pending_task[0], is_unplanned=True, unplanned_reason=pending_task[1],
                    status="PENDING_APPROVAL", planned_days=3))
    db.commit()
    for email in (PM, EXEC):
        member(db, p.id, email)
    print(f"created extra project {name}")


def retire_placeholder_projects(db):
    """Earlier versions of this script made two generic demo projects; archive them (nothing is deleted)."""
    for code in ("PRJ-SKYLINE", "PRJ-TECHPARK"):
        old = db.query(Project).filter(Project.code == code, Project.status != "ARCHIVED").first()
        if old:
            old.status = "ARCHIVED"
            db.commit()
            print(f"archived placeholder project {old.name}")


def seed_extra_projects(db):
    retire_placeholder_projects(db)
    finishing = [("BLOCKWORK", -20, 90, 25), ("INTERNAL PLASTER (GYPSUM)", 10, 80, 0), ("PLUMBING WORK", 20, 90, 0)]
    extra_project(
        db, "PRJ-41-AVENTIS", "41 Aventis", "Tathawade, Pune", "Priya Kulkarni", "/projects/41-aventis.jpg",
        tower_plan("Tower A", 12, 8, 55, finishing=finishing) + tower_plan("Tower B", 12, 6, 30),
        [("Weather", "Monsoon delayed the podium waterproofing", "SUB- STRUCTURE", "Tower A", 160, 150, "NO_IMPACT", None)],
    )
    extra_project(
        db, "PRJ-41-WESTWORLD", "41 Westworld", "Balewadi, Pune", "Amit Deshmukh", "/projects/41-westworld.jpg",
        tower_plan("Tower A", 16, 5, 40, lag=24) + tower_plan("Tower B", 16, 3, 20, lag=21),
        [("Material not available", "Steel supply short by 80 tonnes", "SLAB (3RD FLOOR)", "Tower A", 40, None, "CONFIRMED", (12.0, 9.0)),
         ("Drawing or design approval pending", "Revised slab detail awaiting consultant approval", "SLAB (2ND FLOOR)", "Tower B", 8, None, "PROPOSED", None)],
        pending_task=("Additional dewatering for the basement", "Groundwater higher than the soil report assumed"),
    )
    extra_project(
        db, "PRJ-41-LUXOVERTS", "41 Luxoverts", "Tathawade, Pune", "Priya Kulkarni", "/projects/41-luxoverts.jpg",
        tower_plan("Tower A", 14, 2, 50) + tower_plan("Tower B", 14, 0, 60) + tower_plan("Tower C", 14, 0, 0),
        [],
    )
    # give every demo project a photo slot (the file itself is added by the team)
    for code, cover in (("PRJ-41ZOY-PLUS", "/projects/41-zoy-plus.webp"),):
        proj = db.query(Project).filter(Project.code == code, Project.cover_image_url.is_(None)).first()
        if proj:
            proj.cover_image_url = cover
            db.commit()


def touch_up_demo(db, project):
    """Make the sample look lived-in: some items have been waiting a few days, some notifications are already read."""
    now = datetime.utcnow()
    for task in db.query(Task).filter(Task.project_id == project.id, Task.status.in_(["PENDING_APPROVAL", "BLOCKED"])).all():
        wanted = now - timedelta(days=3 if task.status == "PENDING_APPROVAL" else 4)
        if task.updated_at and task.updated_at > wanted:
            db.query(Task).filter(Task.id == task.id).update({"updated_at": wanted})
    db.commit()
    backfill_open_items(db)
    notes = db.query(Notification).order_by(Notification.id).all()
    for i, n in enumerate(notes):
        if n.created_at and n.created_at > now - timedelta(hours=2):  # spread them over the last day or two
            n.created_at = now - timedelta(minutes=45 * (len(notes) - i))
        if i < len(notes) // 3 and n.read_at is None:
            n.read_at = n.created_at + timedelta(minutes=20)
    db.commit()
    print(f"notifications: {len(notes)} (older ones marked read)")


def main():
    with SessionLocal() as db:
        ensure_users(db)
        project = ensure_project(db)
        if db.query(Task).filter(Task.project_id == project.id).count() == 0:
            seed_tasks(db, project)
            seed_unplanned(db, project.id)
            seed_problems(db, project.id)
        else:
            print("41 ZOY+ already has tasks; leaving the sample data as it is")
        seed_extra_projects(db)
        touch_up_demo(db, project)
    print("done")


if __name__ == "__main__":
    main()
