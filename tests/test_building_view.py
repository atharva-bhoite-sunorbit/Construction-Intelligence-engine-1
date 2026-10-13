"""Floor-by-floor progress for the 3D building view, and the richer portfolio cards."""
import json
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, ActivityDependency, Project
from backend.app.services import building
from backend.app.services.building import parse_level
from tests.conftest import auth_headers, grant_membership

client = TestClient(app)
PM, ENG, EXEC = "pm@construction.ai", "eng@construction.ai", "exec@construction.ai"
TODAY = date.today()


@pytest.mark.parametrize("name,expected", [
    ("01 SLAB ( STILT FLOOR SLAB)", ("stilt", 0, "Stilt")),
    ("03 SLAB ( PODIUM 2 FLOOR SLAB)", ("podium", 2, "Podium 2")),
    ("05 SLAB ( 1ST FLOOR)", ("floor", 1, "Floor 1")),
    ("06 SLAB (2ND FLOOR ) - PART CONVENTIONAL", ("floor", 2, "Floor 2")),
    ("34 SLAB(29TH FLOOR)", ("floor", 29, "Floor 29")),
    ("23 SLAB (18TH FLOOR) (RCC Water Tank)", ("floor", 18, "Floor 18")),
    ("35 SLAB (TERRACE FLOOR)", ("terrace", 0, "Terrace")),
    ("ABOVE TERRACE RCC", ("above", 0, "Above terrace")),
    ("SUB- STRUCTURE", ("foundation", 0, "Foundation and basement")),
    ("EXTENDED BASEMENT", ("foundation", 0, "Foundation and basement")),
])
def test_level_names_are_understood(name, expected):
    assert parse_level(name) == expected


@pytest.mark.parametrize("name", ["BLOCKWORK", "WATERPROOFING", "ELECTRICAL WORK", "EXCAVATION", "SITE MOBILIZATION", "SLAB curing"])
def test_other_work_is_not_a_level(name):
    assert parse_level(name) is None


def _act(pid, name, tower, progress, start, dur=10):
    return Activity(project_id=pid, name=name, tower=tower, phase="Superstructure", planned_duration=dur, progress_percent=progress,
                    status="COMPLETED" if progress >= 100 else "IN_PROGRESS" if progress else "NOT_STARTED",
                    start_date=TODAY + timedelta(days=start), end_date=TODAY + timedelta(days=start + dur))


@pytest.fixture()
def project():
    db = SessionLocal()
    p = Project(name="Tower Test", code=f"BLD-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="Pune", built_up_area=1.0,
                planned_start_date=TODAY - timedelta(days=100), target_completion_date=TODAY + timedelta(days=300), status="IN_PROGRESS")
    db.add(p)
    db.commit()
    db.refresh(p)
    rows = [
        _act(p.id, "SUB- STRUCTURE", "Tower A", 100, -90), _act(p.id, "01 SLAB ( STILT FLOOR SLAB)", "Tower A", 100, -60),
        _act(p.id, "05 SLAB ( 1ST FLOOR)", "Tower A", 100, -40),
        _act(p.id, "06 SLAB (2ND FLOOR ) - PART ALUFORM MOCK UP", "Tower A", 100, -25, dur=30),
        _act(p.id, "06 SLAB (2ND FLOOR ) - PART CONVENTIONAL", "Tower A", 0, -25, dur=10),     # one part not done: floor 2 is 75% (30d x 100 + 10d x 0)
        _act(p.id, "07 SLAB (3RD FLOOR ) - COMPLETE ALUFORM MOCK UP", "Tower A", 0, -15),      # planned to end 5 days ago, not started: late
        _act(p.id, "09 SLAB (4TH FLOOR ) REFF.", "Tower A", 0, 10),
        _act(p.id, "35 SLAB (TERRACE FLOOR)", "Tower A", 0, 80),
        _act(p.id, "05 SLAB ( 1ST FLOOR)", "Tower B", 40, -20),
        _act(p.id, "BLOCKWORK", "Tower A", 20, 0), _act(p.id, "EXCAVATION", "Common", 100, -100),
    ]
    db.add_all(rows)
    db.commit()
    grant_membership(db, p.id, PM, "ALL")
    grant_membership(db, p.id, EXEC, "ALL")
    grant_membership(db, p.id, ENG, "Tower A")
    pid, code = p.id, p.code
    db.close()
    return {"pid": pid, "code": code}


