"""Readiness checks: mandatory checks gate the start of a planned task; templates are configurable per work type."""
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, Project
from backend.app.services.readiness import work_type_for
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, SM, ADMIN = "pm@construction.ai", "eng@construction.ai", "sm@construction.ai", "admin@construction.ai"


@pytest.fixture()
def world():
    db = SessionLocal()
    p = Project(name="Readiness", code=f"RDY-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=date(2026, 1, 1), target_completion_date=date(2027, 1, 1))
    db.add(p)
    db.commit()
    db.refresh(p)
    acts = {}
    for key, name in (("slab", "10 SLAB (5TH FLOOR )"), ("block", "BLOCKWORK"), ("misc", "Handover documentation")):
        a = Activity(project_id=p.id, name=name, tower="Tower A", phase="Superstructure", planned_duration=5,
                     start_date=date(2026, 3, 1), end_date=date(2026, 3, 9))
        db.add(a)
        db.commit()
        db.refresh(a)
        acts[key] = a.id
    grant_membership(db, p.id, PM, "ALL")
    grant_membership(db, p.id, ENG, "Tower A")
    out = {"pid": p.id, **acts}
    db.close()
    return out


def _task(world, key, email=ENG, **extra):
    res = client.post(f"/api/projects/{world['pid']}/tasks", json={"title": "Work", "activity_id": world[key], **extra},
                      headers=auth_headers(email))
    assert res.status_code == 201, res.text
    return res.json()


def _checks(tid, email=ENG):
    return client.get(f"/api/tasks/{tid}/checks", headers=auth_headers(email)).json()


def _tick(tid, check_id, passed=True, email=ENG):
    return client.post(f"/api/tasks/{tid}/checks/{check_id}", json={"passed": passed}, headers=auth_headers(email))


def _start(tid, email=ENG):
    return client.post(f"/api/tasks/{tid}/start", json={}, headers=auth_headers(email))


def test_work_type_comes_from_the_activity():
    from types import SimpleNamespace as N

    def wt(name):
        return work_type_for(N(name=name, work_package=None, category=None))
    assert wt("10 SLAB (5TH FLOOR )") == "Slab / RCC"
    assert wt("EXCAVATION") == "Excavation"
    assert wt("PLUMBING WORK") == "MEP"
    assert wt("INTERNAL PLASTER (GYPSUM)") == "Finishing"
    assert wt("Handover documentation") == "General"
    assert wt("SCAPEGOAT") == "General"   # keywords must match whole words (CP / RCC inside other words don't count)


def test_checks_are_issued_from_the_work_type_template(world):
    slab = _task(world, "slab")
    assert slab["work_type"] == "Slab / RCC"
    names = [c["name"] for c in _checks(slab["id"])]
    assert "Formwork inspected" in names and "Reinforcement inspected" in names
    assert slab["checks_total"] == len(names) and slab["checks_done"] == 0
    assert "Approved drawings available" in slab["unmet_checks"]

    block = _task(world, "block")
    assert block["work_type"] == "Blockwork" and "Formwork inspected" not in [c["name"] for c in _checks(block["id"])]
    assert _task(world, "misc")["work_type"] == "General"


def test_task_cannot_start_until_mandatory_checks_pass(world):
    task = _task(world, "slab")
    res = _start(task["id"])
    assert res.status_code == 409
    assert "Formwork inspected" in res.json()["detail"]

    checks = _checks(task["id"])
    optional = [c for c in checks if not c["mandatory"]]
    mandatory = [c for c in checks if c["mandatory"]]
    assert optional, "slab template has at least one optional check"

    for c in mandatory[:-1]:
        assert _tick(task["id"], c["id"]).status_code == 200
    assert _start(task["id"]).status_code == 409                       # one mandatory check still open

    last = _tick(task["id"], mandatory[-1]["id"]).json()
    assert last["unmet_checks"] == []                                   # optional checks do not block
    started = _start(task["id"])
    assert started.status_code == 200 and started.json()["status"] == "IN_PROGRESS"


def test_unticking_a_check_reopens_the_gate(world):
    task = _task(world, "misc")
    checks = _checks(task["id"])
    for c in checks:
        _tick(task["id"], c["id"])
    _tick(task["id"], checks[0]["id"], passed=False)
    assert _start(task["id"]).status_code == 409


def test_checks_are_locked_after_start_and_record_who_ticked(world):
    task = _task(world, "misc")
    checks = _checks(task["id"])
    for c in checks:
        _tick(task["id"], c["id"])
    assert _checks(task["id"])[0]["checked_by_user_id"] is not None
    assert _start(task["id"]).status_code == 200
    assert _tick(task["id"], checks[0]["id"], passed=False).status_code == 409


def test_unplanned_tasks_have_no_checklist_and_use_approval_instead(world):
    res = client.post(f"/api/projects/{world['pid']}/tasks", headers=auth_headers(ENG),
                      json={"title": "Extra", "is_unplanned": True, "unplanned_reason": "Client change", "tower": "Tower A"})
    assert res.status_code == 201
    assert res.json()["checks_total"] == 0 and res.json()["unmet_checks"] == []


def test_pm_can_waive_one_check_for_one_task_with_a_reason(world):
    task = _task(world, "misc")
    checks = _checks(task["id"])
    mandatory = [c for c in checks if c["mandatory"]]
    target = mandatory[0]["id"]
    url = f"/api/tasks/{task['id']}/checks/{target}/waive"

    assert client.post(url, json={"reason": "Drawing was approved by email"}, headers=auth_headers(ENG)).status_code == 403
    assert client.post(url, json={"reason": "Drawing was approved by email"}, headers=auth_headers(SM)).status_code == 403
    assert client.post(url, json={"reason": "x"}, headers=auth_headers(PM)).status_code == 422   # needs a real reason
    waived = client.post(url, json={"reason": "Drawing was approved by email"}, headers=auth_headers(PM))
    assert waived.status_code == 200
    for c in mandatory[1:]:                                             # a waived step counts as done for the order
        assert _tick(task["id"], c["id"]).status_code == 200

    shown = next(c for c in _checks(task["id"]) if c["id"] == target)
    assert shown["waived"] and shown["waiver_reason"] == "Drawing was approved by email"
    assert _start(task["id"]).status_code == 200

    other = _task(world, "misc")                                        # the waiver was for one task only
    assert _start(other["id"]).status_code == 409


def test_template_changes_do_not_alter_issued_checks(world):
    task = _task(world, "block")
    before = [c["name"] for c in _checks(task["id"])]
    templates = client.get("/api/readiness-templates?work_type=Blockwork", headers=auth_headers(ADMIN)).json()
    assert templates
    res = client.patch(f"/api/readiness-templates/{templates[0]['id']}", json={"active": False}, headers=auth_headers(ADMIN))
    assert res.status_code == 200
    try:
        assert [c["name"] for c in _checks(task["id"])] == before
        newer = _task(world, "block")
        assert templates[0]["name"] not in [c["name"] for c in _checks(newer["id"])]
    finally:
        client.patch(f"/api/readiness-templates/{templates[0]['id']}", json={"active": True}, headers=auth_headers(ADMIN))


def test_only_planning_quality_or_admin_manage_templates(world):
    body = {"work_type": "Blockwork", "name": f"Plumb line checked {uuid.uuid4().hex[:4]}", "mandatory": False}
    assert client.post("/api/readiness-templates", json=body, headers=auth_headers(ENG)).status_code == 403
    assert client.post("/api/readiness-templates", json=body, headers=auth_headers(PM)).status_code == 403
    created = client.post("/api/readiness-templates", json=body, headers=auth_headers(ADMIN))
    assert created.status_code == 201
    assert client.post("/api/readiness-templates", json=body, headers=auth_headers(ADMIN)).status_code == 400  # duplicate
    # everybody signed in can read them
    assert client.get("/api/readiness-templates", headers=auth_headers(ENG)).status_code == 200
    client.patch(f"/api/readiness-templates/{created.json()['id']}", json={"active": False}, headers=auth_headers(ADMIN))


def test_unknown_check_id_is_404(world):
    task = _task(world, "misc")
    assert _tick(task["id"], 99999999).status_code == 404


def test_checks_go_in_order_and_no_step_can_be_skipped(world):
    task = _task(world, "slab")
    checks = _checks(task["id"])
    assert [c["step"] for c in checks] == list(range(1, len(checks) + 1))
    assert not checks[0]["locked"] and checks[1]["locked"] and checks[1]["locked_by"] == checks[0]["name"]

    skipped = _tick(task["id"], checks[1]["id"])
    assert skipped.status_code == 409 and checks[0]["name"] in skipped.json()["detail"]
    assert _tick(task["id"], checks[0]["id"]).status_code == 200
    assert _tick(task["id"], checks[1]["id"]).status_code == 200
    assert not _checks(task["id"])[2]["locked"]

    # a PM cannot waive past an open step either
    late = client.post(f"/api/tasks/{task['id']}/checks/{checks[3]['id']}/waive", json={"reason": "Supplier confirmed by phone"},
                       headers=auth_headers(PM))
    assert late.status_code == 409


def test_unticking_a_step_clears_the_steps_after_it(world):
    task = _task(world, "slab")
    checks = _checks(task["id"])
    for c in checks[:3]:
        assert _tick(task["id"], c["id"]).status_code == 200
    _tick(task["id"], checks[1]["id"], passed=False)
    after = _checks(task["id"])
    assert after[0]["passed"] and not after[1]["passed"] and not after[2]["passed"]
    assert after[2]["locked"]


def test_optional_steps_do_not_hold_up_the_next_one():
    from types import SimpleNamespace as N
    from backend.app.services.readiness import first_open_before
    a, b, c = N(id=1, mandatory=True, passed=True, waived=False), N(id=2, mandatory=False, passed=False, waived=False), \
        N(id=3, mandatory=True, passed=False, waived=False)
    assert first_open_before([a, b, c], c) is None
