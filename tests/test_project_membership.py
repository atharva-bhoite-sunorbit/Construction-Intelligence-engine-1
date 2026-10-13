"""Project membership and tower scope: users only reach the projects and towers they were given."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, Project, ProjectMember, User
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
ENG, PM, SM, ADMIN, EXEC = (f"{n}@construction.ai" for n in ("eng", "pm", "sm", "admin", "exec"))


def _activity(project_id, name, tower):
    return Activity(
        project_id=project_id, name=name, tower=tower, building="41 ZOY", phase="Superstructure",
        start_date=date.today(), end_date=date.today() + timedelta(days=5),
    )


@pytest.fixture(scope="module")
def zoy():
    """A ZOY-like project: Tower A, Tower B and a shared Common activity."""
    db = SessionLocal()
    project = db.query(Project).filter(Project.code == "PRJ-41ZOY").first()
    if not project:
        project = Project(
            name="41 ZOY", code="PRJ-41ZOY", construction_type="Residential", location="Pune",
            built_up_area=1.0, planned_start_date=date.today(), target_completion_date=date.today() + timedelta(days=90),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
    db.query(ProjectMember).filter(ProjectMember.project_id == project.id).delete()
    db.query(Activity).filter(Activity.project_id == project.id).delete()
    acts = {
        "a": _activity(project.id, "Tower A slab", "Tower A"),
        "b": _activity(project.id, "Tower B slab", "Tower B"),
        "common": _activity(project.id, "Site mobilisation", "Common"),
    }
    db.add_all(acts.values())
    db.commit()
    for a in acts.values():
        db.refresh(a)
    grant_membership(db, project.id, PM, "ALL")
    grant_membership(db, project.id, ENG, "Tower A")
    out = {"project_id": project.id, **{k: v.id for k, v in acts.items()}}
    db.close()
    yield out


def _names(res):
    return {a["name"] for a in res.json()}


def test_non_member_is_refused_project_routes(zoy):
    h = auth_headers(SM)  # not a member
    pid = zoy["project_id"]
    assert client.get(f"/api/projects/{pid}", headers=h).status_code == 403
    assert client.get(f"/api/projects/{pid}/activities", headers=h).status_code == 403
    assert client.get(f"/api/activities/{zoy['a']}", headers=h).status_code == 403


def test_engineer_sees_only_own_tower_plus_shared(zoy):
    res = client.get(f"/api/projects/{zoy['project_id']}/activities", headers=auth_headers(ENG))
    assert res.status_code == 200
    assert _names(res) == {"Tower A slab", "Site mobilisation"}


def test_engineer_cannot_touch_other_tower_activity(zoy):
    h = auth_headers(ENG)
    assert client.get(f"/api/activities/{zoy['a']}", headers=h).status_code == 200
    assert client.get(f"/api/activities/{zoy['b']}", headers=h).status_code == 403
    progress = {
        "project_id": zoy["project_id"], "activity_id": zoy["b"], "report_date": date.today().isoformat(),
        "planned_quantity": 1, "actual_quantity": 1, "workers_available": 1, "workers_assigned": 1,
        "working_hours": 8, "material_availability_percent": 100, "equipment_availability_percent": 100,
    }
    assert client.post("/api/progress", json=progress, headers=h).status_code == 403


def test_member_with_all_scope_sees_every_tower(zoy):
    res = client.get(f"/api/projects/{zoy['project_id']}/activities", headers=auth_headers(PM))
    assert _names(res) == {"Tower A slab", "Tower B slab", "Site mobilisation"}


def test_admin_reaches_every_project_but_a_director_needs_membership(zoy):
    url = f"/api/projects/{zoy['project_id']}/activities"
    admin = client.get(url, headers=auth_headers(ADMIN))
    assert admin.status_code == 200 and len(admin.json()) == 3
    assert client.get(url, headers=auth_headers(EXEC)).status_code == 403   # a director only sees projects they belong to
    db = SessionLocal()
    grant_membership(db, zoy["project_id"], EXEC, "ALL")
    db.close()
    try:
        assert len(client.get(url, headers=auth_headers(EXEC)).json()) == 3
    finally:
        db = SessionLocal()
        db.query(ProjectMember).filter(ProjectMember.project_id == zoy["project_id"],
                                       ProjectMember.user_id == db.query(User).filter(User.email == EXEC).first().id).delete()
        db.commit()
        db.close()


def test_project_list_only_shows_member_projects(zoy):
    pm_ids = [p["id"] for p in client.get("/api/projects", headers=auth_headers(PM)).json()]
    assert zoy["project_id"] in pm_ids
    assert zoy["project_id"] not in [p["id"] for p in client.get("/api/projects", headers=auth_headers(SM)).json()]
    assert zoy["project_id"] in [p["id"] for p in client.get("/api/projects", headers=auth_headers(ADMIN)).json()]


def test_archived_projects_are_hidden_from_lists(zoy):
    db = SessionLocal()
    db.query(Project).filter(Project.id == zoy["project_id"]).update({"status": "ARCHIVED"})
    db.commit()
    db.close()
    try:
        assert zoy["project_id"] not in [p["id"] for p in client.get("/api/projects", headers=auth_headers(PM)).json()]
        assert zoy["project_id"] not in [p["id"] for p in client.get("/api/projects", headers=auth_headers(ADMIN)).json()]
    finally:
        db = SessionLocal()
        db.query(Project).filter(Project.id == zoy["project_id"]).update({"status": "PLANNING"})
        db.commit()
        db.close()


def test_creator_becomes_member_of_new_project():
    payload = {
        "name": "Created by PM", "code": "PRJ-CREATED-BY-PM", "construction_type": "Commercial", "location": "Pune",
        "num_floors": 2, "num_towers": 1, "built_up_area": 1000.0,
        "planned_start_date": date.today().isoformat(),
        "target_completion_date": (date.today() + timedelta(days=60)).isoformat(),
    }
    h = auth_headers(PM)
    res = client.post("/api/projects", json=payload, headers=h)
    assert res.status_code == 201, res.text
    pid = res.json()["id"]
    assert client.get(f"/api/projects/{pid}", headers=h).status_code == 200
    assert client.get(f"/api/projects/{pid}", headers=auth_headers(SM)).status_code == 403


def test_member_management_rules(zoy):
    pid = zoy["project_id"]
    db = SessionLocal()
    sm_id = db.query(User).filter(User.email == SM).first().id
    db.close()
    url = f"/api/projects/{pid}/members"

    assert client.post(url, json={"user_id": sm_id, "scope": "Tower B"}, headers=auth_headers(ENG)).status_code == 403
    assert client.post(url, json={"user_id": sm_id, "scope": "Tower B"}, headers=auth_headers(SM)).status_code == 403

    added = client.post(url, json={"user_id": sm_id, "scope": "Tower B"}, headers=auth_headers(PM))
    assert added.status_code == 201, added.text
    assert client.post(url, json={"user_id": sm_id, "scope": "Tower B"}, headers=auth_headers(PM)).status_code == 400

    # The new member now reaches Tower B only.
    res = client.get(f"/api/projects/{pid}/activities", headers=auth_headers(SM))
    assert _names(res) == {"Tower B slab", "Site mobilisation"}
    assert {m["email"] for m in client.get(url, headers=auth_headers(PM)).json()} >= {PM, ENG, SM}

    assert client.delete(f"{url}/{added.json()['id']}", headers=auth_headers(ENG)).status_code == 403
    assert client.delete(f"{url}/{added.json()['id']}", headers=auth_headers(PM)).status_code == 204
    assert client.get(f"/api/projects/{pid}/activities", headers=auth_headers(SM)).status_code == 403
