"""Planned sequence (what is ready, what is waiting), tasks in plan order, and the director's portfolio."""
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, ActivityDependency, Blocker, Project, Task
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, EXEC, SM, ADMIN = "pm@construction.ai", "eng@construction.ai", "exec@construction.ai", "sm@construction.ai", "admin@construction.ai"
TODAY = date.today()


def _act(pid, name, offset, tower="Tower A", status="NOT_STARTED", progress=0.0, dur=5, actual_start=None):
    return Activity(project_id=pid, name=name, tower=tower, phase="Superstructure", planned_duration=dur, status=status,
                    progress_percent=progress, actual_start_date=actual_start, sort_order=offset,
                    start_date=TODAY + timedelta(days=offset), end_date=TODAY + timedelta(days=offset + dur))


def _dep(pid, a, b, kind="FS", lag=0):
    return ActivityDependency(project_id=pid, predecessor_id=a.id, successor_id=b.id, dependency_type=kind, lag_days=lag)


@pytest.fixture()
def plan():
    """done -> runs -> next (FS), runs -> side (SS), runs -> tail (FF), next -> after (FS); plus one on Tower B."""
    db = SessionLocal()
    p = Project(name="Sequence Test", code=f"SEQ-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=TODAY, target_completion_date=TODAY + timedelta(days=300))
    db.add(p)
    db.commit()
    db.refresh(p)
    done = _act(p.id, "Foundation", -30, status="COMPLETED", progress=100.0, actual_start=TODAY - timedelta(days=30))
    runs = _act(p.id, "Podium slab", -5, status="IN_PROGRESS", progress=40.0, actual_start=TODAY - timedelta(days=5))
    nxt = _act(p.id, "First floor slab", 2)
    side = _act(p.id, "Ramp works", 3)
    tail = _act(p.id, "Slab curing", 4)
    after = _act(p.id, "Second floor slab", 10)
    tb = _act(p.id, "Tower B slab", 1, tower="Tower B")
    db.add_all([done, runs, nxt, side, tail, after, tb])
    db.commit()
    for a in (done, runs, nxt, side, tail, after, tb):
        db.refresh(a)
    db.add_all([_dep(p.id, done, runs), _dep(p.id, runs, nxt), _dep(p.id, runs, side, "SS"), _dep(p.id, runs, tail, "FF"),
                _dep(p.id, nxt, after)])
    db.commit()
    for email in (PM, EXEC, SM):
        grant_membership(db, p.id, email, "ALL")
    grant_membership(db, p.id, ENG, "Tower A")
    out = {"pid": p.id, **{k: v.id for k, v in dict(done=done, runs=runs, nxt=nxt, side=side, tail=tail, after=after, tb=tb).items()}}
    db.close()
    return out


def _seq(plan, email=PM):
    res = client.get(f"/api/projects/{plan['pid']}/sequence", headers=auth_headers(email))
    assert res.status_code == 200, res.text
    return {i["activity_id"]: i for i in res.json()}, res.json()


def test_sequence_is_in_plan_order_and_marks_what_is_ready(plan):
    by_id, ordered = _seq(plan)
    assert [i["step"] for i in ordered] == list(range(1, len(ordered) + 1))
    names = [i["name"] for i in ordered]
    assert names.index("Foundation") < names.index("Podium slab") < names.index("First floor slab") < names.index("Second floor slab")

    assert by_id[plan["done"]]["state"] == "DONE"
    assert by_id[plan["runs"]]["state"] == "IN_PROGRESS"
    # finish-to-start: the first floor slab waits for the podium slab to finish
    assert by_id[plan["nxt"]]["state"] == "WAITING" and by_id[plan["nxt"]]["waiting_on"] == ["Podium slab"]
    # start-to-start: the ramp can begin because the podium slab has started
    assert by_id[plan["side"]]["state"] == "READY" and by_id[plan["side"]]["waiting_on"] == []
    # finish-to-finish never holds back a start
    assert by_id[plan["tail"]]["state"] == "READY"
    # chained: the second floor waits for the first floor, not for the podium
    assert by_id[plan["after"]]["waiting_on"] == ["First floor slab"]
    # no predecessors at all means ready
    assert by_id[plan["tb"]]["state"] == "READY"
    assert by_id[plan["nxt"]]["predecessors"][0] == {"id": plan["runs"], "name": "Podium slab", "type": "FS", "lag_days": 0, "done": False}


def test_sequence_follows_progress_and_respects_tower_scope(plan):
    db = SessionLocal()
    db.query(Activity).filter(Activity.id == plan["runs"]).update({"status": "COMPLETED", "progress_percent": 100.0})
    db.commit()
    db.close()
    by_id, _ = _seq(plan)
    assert by_id[plan["nxt"]]["state"] == "READY"                       # its predecessor finished

    mine, _ = _seq(plan, ENG)                                            # engineer on Tower A only
    assert plan["tb"] not in mine and plan["nxt"] in mine


def test_tasks_are_listed_in_plan_order_with_what_they_wait_for(plan):
    def make(key, title):
        r = client.post(f"/api/projects/{plan['pid']}/tasks", json={"title": title, "activity_id": plan[key]}, headers=auth_headers(PM))
        assert r.status_code == 201, r.text
        return r.json()

    late = make("after", "Pour second floor")          # created first, but later in the plan
    early = make("runs", "Pour podium")
    unplanned = client.post(f"/api/projects/{plan['pid']}/tasks", headers=auth_headers(PM),
                            json={"title": "Extra wall", "is_unplanned": True, "unplanned_reason": "Client change", "tower": "Tower A"}).json()
    tasks = client.get(f"/api/projects/{plan['pid']}/tasks", headers=auth_headers(PM)).json()
    assert [t["id"] for t in tasks] == [early["id"], late["id"], unplanned["id"]]
    assert tasks[0]["sequence_step"] < tasks[1]["sequence_step"] and tasks[2]["sequence_step"] is None
    assert tasks[1]["waiting_on"] == ["First floor slab"] and tasks[0]["waiting_on"] == []


def test_a_task_waiting_in_the_plan_can_still_be_created_and_started(plan):
    """The sequence is guidance, not a lock: site reality sometimes runs ahead of the plan."""
    r = client.post(f"/api/projects/{plan['pid']}/tasks", json={"title": "Early start", "activity_id": plan["after"]}, headers=auth_headers(PM))
    assert r.status_code == 201 and r.json()["waiting_on"] == ["First floor slab"]


# ----------------------------------------------------------------------- portfolio

def _project(name, status="IN_PROGRESS"):
    db = SessionLocal()
    p = Project(name=name, code=f"PF-{uuid.uuid4().hex[:6]}", construction_type="Commercial", location="Pune", built_up_area=1.0,
                planned_start_date=TODAY - timedelta(days=100), target_completion_date=TODAY + timedelta(days=200), status=status)
    db.add(p)
    db.commit()
    db.refresh(p)
    pid = p.id
    db.close()
    return pid


def test_director_sees_only_projects_they_belong_to_with_summary_numbers(plan):
    other = _project("Director Other Project")
    hidden = _project("Not For This Director")
    archived = _project("Old Archived Project", status="ARCHIVED")
    db = SessionLocal()
    db.add_all([_act(other, "Done work", -20, status="COMPLETED", progress=100.0, dur=10),
                _act(other, "Overdue work", -30, progress=50.0, dur=10)])    # planned finish passed: late
    db.add(Blocker(project_id=other, category="Weather", description="Rain", severity="LOW", opened_date=TODAY, status="OPEN",
                   impact_status="CONFIRMED", confirmed_delay_days=4.0, confirmed_project_delay_days=3.0))
    db.commit()
    for pid in (other, archived):
        grant_membership(db, pid, EXEC, "ALL")
    db.close()

    res = client.get("/api/portfolio", headers=auth_headers(EXEC))
    assert res.status_code == 200
    by_id = {p["id"]: p for p in res.json()}
    assert plan["pid"] in by_id and other in by_id
    assert hidden not in by_id and archived not in by_id               # not a member / archived

    o = by_id[other]
    assert o["activities"] == 2 and o["late_activities"] == 1 and o["progress_percent"] == 75.0
    assert o["open_problems"] == 1 and o["largest_confirmed_project_delay_days"] == 3.0
    assert o["pending_approvals"] == 0                                   # directors do not approve

    assert by_id[plan["pid"]]["late_activities"] == 0
    assert {p["id"] for p in client.get("/api/portfolio", headers=auth_headers(SM)).json()} >= {plan["pid"]}
    assert hidden in {p["id"] for p in client.get("/api/portfolio", headers=auth_headers(ADMIN)).json()}   # admin sees all


def test_portfolio_requires_login():
    assert client.get("/api/portfolio").status_code == 401


def test_portfolio_counts_pending_approvals_for_the_pm(plan):
    t = client.post(f"/api/projects/{plan['pid']}/tasks", headers=auth_headers(ENG),
                    json={"title": "Extra", "is_unplanned": True, "unplanned_reason": "Client change", "tower": "Tower A"}).json()
    client.post(f"/api/tasks/{t['id']}/submit", json={}, headers=auth_headers(ENG))
    mine = {p["id"]: p for p in client.get("/api/portfolio", headers=auth_headers(PM)).json()}
    assert mine[plan["pid"]]["pending_approvals"] >= 1


def test_negative_lags_are_leads_not_waits():
    """MSP 'FS-5 days' lets the next slab start before the last one finishes; 'SS-10 days' means do it before the other starts."""
    db = SessionLocal()
    p = Project(name="Lead Test", code=f"LEAD-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=TODAY, target_completion_date=TODAY + timedelta(days=100))
    db.add(p)
    db.commit()
    db.refresh(p)
    slab_a = _act(p.id, "Slab A", -10, status="IN_PROGRESS", progress=70.0, dur=12, actual_start=TODAY - timedelta(days=10))  # ends in 2 days
    slab_b = _act(p.id, "Slab B", 0, dur=10)
    far = _act(p.id, "Slab far from done", 5, dur=40)
    slab_c = _act(p.id, "Slab C", 8, dur=10)
    delivery = _act(p.id, "Material delivery", -3, dur=1)
    nxt = _act(p.id, "Mock-up slab", 7, dur=10)
    db.add_all([slab_a, slab_b, far, slab_c, delivery, nxt])
    db.commit()
    for x in (slab_a, slab_b, far, slab_c, delivery, nxt):
        db.refresh(x)
    db.add_all([_dep(p.id, slab_a, slab_b, "FS", -5),      # may start 5 working days (about 6 calendar) before Slab A ends: reached
                _dep(p.id, slab_a, slab_c, "FS", 0),       # normal finish-to-start: must wait
                _dep(p.id, nxt, delivery, "SS", -10)])     # delivery is scheduled before the mock-up slab starts
    # 'far' ends in 45 days, so a 5-day lead is not reached yet
    far.end_date = TODAY + timedelta(days=45)
    db.add(_dep(p.id, far, slab_c, "FS", -5))
    db.commit()
    pid, b_id, c_id, d_id = p.id, slab_b.id, slab_c.id, delivery.id
    grant_membership(db, pid, PM, "ALL")
    db.close()
    by_id = {i["activity_id"]: i for i in client.get(f"/api/projects/{pid}/sequence", headers=auth_headers(PM)).json()}
    assert by_id[b_id]["state"] == "READY"            # FS-5 lead reached (Slab A ends in 2 days)
    assert by_id[c_id]["state"] == "WAITING" and "Slab A" in by_id[c_id]["waiting_on"] and "Slab far from done" in by_id[c_id]["waiting_on"]
    assert by_id[d_id]["state"] == "READY"            # SS-10 never makes the delivery wait for the mock-up slab
