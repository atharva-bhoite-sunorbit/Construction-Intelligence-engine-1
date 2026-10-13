# Building shapes for the 3D progress view

`<project code>.json` here gives each tower's outline and storey height. Until a file exists for a project, every tower is
drawn as a plain block. Create the file from a drawing with `scripts/dxf_to_building_model.py` (see its header), or write it by
hand:

```json
{
  "unit": "m",
  "wings": {
    "Tower A": { "footprint": [[-40, -11], [-10, -11], [-10, 11], [-40, 11]], "floor_height": 3.2 },
    "Tower B": { "footprint": [[10, -11], [40, -11], [40, 11], [10, 11]], "floor_height": 3.2 }
  }
}
```

`footprint` is the outline of one typical floor in metres (plan view, any number of corners). The wing names must match the
tower names used in the schedule. Floors are stacked automatically from the schedule's slab activities.

## From a DWG

A DWG must be converted to DXF first: `brew install libredwg` then `dwg2dxf -y -o drawing.dxf drawing.dwg` (the "Unstable Class"
warnings about dimension objects are harmless), or save as DXF from AutoCAD. Then:

```bash
python scripts/dxf_to_building_model.py drawing.dxf --unit m --list                 # closed outlines, biggest first
python scripts/dxf_to_building_model.py drawing.dxf --unit m --project PRJ-41ZOY-PLUS --floor-height 2.95 \
  --wing-box "Tower A=x0,y0,x1,y1" --podium-box "Tower A=x0,y0,x1,y1" --note "what is assumed"
```

`--wing-box` / `--podium-box` describe a tower and its (wider) podium as boxes in drawing coordinates when the drawing has no closed
outline for them. `--note` is shown under the 3D view. The drawing for 41 ZOY+ (Sketch 22, architect VK:a, 01/07/2025) holds one
podium building of 41.8 x 58.8 m, storey height 2.95 m and levels Basement 1, Stilt, Podium 1-4, floors 1-29, Terrace; it has no
separate typical floor plan per wing, so the two end blocks as Tower A (north) and Tower B (south) is an assumption.
