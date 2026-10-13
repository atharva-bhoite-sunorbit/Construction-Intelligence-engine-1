"""Today + next 5 days with Plan B, and the step-locked daily checklist for each role."""
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, ActivityDependency, Blocker, Project
from backend.app.services.lookahead import build_lookahead, working_days
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, SM, EXEC, ADMIN = "pm@construction.ai", "eng@construction.ai", "sm@construction.ai", "exec@construction.ai", "admin@construction.ai"
MONDAY = date(2026, 3, 2)


@pytest.fixture()
def site():
    db = SessionLocal()
    p = Project(name="Today", code=f"TDY-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune",
                built_up_area=1.0, planned_start_date=date(2026, 1, 1), target_completion_date=date(2027, 1, 1))
    db.add(p)
    db.commit()
    db.refresh(p)
    d = lambda n: MONDAY + timedelta(days=n)  # noqa: E731

    def act(name, tower, start, end, **kw):
        a = Activity(project_id=p.id, name=name, tower=tower, phase="Superstructure", planned_duration=max((end - start).days, 1),
                     start_date=start, end_date=end, **kw)
        db.add(a)
        db.commit()
        db.refresh(a)
        return a

    running = act("10 SLAB (5TH FLOOR)", "Tower A", d(-3), d(2), status="IN_PROGRESS", progress_percent=40, actual_start_date=d(-3))
    follows = act("11 SLAB (6TH FLOOR)", "Tower A", d(3), d(6))
    ready_later = act("BLOCKWORK 2ND FLOOR", "Tower A", d(10), d(14))
    other_tower = act("BLOCKWORK 3RD FLOOR", "Tower B", d(5), d(9))
    finished = act("09 SLAB (4TH FLOOR)", "Tower A", d(-12), d(-4), status="COMPLETED", progress_percent=100)
    overdue = act("PLUMBING SLEEVES", "Tower A", d(-8), d(-2), status="IN_PROGRESS", progress_percent=50, actual_start_date=d(-8))
    db.add(ActivityDependency(project_id=p.id, predecessor_id=running.id, successor_id=follows.id, dependency_type="FS", lag_days=0))
    db.add(Blocker(project_id=p.id, activity_id=running.id, category="Material Delay", description="Concrete supplier slot cancelled",
                   opened_date=d(0), status="OPEN"))
    db.commit()
    grant_membership(db, p.id, ENG, "Tower A")
    grant_membership(db, p.id, PM, "ALL")
    grant_membership(db, p.id, SM, "ALL")
    grant_membership(db, p.id, EXEC, "ALL")
    ids = dict(pid=p.id, running=running.id, follows=follows.id, ready_later=ready_later.id, other_tower=other_tower.id,
               finished=finished.id, overdue=overdue.id)
    db.close()
    return ids


def _plan(site, towers=None):
    db = SessionLocal()
    try:
        return build_lookahead(db, site["pid"], towers, today=MONDAY)
    finally:
        db.close()


def test_working_days_skip_sunday():
    days = working_days(date(2026, 3, 5), 6)   # Thursday
    assert len(days) == 6 and all(d.weekday() != 6 for d in days)
    assert date(2026, 3, 8) not in days        # that Sunday


def test_today_lists_running_and_overdue_work_and_what_stops_it(site):
    plan = _plan(site, {"Tower A"})
    today = {x["activity_id"]: x for x in plan["days"][0]["items"]}
    assert site["running"] in today and site["overdue"] in today and site["finished"] not in today
    assert today[site["overdue"]]["late"] is True
    stop = today[site["running"]]["stopped_by"]
    assert stop and stop[0]["kind"] == "problem" and "Concrete supplier" in stop[0]["text"]
    assert plan["stopped"] == 1
    assert plan["days"][0]["items"][0]["activity_id"] == site["running"]   # stopped work is listed first


def test_coming_days_show_work_still_waiting_for_its_predecessor(site):
    plan = _plan(site, {"Tower A"})
    assert len(plan["days"]) == 6
    day3 = next(day for day in plan["days"] if day["date"] == MONDAY + timedelta(days=3))
    follows = next(x for x in day3["items"] if x["activity_id"] == site["follows"])
    assert follows["state"] == "WAITING" and follows["stopped_by"][0]["kind"] == "waiting"
    assert "10 SLAB" in follows["stopped_by"][0]["text"]


