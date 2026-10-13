"""Floor-by-floor structural progress of each tower, for the 3D building view.

Each tower's slab activities ("05 SLAB (1ST FLOOR)", "02 SLAB (PODIUM 1 FLOOR SLAB)", "35 SLAB (TERRACE FLOOR)" ...) become
levels, bottom to top. A level's progress is its slab activity's progress (several parts of one floor are combined, weighted
by planned days). The building shape comes from data/models/<project code>.json (extracted from the project's drawing) and
falls back to a plain placeholder block per tower until that file exists.
"""
import json
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity

MODELS_DIR = Path(__file__).resolve().parents[3] / "data" / "models"
NON_BUILDING_TOWERS = {"Common", "All", "External / Infra"}
_ORDINAL = re.compile(r"\b(\d+)(?:ST|ND|RD|TH)\s+FLOOR", re.I)
_PODIUM = re.compile(r"PODIUM\s*(\d+)", re.I)
RANK = {"foundation": 0, "stilt": 1, "podium": 2, "floor": 3, "terrace": 4, "above": 5}


def parse_level(name: str) -> Optional[Tuple[str, int, str]]:
    """(kind, number, label) for an activity that builds one structural level, else None."""
    up = " ".join(name.upper().split())
    if "ABOVE TERRACE" in up:
        return ("above", 0, "Above terrace")
    if "SLAB" in up:
        if "TERRACE" in up:
            return ("terrace", 0, "Terrace")
        if "STILT" in up:
            return ("stilt", 0, "Stilt")
        m = _PODIUM.search(up)
        if m:
            return ("podium", int(m.group(1)), f"Podium {int(m.group(1))}")
        m = _ORDINAL.search(up)
        if m:
            return ("floor", int(m.group(1)), f"Floor {int(m.group(1))}")
        return None
    if any(k in up for k in ("SUB- STRUCTURE", "SUBSTRUCTURE", "EXTENDED BASEMENT", "FOUNDATION", "RAFT", "PILING")):
        return ("foundation", 0, "Foundation and basement")
    return None


def _weighted(acts: List[Activity]) -> float:
    weights = [max(a.planned_duration or 0, 1) for a in acts]
    return sum((a.progress_percent or 0) * w for a, w in zip(acts, weights)) / sum(weights)


def _state(progress: float) -> str:
    return "DONE" if progress >= 99.95 else "IN_PROGRESS" if progress > 0 else "NOT_STARTED"


def _geometry(project_code: str, towers: List[str]) -> Tuple[str, Dict[str, Dict[str, Any]], str]:
    path = MODELS_DIR / f"{project_code}.json"
    if path.exists():
        data = json.loads(path.read_text())
        return "drawing", data.get("wings", {}), data.get("note", "")
    # placeholder: one plain block per tower, side by side
    out = {}
    for i, tower in enumerate(towers):
        cx = (i - (len(towers) - 1) / 2) * 44
        w, d = 30.0, 22.0
        out[tower] = {"footprint": [[cx - w / 2, -d / 2], [cx + w / 2, -d / 2], [cx + w / 2, d / 2], [cx - w / 2, d / 2]], "floor_height": 3.2}
    return "placeholder", out, ""


def building_progress(db: Session, project, towers_allowed=None, today: Optional[date] = None) -> Dict[str, Any]:
    from backend.app.utils.access import tower_allowed

    today = today or date.today()
    by_tower: Dict[str, Dict[Tuple[int, int], Dict[str, Any]]] = {}
    for a in db.query(Activity).filter(Activity.project_id == project.id).all():
        if not a.tower or a.tower in NON_BUILDING_TOWERS or not tower_allowed(towers_allowed, a.tower):
            continue
        level = parse_level(a.name)
        if not level:
            continue
        kind, number, label = level
        slot = by_tower.setdefault(a.tower, {}).setdefault((RANK[kind], number), {"kind": kind, "number": number, "label": label, "acts": []})
        slot["acts"].append(a)

    towers = sorted(t for t, levels in by_tower.items() if any(v["kind"] != "foundation" for v in levels.values()))
    source, geo, note = _geometry(project.code, towers)
    wings = []
    for tower in towers:
        levels = []
        for index, key in enumerate(sorted(by_tower[tower])):
            slot = by_tower[tower][key]
            acts = slot["acts"]
            progress = round(_weighted(acts), 1)
            state = _state(progress)
            levels.append({
                "index": index, "kind": slot["kind"], "label": slot["label"], "progress_percent": progress, "state": state,
                "late": state != "DONE" and any(a.end_date and a.end_date < today and (a.progress_percent or 0) < 100 for a in acts),   # only work that is still open can be late
                "activity_ids": [a.id for a in acts], "start_date": min(a.start_date for a in acts), "end_date": max(a.end_date for a in acts),
            })
        shape = geo.get(tower) or _geometry("", [tower])[1][tower]
        structure = [l for l in levels if l["kind"] != "foundation"]
        wings.append({
            "name": tower, "footprint": shape["footprint"], "podium_footprint": shape.get("podium_footprint") or shape["footprint"],
            "floor_height": shape.get("floor_height", 3.2), "levels": levels,
            "summary": {"levels": len(structure), "done": sum(1 for l in structure if l["state"] == "DONE"),
                        "running": sum(1 for l in structure if l["state"] == "IN_PROGRESS"),
                        "progress_percent": round(sum(l["progress_percent"] for l in structure) / max(len(structure), 1), 1)},
        })
    return {"source": source if wings else "none", "unit": "m", "note": note, "wings": wings}
