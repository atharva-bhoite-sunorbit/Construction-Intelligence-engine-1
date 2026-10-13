"""Drawing (DXF) -> building shape -> API -> 3D view: the path your project drawing will take."""
import importlib.util
import json
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import ezdxf
import pytest
from fastapi.testclient import TestClient

from backend.app.database.connection import SessionLocal
from backend.app.main import app
from backend.app.models.all_models import Activity, Project
from backend.app.services import building
from tests.conftest import auth_headers, grant_membership

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "dxf_to_building_model.py"
spec = importlib.util.spec_from_file_location("dxf_to_building_model", SCRIPT)
tool = importlib.util.module_from_spec(spec)
sys.modules["dxf_to_building_model"] = tool
spec.loader.exec_module(tool)
client = TestClient(app)


@pytest.fixture()
def drawing(tmp_path):
    """A plan in millimetres: two towers, a site boundary around them, and an open line that must be ignored."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    rect = lambda x, y, w, d, layer: msp.add_lwpolyline([(x, y), (x + w, y), (x + w, y + d), (x, y + d)], close=True, dxfattribs={"layer": layer})  # noqa: E731
    rect(0, 0, 120_000, 60_000, "SITE")
    rect(10_000, 10_000, 30_000, 22_000, "WALLS")        # tower A: 30 x 22 m
    rect(60_000, 10_000, 28_000, 20_000, "WALLS")        # tower B: 28 x 20 m
    msp.add_lwpolyline([(0, 0), (5_000, 5_000)])         # not closed
    msp.add_lwpolyline([(70_000, 40_000), (80_000, 40_000), (90_000, 40_000), (90_000, 50_000), (70_000, 50_000)], close=True)  # extra in-line corner
    path = tmp_path / "plan.dxf"
    doc.saveas(path)
    return path


def test_lists_closed_outlines_biggest_first_in_metres(drawing):
    outlines = tool.closed_outlines(drawing, tool.TO_METRES["mm"])
    assert [round(o["area"]) for o in outlines] == [7200, 660, 560, 200]
    site, a, b, _ = outlines
    assert (site["layer"], round(a["width"]), round(a["depth"]), round(b["width"])) == ("SITE", 30, 22, 28)
    assert [o["number"] for o in outlines] == [1, 2, 3, 4]
    assert len(outlines[3]["points"]) == 4        # the in-line corner was dropped
    assert tool.main([str(drawing), "--unit", "mm", "--list"]) == 0


def test_model_keeps_towers_apart_and_centres_the_project(drawing, tmp_path):
    outlines = tool.closed_outlines(drawing, 0.001)
    model = tool.build_model(outlines, {"Tower A": 2, "Tower B": 3}, 3.0, "plan.dxf")
    a, b = model["wings"]["Tower A"], model["wings"]["Tower B"]
    assert a["floor_height"] == 3.0 and model["unit"] == "m"
    xs = [p[0] for w in (a, b) for p in w["footprint"]]
    assert round((min(xs) + max(xs)) / 2, 6) == 0                      # centred
    assert max(p[0] for p in a["footprint"]) < min(p[0] for p in b["footprint"])    # still side by side
    assert round(max(p[0] for p in a["footprint"]) - min(p[0] for p in a["footprint"]), 3) == 30.0
    with pytest.raises(SystemExit):
        tool.build_model(outlines, {"Tower A": 99}, 3.0, "plan.dxf")


def test_written_model_drives_the_3d_view(drawing, tmp_path, monkeypatch):
    code = f"DRW-{uuid.uuid4().hex[:6]}"
    out = tmp_path / "models"
    assert tool.main([str(drawing), "--unit", "mm", "--project", code, "--wing", "Tower A=2", "--wing", "Tower B=3",
                      "--floor-height", "3.0", "--out-dir", str(out)]) == 0
    assert json.loads((out / f"{code}.json").read_text())["wings"]["Tower A"]["floor_height"] == 3.0

    db = SessionLocal()
    p = Project(name="Drawing Test", code=code, construction_type="Residential", location="x", built_up_area=1.0,
                planned_start_date=date.today(), target_completion_date=date.today() + timedelta(days=30))
    db.add(p)
    db.commit()
    for tower in ("Tower A", "Tower B"):
        db.add(Activity(project_id=p.id, name="05 SLAB ( 1ST FLOOR)", tower=tower, phase="Superstructure", planned_duration=10, progress_percent=50.0,
                        status="IN_PROGRESS", start_date=date.today(), end_date=date.today() + timedelta(days=10)))
    db.commit()
    grant_membership(db, p.id, "pm@construction.ai", "ALL")
    pid = p.id
    db.close()

    monkeypatch.setattr(building, "MODELS_DIR", out)
    data = client.get(f"/api/projects/{pid}/building", headers=auth_headers("pm@construction.ai")).json()
    assert data["source"] == "drawing"
    a, b = data["wings"]
    assert a["levels"][0]["progress_percent"] == 50.0
    assert round(max(p[0] for p in a["footprint"]) - min(p[0] for p in a["footprint"]), 1) == 30.0 and b["floor_height"] == 3.0


def test_wide_podium_under_narrower_towers_and_a_note(drawing, tmp_path, monkeypatch):
    """No closed outline for a tower? Describe it as a box, with a wider podium outline for the lower levels."""
    model = tool.build_model([], {}, 2.95, "plan.dxf", boxes={"Tower A": (10, 30, 40, 50), "Tower B": (10, 0, 40, 20)},
                             note="Split is provisional", podium_boxes={"Tower A": (0, 25, 40, 50), "Tower B": (0, 0, 40, 25)})
    a = model["wings"]["Tower A"]
    assert model["note"] == "Split is provisional" and a["floor_height"] == 2.95
    width = lambda pts: max(p[0] for p in pts) - min(p[0] for p in pts)  # noqa: E731
    assert width(a["footprint"]) == 30 and width(a["podium_footprint"]) == 40
    assert min(p[0] for p in a["podium_footprint"]) < min(p[0] for p in a["footprint"])       # podium sticks out to the left

    code = f"POD-{uuid.uuid4().hex[:6]}"
    (tmp_path / f"{code}.json").write_text(json.dumps(model))
    db = SessionLocal()
    p = Project(name="Podium Test", code=code, construction_type="Residential", location="x", built_up_area=1.0,
                planned_start_date=date.today(), target_completion_date=date.today() + timedelta(days=30))
    db.add(p)
    db.commit()
    for tower in ("Tower A", "Tower B"):
        db.add(Activity(project_id=p.id, name="05 SLAB ( 1ST FLOOR)", tower=tower, phase="Superstructure", planned_duration=10, progress_percent=0.0,
                        status="NOT_STARTED", start_date=date.today(), end_date=date.today() + timedelta(days=10)))
    db.commit()
    grant_membership(db, p.id, "pm@construction.ai", "ALL")
    pid = p.id
    db.close()
    monkeypatch.setattr(building, "MODELS_DIR", tmp_path)
    data = client.get(f"/api/projects/{pid}/building", headers=auth_headers("pm@construction.ai")).json()
    wing = data["wings"][0]
    assert data["note"] == "Split is provisional"
    assert width(wing["podium_footprint"]) == 40 and width(wing["footprint"]) == 30