def test_plan_b_offers_ready_work_that_can_be_pulled_forward(site):
    plan = _plan(site, {"Tower A"})
    ids = [x["activity_id"] for x in plan["plan_b"]]
    assert site["ready_later"] in ids
    assert site["follows"] not in ids and site["running"] not in ids    # not ready / already today
    later = next(x for x in plan["plan_b"] if x["activity_id"] == site["ready_later"])
    assert later["days_early"] == 10 and later["work_type"] == "Blockwork"


def test_engineer_only_sees_their_towers(site):
    mine = _plan(site, {"Tower A"})
    everything = _plan(site, None)
    assert site["other_tower"] not in [x["activity_id"] for x in mine["plan_b"]]
    assert site["other_tower"] in [x["activity_id"] for x in everything["plan_b"]]
    for day in mine["days"]:
        assert all(x["tower"] == "Tower A" for x in day["items"])


def test_lookahead_endpoint_needs_membership(site):
    assert client.get(f"/api/projects/{site['pid']}/lookahead", headers=auth_headers(ENG)).status_code == 200
    assert client.get(f"/api/projects/{site['pid']}/lookahead", headers=auth_headers("aditya.patil@construction.ai")).status_code == 403


# ---- daily checklist -------------------------------------------------------------------------------------------

def _list(site, email):
    res = client.get(f"/api/projects/{site['pid']}/daily-checklist", headers=auth_headers(email))
    assert res.status_code == 200, res.text
    return res.json()


def _step(site, email, item_id, done=True):
    return client.post(f"/api/projects/{site['pid']}/daily-checklist/{item_id}", json={"done": done}, headers=auth_headers(email))


def test_each_role_gets_its_own_daily_list(site):
    eng, sm, pm, director = (_list(site, e) for e in (ENG, SM, PM, EXEC))
    assert eng["role"] == "Site Engineer" and sm["role"] == "Site Manager"
    assert pm["role"] == "Project Manager" and director["role"] == "Top Management"
    assert eng["items"][0]["name"] != sm["items"][0]["name"]
    assert eng["editable"] and eng["done"] == 0 and eng["total"] == len(eng["items"]) > 3


def test_daily_steps_go_in_order(site):
    items = _list(site, ENG)["items"]
    assert not items[0]["locked"] and items[1]["locked"] and items[1]["locked_by"] == items[0]["name"]
    skipped = _step(site, ENG, items[2]["id"])
    assert skipped.status_code == 409 and items[0]["name"] in skipped.json()["detail"]
    assert _step(site, ENG, items[0]["id"]).status_code == 200
    after = _step(site, ENG, items[1]["id"]).json()
    assert after["done"] == 2 and not after["items"][2]["locked"]


def test_unticking_a_daily_step_clears_later_ones(site):
    items = _list(site, ENG)["items"]
    for it in items[:3]:
        assert _step(site, ENG, it["id"]).status_code == 200
    out = _step(site, ENG, items[1]["id"], done=False).json()
    assert [i["done"] for i in out["items"][:3]] == [True, False, False]


def test_lists_are_per_person_and_per_role(site):
    eng_items = _list(site, ENG)["items"]
    _step(site, ENG, eng_items[0]["id"])
    assert _list(site, SM)["done"] == 0                                  # someone else's ticks are not mine
    assert _step(site, SM, eng_items[0]["id"]).status_code == 404        # not a step on a site manager's list
    admin = _list(site, ADMIN)
    assert admin["items"] == [] and not admin["editable"]
    assert _step(site, ADMIN, eng_items[0]["id"]).status_code == 403


def test_past_days_are_read_only_records(site):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    res = client.get(f"/api/projects/{site['pid']}/daily-checklist?day={yesterday}", headers=auth_headers(ENG))
    assert res.status_code == 200 and res.json()["editable"] is False


def test_plan_b_also_offers_running_work_nothing_stops(site):
    plan = _plan(site, {"Tower A"})
    boost = [x for x in plan["plan_b"] if x["kind"] == "boost"]
    assert [x["activity_id"] for x in boost] == [site["overdue"]]       # running, not stopped (the slab is stopped)
    assert plan["plan_b"][0]["kind"] == "boost"
    assert all(x["kind"] == "pull_forward" for x in plan["plan_b"][len(boost):])