def _get(project, email=PM):
    res = client.get(f"/api/projects/{project['pid']}/building", headers=auth_headers(email))
    assert res.status_code == 200, res.text
    return res.json()


def test_levels_run_bottom_to_top_with_progress_and_state(project):
    data = _get(project)
    assert data["source"] == "placeholder" and data["unit"] == "m"
    assert [w["name"] for w in data["wings"]] == ["Tower A", "Tower B"]
    a = data["wings"][0]
    assert [l["label"] for l in a["levels"]] == ["Foundation and basement", "Stilt", "Floor 1", "Floor 2", "Floor 3", "Floor 4", "Terrace"]
    by = {l["label"]: l for l in a["levels"]}
    assert by["Stilt"]["state"] == "DONE" and by["Stilt"]["progress_percent"] == 100
    assert by["Floor 2"]["progress_percent"] == 75.0 and by["Floor 2"]["state"] == "IN_PROGRESS" and len(by["Floor 2"]["activity_ids"]) == 2
    assert by["Floor 3"]["state"] == "NOT_STARTED" and by["Floor 3"]["late"] is True
    assert by["Floor 4"]["late"] is False
    assert a["summary"] == {"levels": 6, "done": 2, "running": 1, "progress_percent": round((100 + 100 + 75) / 6, 1)}   # foundation is not a storey
    assert data["wings"][1]["levels"][0]["progress_percent"] == 40.0 and data["wings"][1]["levels"][0]["state"] == "IN_PROGRESS"


def test_each_wing_gets_a_footprint_and_wings_do_not_overlap(project):
    wings = _get(project)["wings"]
    xs = [[p[0] for p in w["footprint"]] for w in wings]
    assert max(xs[0]) < min(xs[1]) and all(len(w["footprint"]) >= 3 for w in wings) and wings[0]["floor_height"] > 0


def test_drawing_geometry_replaces_the_placeholder(project, tmp_path, monkeypatch):
    (tmp_path / f"{project['code']}.json").write_text(json.dumps(
        {"wings": {"Tower A": {"footprint": [[0, 0], [50, 0], [50, 10], [0, 10]], "floor_height": 3.0}}}))
    monkeypatch.setattr(building, "MODELS_DIR", tmp_path)
    data = _get(project)
    assert data["source"] == "drawing"
    a, b = data["wings"]
    assert a["footprint"] == [[0, 0], [50, 0], [50, 10], [0, 10]] and a["floor_height"] == 3.0
    assert len(b["footprint"]) >= 3                      # a wing missing from the drawing still gets a placeholder


def test_tower_scope_and_projects_without_floors(project):
    assert [w["name"] for w in _get(project, ENG)["wings"]] == ["Tower A"]
    db = SessionLocal()
    plain = Project(name="No floors", code=f"NF-{uuid.uuid4().hex[:6]}", construction_type="Residential", location="x", built_up_area=1.0,
                    planned_start_date=TODAY, target_completion_date=TODAY + timedelta(days=10))
    db.add(plain)
    db.commit()
    db.add(_act(plain.id, "Site works", "Tower A", 10, 0))
    db.commit()
    grant_membership(db, plain.id, PM, "ALL")
    pid = plain.id
    db.close()
    data = client.get(f"/api/projects/{pid}/building", headers=auth_headers(PM)).json()
    assert data == {"source": "none", "unit": "m", "note": "", "wings": []}
    assert client.get(f"/api/projects/{pid}/building", headers=auth_headers(ENG)).status_code == 403   # not a member


def test_portfolio_card_shows_what_is_being_built_and_the_expected_finish(project):
    db = SessionLocal()
    db.query(Project).filter(Project.id == project["pid"]).update({"cover_image_url": "/projects/test.jpg"})
    db.commit()
    db.close()
    card = next(p for p in client.get("/api/portfolio", headers=auth_headers(EXEC)).json() if p["id"] == project["pid"])
    assert card["cover_image_url"] == "/projects/test.jpg"
    names = {w["name"]: w["towers"] for w in card["current_work"]}
    assert names.get("Floor 1 slab") == ["Tower B"] and "Blockwork" in names     # work that has started and is not finished, in plain words
    assert card["expected_finish"] == card["target_completion_date"]       # no confirmed delay yet
