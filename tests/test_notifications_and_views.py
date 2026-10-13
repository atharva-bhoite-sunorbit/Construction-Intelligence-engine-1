"""Notifications, the PM action inbox, the activity detail and the weekly digest."""
import uuid
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, ActivityDependency, Blocker, Notification, Project, Task, User
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, EXEC, SM, ADMIN = "pm@construction.ai", "eng@construction.ai", "exec@construction.ai", "sm@construction.ai", "admin@construction.ai"
TODAY = date.today()


def _act(pid, name, start, dur=10, tower="Tower A", status="NOT_STARTED", progress=0.0, **kw):
    return Activity(project_id=pid, name=name, tower=tower, phase="Superstructure", planned_duration=dur, status=status,
                    progress_percent=progress, start_date=TODAY + timedelta(days=start), end_date=TODAY + timedelta(days=start + dur), **kw)


@pytest.fixture()
def world():
    db = SessionLocal()
    p = Project(name="Views Test", code=f"VW-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune", built_up_area=1.0,
                planned_start_date=TODAY - timedelta(days=60), target_completion_date=TODAY + timedelta(days=200), status="IN_PROGRESS")
    db.add(p)
    db.commit()
    db.refresh(p)
    done = _act(p.id, "Foundation", -50, status="COMPLETED", progress=100.0, actual_start_date=TODAY - timedelta(days=50),
                actual_end_date=TODAY - timedelta(days=3), baseline_start_date=TODAY - timedelta(days=50), baseline_end_date=TODAY - timedelta(days=10))
    late = _act(p.id, "Podium slab", -20, dur=10, status="IN_PROGRESS", progress=40.0, actual_start_date=TODAY - timedelta(days=20), is_critical=True)  # ended 10 days ago
    nxt = _act(p.id, "First floor slab", -5, dur=10)                          # should have started 5 days ago, waits for the podium slab
    other = _act(p.id, "Tower B slab", 5, tower="Tower B")
    db.add_all([done, late, nxt, other])
    db.commit()
    for a in (done, late, nxt, other):
        db.refresh(a)
    db.add_all([ActivityDependency(project_id=p.id, predecessor_id=done.id, successor_id=late.id, dependency_type="FS", lag_days=0),
                ActivityDependency(project_id=p.id, predecessor_id=late.id, successor_id=nxt.id, dependency_type="FS", lag_days=0)])
    db.commit()
    for email in (PM, SM, EXEC):
        grant_membership(db, p.id, email, "ALL")
    grant_membership(db, p.id, ENG, "Tower A")
    out = {"pid": p.id, "done": done.id, "late": late.id, "nxt": nxt.id, "other": other.id}
    db.close()
    return out


def _mine(email, kind=None):
    items = client.get("/api/notifications?limit=100", headers=auth_headers(email)).json()["items"]
    return [n for n in items if kind is None or n["kind"] == kind]


