from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.all_models import Resource, ActivityResourcePlan, Activity, DailyProgress

class ResourceService:
    @staticmethod
    def get_project_resources_summary(db: Session, project_id: int) -> Dict[str, Any]:
        """
        Returns full resource breakdown across Labour, Material, Equipment.
        Calculates Required, Available, Allocated, Shortage, and Utilization.
        """
        resources = db.query(Resource).filter(Resource.project_id == project_id).all()
        plans = (
            db.query(ActivityResourcePlan)
            .join(Activity)
            .filter(Activity.project_id == project_id)
            .all()
        )

        # Aggregate requirements per resource
        res_req: Dict[int, float] = {}
        res_alloc: Dict[int, float] = {}
        for p in plans:
            res_req[p.resource_id] = res_req.get(p.resource_id, 0.0) + (p.required_qty or 0.0)
            res_alloc[p.resource_id] = res_alloc.get(p.resource_id, 0.0) + (p.allocated_qty or 0.0)

        categories = {"Labour": [], "Materials": [], "Equipment": []}
        totals = {
            "Labour": {"required": 0.0, "available": 0.0, "allocated": 0.0, "shortage": 0.0},
            "Materials": {"required": 0.0, "available": 0.0, "allocated": 0.0, "shortage": 0.0},
            "Equipment": {"required": 0.0, "available": 0.0, "allocated": 0.0, "shortage": 0.0},
        }

        for r in resources:
            cat_key = "Materials" if r.category.lower().startswith("mat") else ("Equipment" if r.category.lower().startswith("eq") else "Labour")
            req = res_req.get(r.id, 0.0)
            alloc = res_alloc.get(r.id, 0.0)
            avail = r.available_capacity or 0.0
            shortage = max(0.0, req - avail)
            utilization = round((alloc / avail * 100.0) if avail > 0 else 0.0, 1)

            item = {
                "id": r.id,
                "project_id": r.project_id,
                "category": r.category,
                "type_name": r.type_name,
                "unit": r.unit,
                "standard_rate": r.standard_rate,
                "available_capacity": avail,
                "total_required": req,
                "total_allocated": alloc,
                "shortage": shortage,
                "utilization_percent": min(100.0, utilization),
                "notes": r.notes
            }
            categories[cat_key].append(item)

            totals[cat_key]["required"] += req
            totals[cat_key]["available"] += avail
            totals[cat_key]["allocated"] += alloc
            totals[cat_key]["shortage"] += shortage

        return {
            "project_id": project_id,
            "totals": totals,
            "resources": categories
        }

    @staticmethod
    def initialize_standard_resources_for_project(db: Session, project_id: int):
        """Creates the full standard suite of Labour, Materials, and Equipment for a new project."""
        standard_labour = [
            ("Mason", "workers", 35.0, 15),
            ("Carpenter", "workers", 35.0, 18),
            ("Steel Fixer", "workers", 38.0, 20),
            ("Electrician", "workers", 40.0, 8),
            ("Plumber", "workers", 38.0, 6),
            ("Painter", "workers", 30.0, 12),
            ("Welder", "workers", 42.0, 6),
            ("Fabricator", "workers", 40.0, 5),
            ("Equipment Operator", "workers", 45.0, 6),
            ("Site Supervisor", "staff", 60.0, 4),
            ("Site Engineer", "staff", 80.0, 3)
        ]

        standard_materials = [
            ("Cement (OPC/PPC)", "bags", 8.5, 3500),
            ("TMT Steel Rebar Fe500", "tons", 750.0, 120),
            ("Ready Mix Concrete M35", "m3", 110.0, 450),
            ("River Sand / M-Sand", "tons", 25.0, 600),
            ("Coarse Aggregate 20mm", "tons", 22.0, 800),
            ("AAC Concrete Blocks", "blocks", 1.8, 12000),
            ("Vitrified Floor Tiles", "sq.m", 18.0, 2500),
            ("Interior Acrylic Paint", "litres", 6.0, 1800),
            ("Glazing Glass Panels", "sq.m", 45.0, 400),
            ("CPVC / PVC Piping", "meters", 12.0, 3200),
            ("Armoured Power Cables", "meters", 8.0, 4500)
        ]

        standard_equipment = [
            ("Tower Crane 50m", "units", 250.0, 2),
            ("Mobile Concrete Pump", "units", 180.0, 2),
            ("Hydraulic Excavator", "units", 150.0, 2),
            ("Concrete Transit Mixer", "units", 120.0, 4),
            ("EOT Overhead Crane", "units", 200.0, 1),
            ("Diesel Backup Generator 250kVA", "units", 90.0, 2),
            ("Cuplock Heavy Scaffolding", "sets", 15.0, 50),
            ("Industrial Forklift 3-Ton", "units", 75.0, 2)
        ]

        for name, unit, rate, capacity in standard_labour:
            db.add(Resource(
                project_id=project_id,
                category="Labour",
                type_name=name,
                unit=unit,
                standard_rate=rate,
                available_capacity=capacity
            ))

        for name, unit, rate, capacity in standard_materials:
            db.add(Resource(
                project_id=project_id,
                category="Material",
                type_name=name,
                unit=unit,
                standard_rate=rate,
                available_capacity=capacity
            ))

        for name, unit, rate, capacity in standard_equipment:
            db.add(Resource(
                project_id=project_id,
                category="Equipment",
                type_name=name,
                unit=unit,
                standard_rate=rate,
                available_capacity=capacity
            ))

        db.commit()
