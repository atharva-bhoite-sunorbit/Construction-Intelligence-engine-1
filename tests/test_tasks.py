"""Execution tasks: lifecycle, permissions, tower scope and progress roll-up that never touches the baseline."""
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, AuditLog, Project, Task
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, SM, EXEC = "pm@construction.ai", "eng@construction.ai", "sm@construction.ai", "exec@construction.ai"
BASE_START, BASE_END = date(2026, 3, 1), date(2026, 3, 20)


def _activity(project_id, name, tower, duration):
    return Activity(
        project_id=project_id, name=name, tower=tower, phase="Superstructure", planned_duration=duration,
        start_date=date(2026, 3, 2), end_date=date(2026, 3, 21), baseline_start_date=BASE_START,
        baseline_end_date=BASE_END, baseline_task_id=7, baseline_source_file="plan.xlsx",
    )


@pytest.fixture()
def world():
    db = SessionLocal()
    p = Project(name="Tasks Test", code=f"TSK-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=date(2026, 1, 1), target_completion_date=date(2027, 1, 1))
    db.add(p)
    db.commit()
    db.refresh(p)
    a12 = _activity(p.id, "Slab A (12 days)", "Tower A", 12)
    a20 = _activity(p.id, "Slab A2 (20 days)", "Tower A", 20)
    b = _activity(p.id, "Slab B", "Tower B", 5)
    db.add_all([a12, a20, b])
    db.commit()
    for a in (a12, a20, b):
        db.refresh(a)
    grant_membership(db, p.id, PM, "ALL")
    grant_membership(db, p.id, SM, "ALL")
    grant_membership(db, p.id, ENG, "Tower A")
    out = {"pid": p.id, "a12": a12.id, "a20": a20.id, "b": b.id}
    db.close()
    return out


def _create(world, email=ENG, **body):
    payload = {"title": "Pour slab", "planned_days": 1, **body}
    return client.post(f"/api/projects/{world['pid']}/tasks", json=payload, headers=auth_headers(email))


def _act(task_id, action, email=ENG, **body):
    return client.post(f"/api/tasks/{task_id}/{action}", json=body, headers=auth_headers(email))


def _ready(task_id, email=ENG):
    """Pass every readiness check on a planned task, as the site engineer would."""
    checks = client.get(f"/api/tasks/{task_id}/checks", headers=auth_headers(email)).json()
    for c in checks:
        res = client.post(f"/api/tasks/{task_id}/checks/{c['id']}", json={"passed": True}, headers=auth_headers(email))
        assert res.status_code == 200, res.text


def _start(task_id, email=ENG, **body):
    _ready(task_id, email)
    return _act(task_id, "start", email=email, **body)


def _activity_row(activity_id):
    db = SessionLocal()
    try:
        a = db.query(Activity).filter(Activity.id == activity_id).first()
        db.expunge(a)
        return a
    finally:
        db.close()


# ----------------------------------------------------------------------- creation rules

def test_planned_task_needs_an_activity_and_copies_its_tower(world):
    assert _create(world).status_code == 422
    res = _create(world, activity_id=world["a12"])
    assert res.status_code == 201, res.text
    task = res.json()
    assert task["status"] == "DRAFT" and task["tower"] == "Tower A" and not task["is_unplanned"]
    assert task["activity_name"] == "Slab A (12 days)"
    assert task["allowed_actions"] == ["start"]


def test_unplanned_task_needs_reason_tower_and_no_activity(world):
    assert _create(world, is_unplanned=True, tower="Tower A").status_code == 422          # no reason
    assert _create(world, is_unplanned=True, unplanned_reason="Client change").status_code == 422  # no tower
    assert _create(world, is_unplanned=True, unplanned_reason="x", tower="Tower A",
                   activity_id=world["a12"]).status_code == 422                             # linked
    res = _create(world, is_unplanned=True, unplanned_reason="Client asked for extra shear wall", tower="Tower A")
    assert res.status_code == 201
    assert res.json()["allowed_actions"] == ["submit"] and res.json()["activity_id"] is None


def test_activity_must_belong_to_the_project(world):
    assert _create(world, activity_id=99999999).status_code == 404


def test_roles_and_scope_on_create(world):
    assert _create(world, email=EXEC, activity_id=world["a12"]).status_code == 403          # read-only role
    assert _create(world, activity_id=world["b"]).status_code == 403                         # engineer is Tower A only
    assert _create(world, email=PM, activity_id=world["b"]).status_code == 201              # PM has ALL


# ----------------------------------------------------------------------- planned lifecycle

def test_planned_task_full_lifecycle_and_progress_rules(world):
    tid = _create(world, activity_id=world["a12"], planned_days=10).json()["id"]

    assert _act(tid, "submit").status_code == 409            # planned tasks have no approval step
    assert _act(tid, "approve", email=PM).status_code == 409
    assert _act(tid, "complete").status_code == 409          # not started
    assert client.post(f"/api/tasks/{tid}/progress", json={"percent": 10}, headers=auth_headers(ENG)).status_code == 409

    started = _start(tid, on_date=(date.today() - timedelta(days=2)).isoformat())
    assert started.status_code == 200 and started.json()["status"] == "IN_PROGRESS"
    assert started.json()["actual_start_date"] == (date.today() - timedelta(days=2)).isoformat()
    assert _act(tid, "start").status_code == 409             # already started

    def progress(p):
        return client.post(f"/api/tasks/{tid}/progress", json={"percent": p}, headers=auth_headers(ENG))

    assert progress(40).status_code == 200
    assert progress(60).json()["progress_percent"] == 60
    assert progress(30).status_code == 422                   # cannot go down
    assert progress(100).status_code == 422                  # finishing records a date: use complete
    assert _act(tid, "complete", on_date=(date.today() - timedelta(days=5)).isoformat()).status_code == 422  # before start
    assert _act(tid, "complete", on_date=(date.today() + timedelta(days=1)).isoformat()).status_code == 422  # future

    done = _act(tid, "complete")
    assert done.status_code == 200 and done.json()["status"] == "COMPLETED" and done.json()["progress_percent"] == 100
    assert _act(tid, "start").status_code == 409             # completed tasks are final
    assert client.patch(f"/api/tasks/{tid}", json={"title": "x"}, headers=auth_headers(ENG)).status_code == 409


def test_start_dates_cannot_be_in_the_future(world):
    tid = _create(world, activity_id=world["a12"]).json()["id"]
    _ready(tid)
    assert _act(tid, "start", on_date=(date.today() + timedelta(days=1)).isoformat()).status_code == 422


def test_block_and_unblock(world):
    tid = _create(world, activity_id=world["a12"]).json()["id"]
    assert _act(tid, "block").status_code == 409             # only a running task can be blocked
    _start(tid)
    blocked = _act(tid, "block", reason="Rebar delivery late")
    assert blocked.json()["status"] == "BLOCKED" and blocked.json()["blocked_note"] == "Rebar delivery late"
    assert client.post(f"/api/tasks/{tid}/progress", json={"percent": 10}, headers=auth_headers(ENG)).status_code == 409
    back = _act(tid, "unblock")
    assert back.json()["status"] == "IN_PROGRESS" and back.json()["blocked_note"] is None


# ----------------------------------------------------------------------- unplanned lifecycle

def _unplanned(world, **extra):
    res = _create(world, is_unplanned=True, unplanned_reason="Client change", tower="Tower A", **extra)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_unplanned_task_approval_never_starts_work(world):
    tid = _unplanned(world)
    assert _act(tid, "start").status_code == 409                       # needs approval first
    assert _act(tid, "approve", email=PM).status_code == 409           # not submitted yet

    assert _act(tid, "submit").json()["status"] == "PENDING_APPROVAL"
    assert _act(tid, "approve", email=ENG).status_code == 403          # engineers cannot approve
    assert _act(tid, "approve", email=SM).status_code == 403           # nor can site managers
    approved = _act(tid, "approve", email=PM)
    assert approved.status_code == 200 and approved.json()["status"] == "APPROVED"
    assert approved.json()["actual_start_date"] is None                # approval did not start the work
    assert approved.json()["decided_by_user_id"] is not None

    assert _act(tid, "start").json()["status"] == "IN_PROGRESS"
    assert _act(tid, "complete").json()["status"] == "COMPLETED"


def test_rejection_needs_reason_and_task_can_be_corrected_and_resubmitted(world):
    tid = _unplanned(world)
    _act(tid, "submit")
    assert _act(tid, "reject", email=PM).status_code == 422
    rejected = _act(tid, "reject", email=PM, reason="Not in scope, raise a change order")
    assert rejected.json()["status"] == "REJECTED" and rejected.json()["rejection_reason"].startswith("Not in scope")
    assert _act(tid, "start").status_code == 409

    edited = client.patch(f"/api/tasks/{tid}", json={"unplanned_reason": "Change order CO-12 approved by client"},
                          headers=auth_headers(ENG))
    assert edited.status_code == 200
    assert _act(tid, "submit").json()["status"] == "PENDING_APPROVAL"
    approved = _act(tid, "approve", email=PM)
    assert approved.json()["status"] == "APPROVED" and approved.json()["rejection_reason"] is None


def test_pending_task_cannot_be_edited(world):
    tid = _unplanned(world)
    _act(tid, "submit")
    assert client.patch(f"/api/tasks/{tid}", json={"title": "sneaky"}, headers=auth_headers(ENG)).status_code == 409


# ----------------------------------------------------------------------- scope

def test_tower_scope_on_read_and_act(world):
    pm_task = _create(world, email=PM, activity_id=world["b"]).json()["id"]   # Tower B task
    eng_task = _create(world, activity_id=world["a12"]).json()["id"]

    assert client.get(f"/api/tasks/{pm_task}", headers=auth_headers(ENG)).status_code == 403
    assert _act(pm_task, "start").status_code == 403
    assert client.get(f"/api/tasks/{eng_task}", headers=auth_headers(ENG)).status_code == 200

    mine = client.get(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(ENG)).json()
    assert {t["id"] for t in mine} == {eng_task}
    everything = client.get(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(PM)).json()
    assert {t["id"] for t in everything} == {eng_task, pm_task}
    assert client.get(f"/api/projects/{world['pid']}/tasks?status=COMPLETED", headers=auth_headers(PM)).json() == []


# ----------------------------------------------------------------------- roll-up

def test_activity_progress_is_weighted_by_planned_days_and_baseline_is_untouched(world):
    big = _create(world, activity_id=world["a12"], planned_days=10).json()["id"]
    small = _create(world, activity_id=world["a12"], planned_days=2).json()["id"]
    before = _activity_row(world["a12"])
    assert before.progress_percent == 0 and before.status == "NOT_STARTED"

    _start(big)
    _start(small)
    _act(big, "complete")
    activity = _activity_row(world["a12"])
    assert activity.progress_percent == pytest.approx(83.3, abs=0.1)   # 10 of 12 days done
    assert activity.status == "IN_PROGRESS"
    assert activity.actual_end_date is None and activity.actual_start_date == date.today()

    _act(small, "complete")
    activity = _activity_row(world["a12"])
    assert activity.progress_percent == 100 and activity.status == "COMPLETED"
    assert activity.actual_end_date == date.today()

    # the approved baseline and the plan dates never move
    for field in ("baseline_start_date", "baseline_end_date", "baseline_task_id", "baseline_source_file",
                  "start_date", "end_date", "planned_duration"):
        assert getattr(activity, field) == getattr(before, field), field


def test_partial_coverage_cannot_make_an_activity_look_done(world):
    tid = _create(world, activity_id=world["a20"], planned_days=10).json()["id"]   # activity is 20 days
    _start(tid)
    _act(tid, "complete")
    activity = _activity_row(world["a20"])
    assert activity.progress_percent == 50 and activity.status == "IN_PROGRESS"
    assert activity.actual_end_date is None


def test_draft_and_rejected_tasks_do_not_count(world):
    _create(world, activity_id=world["a12"], planned_days=12)                     # draft, ignored
    run = _create(world, activity_id=world["a12"], planned_days=6).json()["id"]
    _start(run)
    client.post(f"/api/tasks/{run}/progress", json={"percent": 50}, headers=auth_headers(ENG))
    assert _activity_row(world["a12"]).progress_percent == 25.0                  # 6 days x 50% over 12 days


def test_unplanned_work_does_not_change_any_activity(world):
    tid = _unplanned(world)
    _act(tid, "submit")
    _act(tid, "approve", email=PM)
    _act(tid, "start")
    _act(tid, "complete")
    for key in ("a12", "a20", "b"):
        assert _activity_row(world[key]).progress_percent == 0


# ----------------------------------------------------------------------- audit

def test_every_change_is_audited(world):
    tid = _create(world, activity_id=world["a12"]).json()["id"]
    _start(tid)
    _act(tid, "complete")
    db = SessionLocal()
    try:
        actions = [r.action for r in db.query(AuditLog).filter(AuditLog.entity_name == "Task",
                                                               AuditLog.entity_id == str(tid)).order_by(AuditLog.id)]
    finally:
        db.close()
    assert actions[0] == "TASK_CREATE" and actions[-2:] == ["TASK_START", "TASK_COMPLETE"]
    assert "TASK_CHECK" in actions


def test_unknown_action_and_missing_task(world):
    assert _act(999999, "start").status_code in (403, 404)
    tid = _create(world, activity_id=world["a12"]).json()["id"]
    assert _act(tid, "explode").status_code == 404