def _unplanned(world, email=ENG):
    r = client.post(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(email),
                    json={"title": "Extra wall", "is_unplanned": True, "unplanned_reason": "Client change", "tower": "Tower A"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _count(email, world, kind):
    return len([n for n in _mine(email, kind) if n["project_id"] == world["pid"]])


# ----------------------------------------------------------------------- notifications

def test_approval_flow_notifies_the_right_people(world):
    tid = _unplanned(world)
    client.post(f"/api/tasks/{tid}/submit", json={}, headers=auth_headers(ENG))
    assert _count(PM, world, "APPROVAL_NEEDED") == 1 and _count(ADMIN, world, "APPROVAL_NEEDED") == 1
    assert _count(ENG, world, "APPROVAL_NEEDED") == 0 and _count(EXEC, world, "APPROVAL_NEEDED") == 0   # not the author, not a director
    n = _mine(PM, "APPROVAL_NEEDED")[0]
    assert n["entity_type"] == "task" and n["entity_id"] == tid and "Extra wall" in n["title"]

    client.post(f"/api/tasks/{tid}/approve", json={}, headers=auth_headers(PM))
    assert _count(ENG, world, "TASK_APPROVED") == 1 and _count(PM, world, "TASK_APPROVED") == 0

    t2 = _unplanned(world)
    client.post(f"/api/tasks/{t2}/submit", json={}, headers=auth_headers(ENG))
    client.post(f"/api/tasks/{t2}/reject", json={"reason": "Already in scope"}, headers=auth_headers(PM))
    sent_back = [n for n in _mine(ENG, "TASK_REJECTED") if n["entity_id"] == t2]
    assert sent_back and sent_back[0]["body"] == "Already in scope"


def test_problem_flow_notifies_pm_reporter_and_director(world):
    body = {"category": "Material not available", "description": "Rebar late", "activity_id": world["late"],
            "expected_resolution": (TODAY + timedelta(days=7)).isoformat()}
    pid = client.post(f"/api/projects/{world['pid']}/problems", json=body, headers=auth_headers(ENG)).json()["id"]
    assert _count(PM, world, "PROBLEM_REPORTED") == 1 and _count(ENG, world, "PROBLEM_REPORTED") == 0
    assert _count(EXEC, world, "PROBLEM_REPORTED") == 0

    client.post(f"/api/problems/{pid}/resolve", json={}, headers=auth_headers(ENG))
    resolved = [n for n in _mine(PM, "PROBLEM_RESOLVED") if n["entity_id"] == pid]
    assert resolved and "cost any time" in resolved[0]["body"]

    client.post(f"/api/problems/{pid}/impact", json={"decision": "CONFIRM", "days": 6, "project_days": 4}, headers=auth_headers(PM))
    verdict = [n for n in _mine(ENG, "IMPACT_DECIDED") if n["entity_id"] == pid]
    assert verdict and "6 working days" in verdict[0]["body"]
    assert any(n["entity_id"] == pid for n in _mine(EXEC, "DELAY_CONFIRMED"))          # the project end moves: the director hears

    quiet = client.post(f"/api/projects/{world['pid']}/problems", json={**body, "category": "Weather"}, headers=auth_headers(ENG)).json()["id"]
    client.post(f"/api/problems/{quiet}/impact", json={"decision": "CONFIRM", "days": 2, "project_days": 0}, headers=auth_headers(PM))
    assert not any(n["entity_id"] == quiet for n in _mine(EXEC, "DELAY_CONFIRMED"))    # absorbed by float: no director alert


def test_notification_api_read_state_and_privacy(world):
    client.post(f"/api/tasks/{_unplanned(world)}/submit", json={}, headers=auth_headers(ENG))
    data = client.get("/api/notifications", headers=auth_headers(PM)).json()
    assert data["unread_count"] >= 1 and data["items"][0]["read"] is False
    first = data["items"][0]["id"]

    assert client.post(f"/api/notifications/{first}/read", headers=auth_headers(ENG)).status_code == 404   # someone else's
    assert client.post(f"/api/notifications/{first}/read", headers=auth_headers(PM)).json()["read"] is True
    assert client.get("/api/notifications", headers=auth_headers(PM)).json()["unread_count"] == data["unread_count"] - 1

    after = client.post("/api/notifications/read-all", headers=auth_headers(PM)).json()
    assert after["unread_count"] == 0
    assert client.get("/api/notifications?unread_only=true", headers=auth_headers(PM)).json()["items"] == []


def test_backfill_tells_approvers_about_open_items_once(world):
    from backend.app.services.notifications import backfill_open_items

    db = SessionLocal()
    t = Task(project_id=world["pid"], tower="Tower A", title="Old pending", is_unplanned=True, unplanned_reason="x", status="PENDING_APPROVAL", planned_days=1)
    db.add(t)
    db.commit()
    first = backfill_open_items(db)
    second = backfill_open_items(db)
    db.close()
    assert first >= 1 and second == 0
    assert any(n["title"] == "Approval needed: Old pending" for n in _mine(PM))


# ----------------------------------------------------------------------- PM action inbox

def test_pm_inbox_lists_what_needs_action_most_urgent_first(world):
    tid = _unplanned(world)
    client.post(f"/api/tasks/{tid}/submit", json={}, headers=auth_headers(ENG))
    db = SessionLocal()
    db.query(Task).filter(Task.id == tid).update({"updated_at": datetime.utcnow() - timedelta(days=4)})   # waiting 4 days
    db.commit()
    db.close()
    client.post(f"/api/projects/{world['pid']}/problems", headers=auth_headers(ENG),
                json={"category": "Equipment unavailable", "description": "Crane down", "activity_id": world["late"], "severity": "HIGH"})

    items = client.get(f"/api/projects/{world['pid']}/attention", headers=auth_headers(PM)).json()
    kinds = [i["kind"] for i in items]
    assert {"APPROVAL", "PROBLEM_REVIEW", "LATE_ACTIVITY", "SHOULD_HAVE_STARTED"} <= set(kinds)
    assert items[0]["severity"] == "high"
    assert [i["severity"] for i in items] == sorted((i["severity"] for i in items), key=lambda s: {"high": 0, "medium": 1, "low": 2}[s])

    by_kind = {i["kind"]: i for i in items}
    assert by_kind["APPROVAL"]["tab"] == "tasks" and by_kind["APPROVAL"]["entity_id"] == tid and by_kind["APPROVAL"]["days"] == 4
    assert by_kind["PROBLEM_REVIEW"]["tab"] == "problems" and by_kind["PROBLEM_REVIEW"]["entity_type"] == "problem"
    assert by_kind["LATE_ACTIVITY"]["entity_id"] == world["late"] and by_kind["LATE_ACTIVITY"]["days"] == 10 and by_kind["LATE_ACTIVITY"]["severity"] == "high"
    assert "waiting for Podium slab" in by_kind["SHOULD_HAVE_STARTED"]["detail"]


def test_inbox_empty_for_site_roles_and_only_escalations_for_directors(world):
    assert client.get(f"/api/projects/{world['pid']}/attention", headers=auth_headers(ENG)).json() == []
    tid = _unplanned(world)
    client.post(f"/api/tasks/{tid}/submit", json={}, headers=auth_headers(ENG))       # sent today
    director = client.get(f"/api/projects/{world['pid']}/attention", headers=auth_headers(EXEC)).json()
    assert all(i["kind"] != "APPROVAL" for i in director)                              # too fresh to bother the director
    assert any(i["kind"] == "LATE_ACTIVITY" for i in director)                         # but late work is shown
    assert all(i["kind"] not in ("BLOCKED_TASK", "SHOULD_HAVE_STARTED") for i in director)

    db = SessionLocal()
    db.query(Task).filter(Task.id == tid).update({"updated_at": datetime.utcnow() - timedelta(days=5)})
    db.commit()
    db.close()
    assert any(i["kind"] == "APPROVAL" for i in client.get(f"/api/projects/{world['pid']}/attention", headers=auth_headers(EXEC)).json())


# ----------------------------------------------------------------------- activity detail + digest

def test_activity_detail_puts_one_activity_in_context(world):
    t = client.post(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(PM), json={"title": "Pour", "activity_id": world["late"], "planned_days": 4}).json()
    client.post(f"/api/projects/{world['pid']}/problems", headers=auth_headers(PM),
                json={"category": "Weather", "description": "Rain", "activity_id": world["late"]})
    d = client.get(f"/api/activities/{world['late']}/detail", headers=auth_headers(PM)).json()
    assert d["name"] == "Podium slab" and d["is_critical"] and d["state"] == "IN_PROGRESS" and d["step"] == 2
    assert [p["name"] for p in d["predecessors"]] == ["Foundation"] and d["predecessors"][0]["done"] is True
    assert [s["name"] for s in d["successors"]] == ["First floor slab"] and d["successors"][0]["state"] == "WAITING"
    assert [x["title"] for x in d["tasks"]] == ["Pour"] and d["tasks"][0]["id"] == t["id"]
    assert d["problems"][0]["category"] == "Weather"

    done = client.get(f"/api/activities/{world['done']}/detail", headers=auth_headers(PM)).json()
    assert done["finish_variance_days"] == -30      # current plan ends 30 days before the baseline end (ahead of baseline)


def test_activity_detail_respects_tower_scope(world):
    assert client.get(f"/api/activities/{world['other']}/detail", headers=auth_headers(ENG)).status_code == 403
    assert client.get(f"/api/activities/{world['other']}/detail", headers=auth_headers(PM)).status_code == 200
    assert client.get("/api/activities/99999999/detail", headers=auth_headers(PM)).status_code in (403, 404)


def test_digest_counts_recent_work_and_shows_expected_finish(world):
    tid = client.post(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(PM), json={"title": "Pour", "activity_id": world["late"]}).json()["id"]
    for c in client.get(f"/api/tasks/{tid}/checks", headers=auth_headers(PM)).json():
        client.post(f"/api/tasks/{tid}/checks/{c['id']}", json={"passed": True}, headers=auth_headers(PM))
    client.post(f"/api/tasks/{tid}/start", json={"on_date": (TODAY - timedelta(days=2)).isoformat()}, headers=auth_headers(PM))
    client.post(f"/api/tasks/{tid}/complete", json={"on_date": TODAY.isoformat()}, headers=auth_headers(PM))
    t = _unplanned(world)
    client.post(f"/api/tasks/{t}/submit", json={}, headers=auth_headers(ENG))
    client.post(f"/api/tasks/{t}/approve", json={}, headers=auth_headers(PM))
    pr = client.post(f"/api/projects/{world['pid']}/problems", headers=auth_headers(ENG),
                     json={"category": "Weather", "description": "Rain", "activity_id": world["late"], "expected_resolution": (TODAY + timedelta(days=7)).isoformat()}).json()["id"]
    client.post(f"/api/problems/{pr}/impact", json={"decision": "CONFIRM", "days": 5, "project_days": 3}, headers=auth_headers(PM))

    d = client.get(f"/api/projects/{world['pid']}/digest?days=7", headers=auth_headers(EXEC)).json()
    assert d["tasks_finished"] == 1 and d["tasks_started"] == 1 and d["approvals_decided"] == 1
    assert d["problems_reported"] == 1 and d["problems_resolved"] == 0
    assert d["recent_finished"][0]["title"] == "Pour"
    assert d["delay_confirmed_this_period_days"] == 3.0 and d["confirmed_project_delay_days"] == 3.0
    planned = date.fromisoformat(d["planned_finish"])
    assert date.fromisoformat(d["expected_finish"]) == planned + timedelta(days=3)

    narrow = client.get(f"/api/projects/{world['pid']}/digest?days=1", headers=auth_headers(EXEC)).json()
    assert narrow["tasks_started"] == 0                                  # started two days ago: outside a one-day window
