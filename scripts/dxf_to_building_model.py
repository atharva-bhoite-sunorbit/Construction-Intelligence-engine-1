"""Turn a project drawing (DXF) into the building shape used by the 3D progress view.

A DWG cannot be read directly. Save it as DXF first (AutoCAD: SAVEAS > AutoCAD DXF, 2013 or 2018), or convert it with the free
ODA File Converter, or `brew install libredwg` then `dwg2dxf drawing.dwg`.

  1. See the closed outlines in the drawing (biggest first):
        python scripts/dxf_to_building_model.py drawing.dxf --unit mm --list
     (use --region x0,y0,x1,y1 to look at one sheet of a multi-sheet drawing, in drawing coordinates)
  2. Pick the outline of each tower by its number and write the model:
        python scripts/dxf_to_building_model.py drawing.dxf --unit mm --project PRJ-41ZOY-PLUS \\
            --wing "Tower A=3" --wing "Tower B=5" --floor-height 3.0
  3. No closed outline for a tower? Describe it as a box in drawing coordinates instead:
        --wing-box "Tower A=9091,-1478,9132,-1458"        (x0,y0,x1,y1)
     and say how sure you are with --note "Two end blocks of the podium envelope; split to be confirmed".
  4. A building whose lower levels (stilt, podium, basement) are wider than the tower: give that wider outline too,
        --podium-box "Tower A=x0,y0,x1,y1"
     The stilt, podium and foundation levels are drawn with it; the floors above use the tower outline.

Writes data/models/<project code>.json. Wings keep their positions relative to each other. Units: --unit mm|cm|m|in|ft.
"""
import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import ezdxf

TO_METRES = {"mm": 0.001, "cm": 0.01, "m": 1.0, "in": 0.0254, "ft": 0.3048}
MODELS_DIR = Path(__file__).resolve().parent.parent / "data" / "models"


def area(points: List[Tuple[float, float]]) -> float:
    return abs(sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points)))) / 2


