"""Problems (blockers): reporting, system-proposed impact, PM-confirmed delay, resolution, scope."""
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, ActivityDependency, AuditLog, Blocker, Project
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, SM, EXEC = "pm@construction.ai", "eng@construction.ai", "sm@construction.ai", "exec@construction.ai"
CAT = "Material not available"


def _act(pid, name, tower, critical, free_float, total_float):
    return Activity(project_id=pid, name=name, tower=tower, phase="Superstructure", planned_duration=10,
                    start_date=date.today(), end_date=date.today() + timedelta(days=9), is_critical=critical,
                    free_float=free_float, total_float=total_float)


@pytest.fixture()
def world():
    """Critical chain A -> B (Tower A), a non-critical activity C with 20 days float (Tower A), and a Tower B activity."""
    db = SessionLocal()
    p = Project(name="Problems", code=f"PRB-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=date(2026, 1, 1), target_completion_date=date(2027, 1, 1))
    db.add(p)
    db.commit()
    db.refresh(p)
    a = _act(p.id, "Critical slab", "Tower A", True, 0, 0)
    b = _act(p.id, "Next slab", "Tower A", True, 0, 0)
    c = _act(p.id, "Side works", "Tower A", False, 20, 20)
    d = _act(p.id, "Later finishing", "Tower A", False, 20, 20)
    tb = _act(p.id, "Tower B slab", "Tower B", False, 0, 0)
    db.add_all([a, b, c, d, tb])
    db.commit()
    for x in (a, b, c, d, tb):
        db.refresh(x)
    db.add_all([ActivityDependency(project_id=p.id, predecessor_id=a.id, successor_id=b.id, dependency_type="FS", lag_days=0),
                ActivityDependency(project_id=p.id, predecessor_id=c.id, successor_id=d.id, dependency_type="FS", lag_days=0)])
    db.commit()
    grant_membership(db, p.id, PM, "ALL")
    grant_membership(db, p.id, SM, "ALL")
    grant_membership(db, p.id, EXEC, "ALL")   # directors belong to projects too
    grant_membership(db, p.id, ENG, "Tower A")
    out = {"pid": p.id, "a": a.id, "b": b.id, "c": c.id, "d": d.id, "tb": tb.id}
    db.close()
    return out


def _running_task(world, key, email=ENG):
    task = client.post(f"/api/projects/{world['pid']}/tasks", json={"title": "Work", "activity_id": world[key]},
                       headers=auth_headers(email)).json()
    for c in client.get(f"/api/tasks/{task['id']}/checks", headers=auth_headers(email)).json():
        client.post(f"/api/tasks/{task['id']}/checks/{c['id']}", json={"passed": True}, headers=auth_headers(email))
    started = client.post(f"/api/tasks/{task['id']}/start", json={}, headers=auth_headers(email))
    assert started.status_code == 200, started.text
    return task["id"]


def _report(world, email=ENG, days=7, **extra):
    body = {"category": CAT, "description": "Rebar delivery is late", "owner": "Purchase team",
            "expected_resolution": (date.today() + timedelta(days=days)).isoformat(), **extra}
    return client.post(f"/api/projects/{world['pid']}/problems", json=body, headers=auth_headers(email))


def _task_status(task_id):
    return client.get(f"/api/tasks/{task_id}", headers=auth_headers(PM)).json()["status"]


def _summary(world, email=PM):
    return client.get(f"/api/projects/{world['pid']}/delay-summary", headers=auth_headers(email)).json()


# ----------------------------------------------------------------------- reporting + proposal

def test_problem_on_a_running_task_blocks_it_and_gets_a_system_estimate(world):
    tid = _running_task(world, "a")
    res = _report(world, task_id=tid)
    assert res.status_code == 201, res.text
    p = res.json()
    assert p["activity_name"] == "Critical slab" and p["tower"] == "Tower A" and p["task_id"] == tid
    assert p["status"] == "OPEN" and p["owner"] == "Purchase team" and p["opened_date"] == date.today().isoformat()
    assert _task_status(tid) == "BLOCKED"

    # 7 calendar days is 6 working days. Critical activity: the whole delay reaches the project end.
    assert p["impact_status"] == "PROPOSED" and p["needs_review"]
    assert p["proposed_delay_days"] == 6.0 and p["proposed_project_delay_days"] == 6.0
    assert p["proposed_on_critical_path"] is True
    assert "Critical slab" in p["proposal_note"] and "1 later activity" in p["proposal_note"] and "critical path" in p["proposal_note"]
    assert p["confirmed_delay_days"] is None                 # nothing is confirmed until the PM says so


def test_float_absorbs_delay_on_a_non_critical_activity(world):
    tid = _running_task(world, "c")
    p = _report(world, task_id=tid).json()
    assert p["proposed_delay_days"] == 6.0
    assert p["proposed_project_delay_days"] == 0.0 and p["proposed_on_critical_path"] is False
    assert "float absorbs" in p["proposal_note"]


def test_reported_problem_is_not_delay_until_the_pm_confirms(world):
    _report(world, activity_id=world["a"])
    summary = _summary(world)
    assert summary["open_problems"] == 1 and summary["waiting_for_review"] == 1
    assert summary["confirmed_problems"] == 0 and summary["largest_confirmed_project_delay_days"] == 0
    assert summary["unconfirmed"][0]["proposed_project_delay_days"] == 6.0   # shown, but labelled unconfirmed


def test_validation_rules(world):
    assert _report(world, activity_id=world["a"], category="Bad weather and bad luck").status_code == 422
    assert _report(world).status_code == 422                                    # engineer must name a task or activity
    assert _report(world, activity_id=world["a"], severity="EXTREME").status_code == 422
    draft = client.post(f"/api/projects/{world['pid']}/tasks", json={"title": "Not started", "activity_id": world["a"]},
                        headers=auth_headers(ENG)).json()
    assert _report(world, task_id=draft["id"]).status_code == 409               # only a running task can be held up
    assert _report(world, task_id=99999999).status_code == 404
    assert client.get("/api/problem-categories", headers=auth_headers(ENG)).json()[0] == CAT


def test_project_wide_problem_is_pm_only_and_needs_manual_impact(world):
    assert _report(world, email=ENG).status_code == 422
    res = _report(world, email=PM)
    assert res.status_code == 201
    p = res.json()
    assert p["activity_id"] is None and p["proposed_delay_days"] is None and p["impact_status"] == "NOT_ASSESSED"
    pid = p["id"]
    assert client.post(f"/api/problems/{pid}/impact", json={"decision": "CONFIRM"}, headers=auth_headers(PM)).status_code == 422
    ok = client.post(f"/api/problems/{pid}/impact", json={"decision": "CONFIRM", "days": 5, "project_days": 5}, headers=auth_headers(PM))
    assert ok.status_code == 200 and ok.json()["confirmed_project_delay_days"] == 5


# ----------------------------------------------------------------------- PM decision

def test_only_the_pm_confirms_impact_and_only_confirmed_delay_is_counted(world):
    pid = _report(world, activity_id=world["a"]).json()["id"]
    url = f"/api/problems/{pid}/impact"
    for email in (ENG, SM, EXEC):
        assert client.post(url, json={"decision": "CONFIRM"}, headers=auth_headers(email)).status_code == 403

    ok = client.post(url, json={"decision": "CONFIRM", "note": "Agreed with the planner"}, headers=auth_headers(PM))
    assert ok.status_code == 200
    p = ok.json()
    assert p["impact_status"] == "CONFIRMED" and not p["needs_review"]
    assert p["confirmed_delay_days"] == 6.0 and p["confirmed_project_delay_days"] == 6.0
    assert p["impact_decided_by_name"] and p["impact_note"] == "Agreed with the planner"

    summary = _summary(world)
    assert summary["confirmed_problems"] == 1 and summary["waiting_for_review"] == 0
    assert summary["confirmed_activity_delay_days"] == 6.0 and summary["largest_confirmed_project_delay_days"] == 6.0
    assert summary["by_category"][0] == {"category": CAT, "problems": 1, "open": 1, "confirmed_delay_days": 6.0}


def test_pm_can_adjust_the_estimate_or_say_there_is_no_impact(world):
    pid = _report(world, activity_id=world["a"]).json()["id"]
    url = f"/api/problems/{pid}/impact"
    assert client.post(url, json={"decision": "CONFIRM", "days": 3, "project_days": 4}, headers=auth_headers(PM)).status_code == 422
    adjusted = client.post(url, json={"decision": "CONFIRM", "days": 4, "project_days": 2}, headers=auth_headers(PM)).json()
    assert adjusted["confirmed_delay_days"] == 4.0 and adjusted["confirmed_project_delay_days"] == 2.0
    assert adjusted["proposed_delay_days"] == 6.0                                # the system's number is kept for the record

    none = client.post(url, json={"decision": "NO_IMPACT", "note": "Crew moved to another floor"}, headers=auth_headers(PM)).json()
    assert none["impact_status"] == "NO_IMPACT" and none["confirmed_project_delay_days"] == 0.0
    assert _summary(world)["confirmed_problems"] == 0 and _summary(world)["waiting_for_review"] == 0


# ----------------------------------------------------------------------- resolution

def test_resolving_releases_the_task_and_recomputes_the_real_held_up_time(world):
    tid = _running_task(world, "a")
    pid = _report(world, task_id=tid, days=7).json()["id"]
    client.post(f"/api/problems/{pid}/impact", json={"decision": "CONFIRM"}, headers=auth_headers(PM))

    res = client.post(f"/api/problems/{pid}/resolve", json={"note": "Rebar arrived"}, headers=auth_headers(ENG))
    assert res.status_code == 200, res.text
    p = res.json()
    assert p["status"] == "RESOLVED" and p["resolved_date"] == date.today().isoformat() and p["resolution_note"] == "Rebar arrived"
    assert _task_status(tid) == "IN_PROGRESS"                                    # work can continue
    assert p["proposed_delay_days"] == 0.0                                       # fixed the same day: nothing was lost
    assert p["confirmed_delay_days"] == 6.0 and p["estimate_changed"] is True    # PM is told the earlier number is now stale

    assert client.post(f"/api/problems/{pid}/resolve", json={}, headers=auth_headers(ENG)).status_code == 409
    other = _report(world, activity_id=world["a"]).json()["id"]
    future = (date.today() + timedelta(days=1)).isoformat()
    assert client.post(f"/api/problems/{other}/resolve", json={"on_date": future}, headers=auth_headers(ENG)).status_code == 422


def test_task_stays_blocked_while_another_problem_is_open(world):
    tid = _running_task(world, "a")
    first = _report(world, task_id=tid).json()["id"]
    second = Blocker(project_id=world["pid"], activity_id=world["a"], task_id=tid, category=CAT, description="Second issue",
                     severity="LOW", opened_date=date.today(), status="OPEN", impact_status="PROPOSED")
    db = SessionLocal()
    db.add(second)
    db.commit()
    db.close()
    client.post(f"/api/problems/{first}/resolve", json={}, headers=auth_headers(ENG))
    assert _task_status(tid) == "BLOCKED"


# ----------------------------------------------------------------------- scope + legacy + audit

def test_tower_scope(world):
    pm_problem = _report(world, email=PM, activity_id=world["tb"]).json()["id"]
    assert _report(world, activity_id=world["tb"]).status_code == 403            # engineer is Tower A only
    assert client.get(f"/api/problems/{pm_problem}", headers=auth_headers(ENG)).status_code == 403
    mine = client.get(f"/api/projects/{world['pid']}/problems", headers=auth_headers(ENG)).json()
    assert pm_problem not in [p["id"] for p in mine]
    allp = client.get(f"/api/projects/{world['pid']}/problems", headers=auth_headers(PM)).json()
    assert pm_problem in [p["id"] for p in allp]
    assert client.get(f"/api/projects/{world['pid']}/problems", headers=auth_headers(EXEC)).status_code == 200


def test_old_hindrance_reports_never_count_as_confirmed_delay(world):
    db = SessionLocal()
    db.add(Blocker(project_id=world["pid"], activity_id=world["a"], category="Weather", description="Legacy entry",
                   severity="HIGH", opened_date=date.today(), status="OPEN", delay_impact_days=9.0))
    db.commit()
    db.close()
    summary = _summary(world)
    assert summary["open_problems"] == 1 and summary["waiting_for_review"] == 1
    assert summary["confirmed_activity_delay_days"] == 0 and summary["largest_confirmed_project_delay_days"] == 0


def test_every_step_is_audited(world):
    pid = _report(world, activity_id=world["a"]).json()["id"]
    client.post(f"/api/problems/{pid}/impact", json={"decision": "CONFIRM"}, headers=auth_headers(PM))
    client.post(f"/api/problems/{pid}/resolve", json={}, headers=auth_headers(ENG))
    db = SessionLocal()
    try:
        actions = [r.action for r in db.query(AuditLog).filter(AuditLog.entity_name == "Blocker", AuditLog.entity_id == str(pid)).order_by(AuditLog.id)]
    finally:
        db.close()
    assert actions == ["PROBLEM_REPORT", "PROBLEM_IMPACT", "PROBLEM_RESOLVE"]
