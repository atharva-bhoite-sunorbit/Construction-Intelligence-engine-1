from typing import List, Dict, Any, Tuple
from datetime import date, timedelta
from backend.app.models.all_models import Project, Activity, ActivityDependency

class TemplateEngine:
    """
    Configurable Construction Activity Template Engine.
    Supports Residential, High-Rise, Commercial, Factory, Mall, Hospital, Warehouse, Infrastructure, etc.
    Generates multi-tower, multi-building, multi-floor, multi-zone activities and automatic logical dependencies.
    """

    @staticmethod
    def get_template_definitions(construction_type: str) -> Dict[str, Any]:
        """Provides sequence structure and activity templates for each construction type."""
        c_type = construction_type.lower()

        if "high" in c_type or "rise" in c_type:
            return {
                "pre_construction": [
                    {"name": "Site Mobilization & Clearing", "phase": "Pre-Construction", "pkg": "Site Mobilization", "dur": 7, "qty": 1, "unit": "lot", "labour": 8, "mat": "Temporary Fencing, Signage", "eq": "Dozer"},
                    {"name": "Site Topographic Survey & Setting Out", "phase": "Pre-Construction", "pkg": "Site Survey", "dur": 4, "qty": 1, "unit": "lot", "labour": 4, "mat": "Survey Markers", "eq": "Total Station"},
                    {"name": "Temporary Facilities & Site Offices", "phase": "Pre-Construction", "pkg": "Temporary Facilities", "dur": 10, "qty": 1, "unit": "lot", "labour": 12, "mat": "Portacabins, Utilities", "eq": "Forklift"},
                    {"name": "Bulk Excavation & Shoring", "phase": "Pre-Construction", "pkg": "Excavation", "dur": 18, "qty": 4500, "unit": "m3", "labour": 10, "mat": "Shoring Piles, Soil Nails", "eq": "Excavator, Dump Truck"},
                ],
                "foundation": [
                    {"name": "PCC (Plain Cement Concrete) Bedding", "phase": "Substructure", "pkg": "Foundation", "dur": 6, "qty": 350, "unit": "m3", "labour": 14, "mat": "Concrete M15", "eq": "Transit Mixer"},
                    {"name": "Raft / Footing Reinforcement Steel", "phase": "Substructure", "pkg": "Foundation", "dur": 12, "qty": 85, "unit": "tons", "labour": 22, "mat": "TMT Steel Fe500", "eq": "Bar Bending Machine"},
                    {"name": "Foundation Formwork & Shuttering", "phase": "Substructure", "pkg": "Foundation", "dur": 8, "qty": 650, "unit": "sq.m", "labour": 16, "mat": "Plywood, Steel Props", "eq": "Crane"},
                    {"name": "Foundation Concrete Pouring & Curing", "phase": "Substructure", "pkg": "Foundation", "dur": 5, "qty": 900, "unit": "m3", "labour": 20, "mat": "Ready Mix Concrete M40", "eq": "Concrete Pump, Vibrator"},
                ],
                "floor_cycle": [
                    {"name": "Column Reinforcement", "phase": "Superstructure", "pkg": "Structure", "dur": 3, "qty": 12, "unit": "tons", "labour": 14, "mat": "Steel Rebar", "eq": "Crane"},
                    {"name": "Column Formwork & Alignment", "phase": "Superstructure", "pkg": "Structure", "dur": 3, "qty": 160, "unit": "sq.m", "labour": 16, "mat": "Steel Panels, Clamps", "eq": "Crane"},
                    {"name": "Column Concrete Casting", "phase": "Superstructure", "pkg": "Structure", "dur": 2, "qty": 45, "unit": "m3", "labour": 12, "mat": "Concrete M45", "eq": "Concrete Pump"},
                    {"name": "Beam & Slab Formwork / Decking", "phase": "Superstructure", "pkg": "Structure", "dur": 5, "qty": 450, "unit": "sq.m", "labour": 20, "mat": "Cuplock Scaffolding, Plywood", "eq": "Crane"},
                    {"name": "Beam & Slab Reinforcement Steel", "phase": "Superstructure", "pkg": "Structure", "dur": 4, "qty": 28, "unit": "tons", "labour": 18, "mat": "TMT Steel Rebar", "eq": "Bar Bender"},
                    {"name": "MEP Slab Conduits & Embeds", "phase": "Superstructure", "pkg": "MEP", "dur": 2, "qty": 450, "unit": "sq.m", "labour": 8, "mat": "PVC Conduits, Junction Boxes", "eq": "Hand Tools"},
                    {"name": "Slab Concrete Pour & Power Trowel", "phase": "Superstructure", "pkg": "Structure", "dur": 2, "qty": 180, "unit": "m3", "labour": 18, "mat": "Concrete M35", "eq": "Concrete Pump, Trowel"},
                    {"name": "Masonry External & Internal Blockwork", "phase": "Superstructure", "pkg": "Masonry", "dur": 7, "qty": 380, "unit": "sq.m", "labour": 15, "mat": "AAC Blocks, Mortar", "eq": "Hoist"},
                    {"name": "MEP First Fix (Piping & Chasing)", "phase": "Superstructure", "pkg": "MEP", "dur": 6, "qty": 1, "unit": "floor", "labour": 12, "mat": "CPVC Pipes, Electrical Boxes", "eq": "Chaser, Core Cutter"},
                    {"name": "Internal Wall Plastering", "phase": "Finishing", "pkg": "Finishing", "dur": 6, "qty": 850, "unit": "sq.m", "labour": 16, "mat": "Gypsum / Cement Plaster", "eq": "Spray Plaster Machine"},
                    {"name": "Vitrified Tile Flooring", "phase": "Finishing", "pkg": "Finishing", "dur": 6, "qty": 420, "unit": "sq.m", "labour": 14, "mat": "Tiles 600x1200, Adhesive", "eq": "Tile Cutter"},
                    {"name": "Doors, Windows & Glazing Installation", "phase": "Finishing", "pkg": "Finishing", "dur": 4, "qty": 18, "unit": "units", "labour": 8, "mat": "UPVC Windows, Flush Doors", "eq": "Hand Tools"},
                    {"name": "Primer & Final Emulsion Painting", "phase": "Finishing", "pkg": "Finishing", "dur": 5, "qty": 900, "unit": "sq.m", "labour": 10, "mat": "Acrylic Paint, Primer", "eq": "Airless Sprayer"},
                ],
                "handover": [
                    {"name": "MEP Testing & Integrated Commissioning", "phase": "Handover", "pkg": "Testing", "dur": 10, "qty": 1, "unit": "system", "labour": 12, "mat": "Testing Gauges, Meters", "eq": "Test Bench"},
                    {"name": "Snagging & Defect Rectification", "phase": "Handover", "pkg": "Snagging", "dur": 12, "qty": 1, "unit": "building", "labour": 20, "mat": "Touch-up Kits", "eq": "Access Equipment"},
                    {"name": "Authority Final Inspection & Handover", "phase": "Handover", "pkg": "Handover", "dur": 6, "qty": 1, "unit": "project", "labour": 6, "mat": "Documentation, Sign-off", "eq": "None"},
                ]
            }
        elif "factory" in c_type or "industrial" in c_type:
            return {
                "sequence": [
                    {"name": "Site Preparation & Heavy Earthworks", "phase": "Pre-Construction", "pkg": "Site Prep", "dur": 10, "qty": 5000, "unit": "sq.m", "labour": 12, "mat": "Granular Sub-base", "eq": "Grader, Roller"},
                    {"name": "Deep Footings & Heavy Machine Foundations", "phase": "Substructure", "pkg": "Foundation", "dur": 18, "qty": 1200, "unit": "m3", "labour": 24, "mat": "M40 Concrete, Rebar", "eq": "Excavator, Pump"},
                    {"name": "Structural Steel Fabrication & Erection", "phase": "Superstructure", "pkg": "Structural Steel", "dur": 25, "qty": 280, "unit": "tons", "labour": 28, "mat": "Steel Portals, Purlins", "eq": "Heavy Mobile Crane, Boom Lift"},
                    {"name": "Industrial Laser Screed Flooring (FM2 Spec)", "phase": "Superstructure", "pkg": "Industrial Flooring", "dur": 14, "qty": 4500, "unit": "sq.m", "labour": 18, "mat": "Steel Fibres, Hardener, Concrete", "eq": "Laser Screed Machine, Power Floats"},
                    {"name": "Insulated Metal Roofing & Cladding Panels", "phase": "Superstructure", "pkg": "Roofing", "dur": 16, "qty": 5200, "unit": "sq.m", "labour": 20, "mat": "Sandwich Panels, Gutters", "eq": "Scissor Lifts"},
                    {"name": "High-Bay Industrial MEP & Fire Suppression", "phase": "MEP", "pkg": "MEP", "dur": 20, "qty": 1, "unit": "facility", "labour": 22, "mat": "Sprinklers, Busbars, Cable Trays", "eq": "Boom Lifts"},
                    {"name": "Overhead EOT Crane & Equipment Installation", "phase": "Execution", "pkg": "Equipment Installation", "dur": 15, "qty": 4, "unit": "units", "labour": 16, "mat": "Gantry Rails, Anchor Bolts", "eq": "Hydraulic Crane"},
                    {"name": "Load Testing & Commissioning of Machinery", "phase": "Handover", "pkg": "Testing", "dur": 12, "qty": 1, "unit": "plant", "labour": 14, "mat": "Test Weights, Calibration Tools", "eq": "Diagnostic Rig"},
                    {"name": "Plant Environmental & Safety Compliance Signoff", "phase": "Handover", "pkg": "Handover", "dur": 7, "qty": 1, "unit": "plant", "labour": 6, "mat": "Certificates", "eq": "None"},
                ]
            }
        else: # Standard Commercial / Residential / Warehouse / General
            return {
                "pre_construction": [
                    {"name": "Site Mobilization & Fencing", "phase": "Pre-Construction", "pkg": "Mobilization", "dur": 6, "qty": 1, "unit": "lot", "labour": 8, "mat": "Fencing, Signboards", "eq": "Truck"},
                    {"name": "Site Layout Survey", "phase": "Pre-Construction", "pkg": "Survey", "dur": 3, "qty": 1, "unit": "lot", "labour": 4, "mat": "Pegs, Markers", "eq": "Total Station"},
                    {"name": "Excavation & Earthwork", "phase": "Pre-Construction", "pkg": "Excavation", "dur": 12, "qty": 1800, "unit": "m3", "labour": 10, "mat": "Gravel", "eq": "Excavator, Dumper"},
                ],
                "foundation": [
                    {"name": "PCC Sub-base", "phase": "Substructure", "pkg": "Foundation", "dur": 5, "qty": 150, "unit": "m3", "labour": 12, "mat": "Concrete M15", "eq": "Transit Mixer"},
                    {"name": "Footings & Plinth Beam Reinforcement", "phase": "Substructure", "pkg": "Foundation", "dur": 9, "qty": 35, "unit": "tons", "labour": 16, "mat": "TMT Bars", "eq": "Bar Bender"},
                    {"name": "Plinth Concrete Casting", "phase": "Substructure", "pkg": "Foundation", "dur": 4, "qty": 220, "unit": "m3", "labour": 15, "mat": "Concrete M30", "eq": "Pump"},
                ],
                "floor_cycle": [
                    {"name": "Superstructure Columns", "phase": "Superstructure", "pkg": "Structure", "dur": 5, "qty": 25, "unit": "m3", "labour": 14, "mat": "Concrete, Steel", "eq": "Hoist"},
                    {"name": "Beams and Floor Slab", "phase": "Superstructure", "pkg": "Structure", "dur": 8, "qty": 120, "unit": "m3", "labour": 20, "mat": "Concrete M30, Steel", "eq": "Concrete Pump"},
                    {"name": "External & Partition Brickwork", "phase": "Superstructure", "pkg": "Masonry", "dur": 9, "qty": 400, "unit": "sq.m", "labour": 15, "mat": "Bricks, Cement Mortar", "eq": "Hoist"},
                    {"name": "Electrical & Plumbing Rough-ins", "phase": "MEP", "pkg": "MEP", "dur": 7, "qty": 1, "unit": "floor", "labour": 10, "mat": "Pipes, Cables", "eq": "Drills"},
                    {"name": "Internal Plaster & Ceiling", "phase": "Finishing", "pkg": "Finishing", "dur": 8, "qty": 750, "unit": "sq.m", "labour": 14, "mat": "Cement Plaster", "eq": "Mixer"},
                    {"name": "Floor Tiling & Skirting", "phase": "Finishing", "pkg": "Finishing", "dur": 7, "qty": 350, "unit": "sq.m", "labour": 12, "mat": "Ceramic Tiles", "eq": "Tile Cutter"},
                    {"name": "Internal & External Painting", "phase": "Finishing", "pkg": "Finishing", "dur": 6, "qty": 800, "unit": "sq.m", "labour": 10, "mat": "Paint, Primer", "eq": "Rollers"},
                ],
                "handover": [
                    {"name": "Services Testing & Commissioning", "phase": "Handover", "pkg": "Testing", "dur": 8, "qty": 1, "unit": "facility", "labour": 8, "mat": "Testing Kits", "eq": "Meters"},
                    {"name": "Final Cleaning & Handover", "phase": "Handover", "pkg": "Handover", "dur": 5, "qty": 1, "unit": "facility", "labour": 10, "mat": "Cleaning Supplies", "eq": "None"},
                ]
            }

    @staticmethod
    def generate_plan_for_project(
        project: Project,
        num_floors: int = None,
        num_towers: int = None,
        zones_per_floor: int = 1
    ) -> Tuple[List[Activity], List[ActivityDependency]]:
        """
        Generates full construction activity tree and FS/SS dependencies for a project.
        Supports multi-tower, multi-floor, multi-zone generation.
        """
        c_type = project.construction_type or "Residential"
        floors = num_floors if num_floors is not None else max(1, project.num_floors or 1)
        towers = num_towers if num_towers is not None else max(1, project.num_towers or 1)
        start_date = project.planned_start_date or date.today()

        templates = TemplateEngine.get_template_definitions(c_type)
        activities: List[Activity] = []
        dependencies: List[ActivityDependency] = []

        current_date = start_date
        sort_counter = 1

        # Case 1: Factory / Industrial Linear Sequence
        if "sequence" in templates:
            prev_act = None
            for item in templates["sequence"]:
                dur = item["dur"]
                act = Activity(
                    project_id=project.id,
                    name=item["name"],
                    code=f"ACT-FAC-{sort_counter:03d}",
                    phase=item["phase"],
                    work_package=item["pkg"],
                    category=item["pkg"],
                    building="Main Plant",
                    tower="Unit 1",
                    floor=1,
                    zone="Zone 1",
                    quantity=item["qty"],
                    unit=item["unit"],
                    planned_duration=dur,
                    start_date=current_date,
                    end_date=current_date + timedelta(days=dur - 1),
                    required_labour=item["labour"],
                    required_material=item.get("mat"),
                    required_equipment=item.get("eq"),
                    priority="HIGH" if sort_counter <= 4 else "MEDIUM",
                    status="NOT_STARTED",
                    sort_order=sort_counter
                )
                activities.append(act)

                if prev_act:
                    dependencies.append(ActivityDependency(
                        project_id=project.id,
                        predecessor=prev_act,
                        successor=act,
                        dependency_type="FS",
                        lag_days=0
                    ))

                prev_act = act
                current_date = current_date + timedelta(days=dur)
                sort_counter += 1

            return activities, dependencies

        # Case 2: Multi-tower / Multi-floor / Multi-zone Hierarchical Generation
        pre_acts: List[Activity] = []
        prev_act = None

        # 1. Pre-construction
        for item in templates.get("pre_construction", []):
            dur = item["dur"]
            act = Activity(
                project_id=project.id,
                name=item["name"],
                code=f"ACT-PRE-{sort_counter:03d}",
                phase=item["phase"],
                work_package=item["pkg"],
                category="Pre-Construction",
                building="Common Site",
                tower="All",
                floor=0,
                zone="Site",
                quantity=item["qty"],
                unit=item["unit"],
                planned_duration=dur,
                start_date=current_date,
                end_date=current_date + timedelta(days=dur - 1),
                required_labour=item["labour"],
                required_material=item.get("mat"),
                required_equipment=item.get("eq"),
                priority="HIGH",
                status="NOT_STARTED",
                sort_order=sort_counter
            )
            activities.append(act)
            pre_acts.append(act)

            if prev_act:
                dependencies.append(ActivityDependency(
                    project_id=project.id,
                    predecessor=prev_act,
                    successor=act,
                    dependency_type="FS",
                    lag_days=0
                ))
            prev_act = act
            current_date = current_date + timedelta(days=dur)
            sort_counter += 1

        # 2. Substructure / Foundation per tower
        foundation_last_acts: Dict[int, Activity] = {}
        for t in range(1, towers + 1):
            tower_name = f"Tower {chr(64 + t)}" if towers > 1 else "Main Building"
            f_prev = prev_act
            for item in templates.get("foundation", []):
                dur = item["dur"]
                act = Activity(
                    project_id=project.id,
                    name=f"[{tower_name}] {item['name']}",
                    code=f"ACT-T{t}-F00-{sort_counter:03d}",
                    phase=item["phase"],
                    work_package=item["pkg"],
                    category="Foundation",
                    building="Main",
                    tower=tower_name,
                    floor=0,
                    zone="Foundation",
                    quantity=item["qty"],
                    unit=item["unit"],
                    planned_duration=dur,
                    start_date=current_date,
                    end_date=current_date + timedelta(days=dur - 1),
                    required_labour=item["labour"],
                    required_material=item.get("mat"),
                    required_equipment=item.get("eq"),
                    priority="HIGH",
                    status="NOT_STARTED",
                    sort_order=sort_counter
                )
                activities.append(act)
                if f_prev:
                    dependencies.append(ActivityDependency(
                        project_id=project.id,
                        predecessor=f_prev,
                        successor=act,
                        dependency_type="FS",
                        lag_days=0
                    ))
                f_prev = act
                current_date = current_date + timedelta(days=dur)
                sort_counter += 1
            foundation_last_acts[t] = f_prev

        # 3. Floor Cycle per Tower and Floor
        floor_acts_matrix: Dict[Tuple[int, int], List[Activity]] = {}

        for t in range(1, towers + 1):
            tower_name = f"Tower {chr(64 + t)}" if towers > 1 else "Main Building"
            prev_floor_slab_act = foundation_last_acts.get(t)

            for f in range(1, floors + 1):
                floor_acts_matrix[(t, f)] = []
                prev_in_floor = None

                for item in templates.get("floor_cycle", []):
                    dur = item["dur"]
                    act = Activity(
                        project_id=project.id,
                        name=f"[{tower_name} F{f}] {item['name']}",
                        code=f"ACT-T{t}-F{f:02d}-{sort_counter:03d}",
                        phase=item["phase"],
                        work_package=item["pkg"],
                        category=item["pkg"],
                        building="Main",
                        tower=tower_name,
                        floor=f,
                        zone="Zone 1",
                        quantity=item["qty"],
                        unit=item["unit"],
                        planned_duration=dur,
                        start_date=current_date,
                        end_date=current_date + timedelta(days=dur - 1),
                        required_labour=item["labour"],
                        required_material=item.get("mat"),
                        required_equipment=item.get("eq"),
                        priority="MEDIUM",
                        status="NOT_STARTED",
                        sort_order=sort_counter
                    )
                    activities.append(act)
                    floor_acts_matrix[(t, f)].append(act)

                    # Sequential dependency within the floor
                    if prev_in_floor:
                        dependencies.append(ActivityDependency(
                            project_id=project.id,
                            predecessor=prev_in_floor,
                            successor=act,
                            dependency_type="FS",
                            lag_days=0
                        ))
                    else:
                        # First activity of floor depends on previous floor's slab concrete casting
                        if prev_floor_slab_act:
                            dependencies.append(ActivityDependency(
                                project_id=project.id,
                                predecessor=prev_floor_slab_act,
                                successor=act,
                                dependency_type="FS",
                                lag_days=1 # 1 day curing / setup lag
                            ))

                    prev_in_floor = act
                    sort_counter += 1

                # Update prev_floor_slab_act to be the slab concrete casting in this floor (or middle activity)
                if len(floor_acts_matrix[(t, f)]) >= 6:
                    prev_floor_slab_act = floor_acts_matrix[(t, f)][6] # Slab Concrete Pour
                else:
                    prev_floor_slab_act = floor_acts_matrix[(t, f)][-1]

        # 4. Handover & Commissioning
        prev_handover = activities[-1] if activities else None
        for item in templates.get("handover", []):
            dur = item["dur"]
            act = Activity(
                project_id=project.id,
                name=item["name"],
                code=f"ACT-HND-{sort_counter:03d}",
                phase=item["phase"],
                work_package=item["pkg"],
                category="Handover",
                building="All",
                tower="All",
                floor=floors,
                zone="Site",
                quantity=item["qty"],
                unit=item["unit"],
                planned_duration=dur,
                start_date=current_date,
                end_date=current_date + timedelta(days=dur - 1),
                required_labour=item["labour"],
                required_material=item.get("mat"),
                required_equipment=item.get("eq"),
                priority="HIGH",
                status="NOT_STARTED",
                sort_order=sort_counter
            )
            activities.append(act)
            if prev_handover:
                dependencies.append(ActivityDependency(
                    project_id=project.id,
                    predecessor=prev_handover,
                    successor=act,
                    dependency_type="FS",
                    lag_days=0
                ))
            prev_handover = act
            sort_counter += 1

        return activities, dependencies