def tidy(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Drop repeated and in-line points so the outline stays light."""
    out: List[Tuple[float, float]] = []
    for p in points:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    if len(out) > 1 and math.dist(out[0], out[-1]) < 1e-6:
        out.pop()
    changed = True
    while changed and len(out) > 3:
        changed = False
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            if abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6:
                out.pop(i)
                changed = True
                break
    return out


def closed_outlines(dxf_path: Path, scale: float, region: Tuple[float, float, float, float] = None) -> List[Dict[str, Any]]:
    doc = ezdxf.readfile(str(dxf_path))
    found = []
    for e in doc.modelspace():
        pts = None
        if e.dxftype() == "LWPOLYLINE" and (e.closed or (len(e) > 3 and math.dist(e[0][:2], e[len(e) - 1][:2]) < 1e-6)):
            pts = [(p[0] * scale, p[1] * scale) for p in e.get_points("xy")]
        elif e.dxftype() == "POLYLINE" and e.is_closed and not e.is_3d_polyline:
            pts = [(v.dxf.location.x * scale, v.dxf.location.y * scale) for v in e.vertices]
        if pts and len(tidy(pts)) >= 3:
            pts = tidy(pts)
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            if region and not (region[0] <= sum(xs) / len(xs) <= region[2] and region[1] <= sum(ys) / len(ys) <= region[3]):
                continue
            found.append({"layer": e.dxf.layer, "points": pts, "area": area(pts), "width": max(xs) - min(xs), "depth": max(ys) - min(ys)})
    found.sort(key=lambda o: -o["area"])
    for i, o in enumerate(found, start=1):
        o["number"] = i
    return found


def build_model(outlines: List[Dict[str, Any]], wings: Dict[str, int], floor_height: float, source: str,
                boxes: Dict[str, Tuple[float, float, float, float]] = None, note: str = "",
                podium_boxes: Dict[str, Tuple[float, float, float, float]] = None) -> Dict[str, Any]:
    by_number = {o["number"]: o for o in outlines}
    chosen = {}
    for name, number in wings.items():
        if number not in by_number:
            raise SystemExit(f"No outline number {number} (use --list to see them)")
        chosen[name] = by_number[number]["points"]
    for name, (x0, y0, x1, y1) in (boxes or {}).items():
        chosen[name] = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    podium = {n: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)] for n, (x0, y0, x1, y1) in (podium_boxes or {}).items()}
    xs = [p[0] for pts in list(chosen.values()) + list(podium.values()) for p in pts]
    ys = [p[1] for pts in list(chosen.values()) + list(podium.values()) for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2     # centre the project on the origin, keep the wings' relative positions
    shift = lambda pts: [[round(x - cx, 3), round(y - cy, 3)] for x, y in pts]  # noqa: E731
    model = {"unit": "m", "source": source, "wings": {
        name: {"footprint": shift(pts), "floor_height": floor_height, **({"podium_footprint": shift(podium[name])} if name in podium else {})}
        for name, pts in chosen.items()}}
    if note:
        model["note"] = note
    return model


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dxf", type=Path)
    ap.add_argument("--unit", default="m", choices=TO_METRES)
    ap.add_argument("--list", action="store_true", help="list the closed outlines and stop")
    ap.add_argument("--project", help="project code, e.g. PRJ-41ZOY-PLUS")
    ap.add_argument("--wing", action="append", default=[], metavar='"Tower A=3"', help="tower name = outline number")
    ap.add_argument("--wing-box", action="append", default=[], metavar='"Tower A=x0,y0,x1,y1"', help="tower as a box in drawing coordinates (metres after --unit)")
    ap.add_argument("--podium-box", action="append", default=[], metavar='"Tower A=x0,y0,x1,y1"', help="wider outline for the stilt / podium / foundation levels of a tower")
    ap.add_argument("--region", metavar="x0,y0,x1,y1", help="only outlines inside this area (drawing coordinates, metres after --unit)")
    ap.add_argument("--note", default="", help="shown under the 3D view, e.g. what is still an assumption")
    ap.add_argument("--floor-height", type=float, default=3.2, help="storey height in metres")
    ap.add_argument("--out-dir", type=Path, default=MODELS_DIR)
    args = ap.parse_args(argv)

    region = tuple(float(v) for v in args.region.split(",")) if args.region else None
    outlines = closed_outlines(args.dxf, TO_METRES[args.unit], region)
    if args.list or not (args.wing or args.wing_box):
        print(f"{len(outlines)} closed outline(s) in {args.dxf.name} (sizes in metres, assuming {args.unit}):")
        for o in outlines[:40]:
            print(f"  {o['number']:>3}  layer {o['layer']:<18} {o['width']:7.1f} x {o['depth']:<7.1f} m  area {o['area']:9.1f} m2  {len(o['points'])} corners")
        if not outlines:
            print("  none: the plan may be drawn with lines or a block; export the outline as a closed polyline (PEDIT > Join).")
        return 0
    if not args.project:
        raise SystemExit("--project is required to write a model")
    wings = {}
    for item in args.wing:
        name, _, number = item.rpartition("=")
        wings[name.strip()] = int(number)
    boxes = {}
    for item in args.wing_box:
        name, _, coords = item.rpartition("=")
        x0, y0, x1, y1 = (float(v) * TO_METRES[args.unit] for v in coords.split(","))
        boxes[name.strip()] = (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    podium_boxes = {}
    for item in args.podium_box:
        name, _, coords = item.rpartition("=")
        x0, y0, x1, y1 = (float(v) * TO_METRES[args.unit] for v in coords.split(","))
        podium_boxes[name.strip()] = (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    model = build_model(outlines, wings, args.floor_height, args.dxf.name, boxes, args.note, podium_boxes)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    path = args.out_dir / f"{args.project}.json"
    path.write_text(json.dumps(model, indent=2))
    summary = ", ".join("%s: %d corners" % (n, len(w["footprint"])) for n, w in model["wings"].items())
    print(f"wrote {path} ({summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
