"""Readiness checks: templates per type of work, snapshot onto each planned task, and the gate on starting it."""
import re
from typing import Dict, List

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, ReadinessTemplate, Task, TaskCheck

# (work type, keywords searched in the activity name / work package / phase) - first match wins
WORK_TYPE_RULES = [
    ("Excavation", ("EXCAVATION",)),
    ("Waterproofing", ("WATERPROOFING",)),
    ("Blockwork", ("BLOCKWORK",)),
    ("Slab / RCC", ("SLAB", "RCC", "SUB- STRUCTURE", "SUBSTRUCTURE", "EXTENDED BASEMENT", "SUPER- STRUCTURE")),
    ("MEP", ("PLUMBING", "ELECTRICAL", "FIRE FIGHTING", "LIFT", "SOLAR", "UGWT", "STP", "TRANSFORMER")),
    ("Finishing", ("PLASTER", "GRINDING", "TILING", "TILE GROUTING", "PAINTING", "FALSE CEILING", "ACID WASH",
                   "CARPENTRY", "FABRICATION", "ALUMINIUM", "ELEVATION", "VDP", "SANITARY", "SNAGGING", "CP")),
]
GENERAL = "General"

# Starting point; planning / quality can change it through the API.
DEFAULT_TEMPLATES: Dict[str, List[tuple]] = {
    "Excavation": [
        ("Approved drawings available", "Latest approved excavation drawing is on site", True),
        ("Underground services located", "Existing utilities marked before digging", True),
        ("Equipment and operators ready", "Excavators / tippers on site and fit", True),
        ("Barricading and safety in place", "Edge protection and signage", False),
    ],
    "Slab / RCC": [
        ("Approved drawings available", "Latest approved structural drawing", True),
        ("Formwork inspected", "Shuttering checked and cleared", True),
        ("Reinforcement inspected", "Bar bending and cover signed off by QA/QC", True),
        ("Concrete mix and supply confirmed", "Grade, quantity and slot confirmed with supplier", True),
        ("Pour permission signed", "Pre-pour clearance checklist", False),
    ],
    "Blockwork": [
        ("Approved drawings available", "Layout and openings confirmed", True),
        ("Blocks and mortar available", "Material on the floor or stacked nearby", True),
        ("Structure clearance given", "Slab / frame inspected and cleared for masonry", True),
    ],
    "Waterproofing": [
        ("Approved specification available", "System and thickness confirmed", True),
        ("Surface inspected and prepared", "Clean, dry, cracks treated", True),
        ("Material available", "Chemicals / membrane on site", True),
        ("Equipment ready", "Torch / sprayer / tools available", False),
    ],
    "MEP": [
        ("Approved drawings available", "Latest coordinated MEP drawing", True),
        ("Material available", "Pipes, cables, fittings on site", True),
        ("Sleeves and openings checked", "Civil provisions verified", False),
    ],
    "Finishing": [
        ("Material available", "Finishing material on site", True),
        ("Previous trade completed and inspected", "Work area handed over", True),
        ("Scaffolding and tools ready", "Access and equipment available", False),
    ],
    GENERAL: [
        ("Approved drawings available", "Relevant drawing or specification", True),
        ("Material available", "Material needed for the task", True),
    ],
}


def work_type_for(activity: Activity) -> str:
    text = " ".join(filter(None, [activity.name, activity.work_package, activity.category])).upper()
    for work_type, keywords in WORK_TYPE_RULES:
        if any(re.search(rf"(?<![A-Z]){re.escape(k)}(?![A-Z])", text) for k in keywords):
            return work_type
    return GENERAL


def ensure_default_templates(db: Session) -> int:
    """Seed the starter templates once (only when no template exists for that work type yet)."""
    created = 0
    for work_type, checks in DEFAULT_TEMPLATES.items():
        if db.query(ReadinessTemplate).filter(ReadinessTemplate.work_type == work_type).first():
            continue
        for order, (name, description, mandatory) in enumerate(checks):
            db.add(ReadinessTemplate(work_type=work_type, name=name, description=description,
                                     mandatory=mandatory, sort_order=order))
            created += 1
    if created:
        db.commit()
    return created


def issue_checks(db: Session, task: Task, activity: Activity) -> List[TaskCheck]:
    """Copy the active template checks for the activity's work type onto the task."""
    work_type = work_type_for(activity)
    templates = (db.query(ReadinessTemplate)
                 .filter(ReadinessTemplate.work_type == work_type, ReadinessTemplate.active == True)  # noqa: E712
                 .order_by(ReadinessTemplate.sort_order, ReadinessTemplate.id).all())
    checks = [TaskCheck(task_id=task.id, name=t.name, description=t.description, mandatory=t.mandatory,
                        sort_order=t.sort_order) for t in templates]
    db.add_all(checks)
    return checks


def unmet_mandatory(db: Session, task_id: int) -> List[str]:
    rows = (db.query(TaskCheck).filter(TaskCheck.task_id == task_id, TaskCheck.mandatory == True)  # noqa: E712
            .order_by(TaskCheck.sort_order, TaskCheck.id).all())
    return [c.name for c in rows if not (c.passed or c.waived)]


# --- Step lock ("pilot checklist"): checks are done in their listed order, no step can be skipped ----------------
# A check opens once every earlier *mandatory* check is done or waived; optional checks never hold up the next step.
# Unticking a step sends the checklist back to that point: every later ticked step is cleared and must be redone.

def _resolved(c: TaskCheck) -> bool:
    return bool(c.passed or c.waived)


def first_open_before(ordered: List[TaskCheck], target: TaskCheck):
    """The earliest mandatory check before `target` that is still open, or None when `target` may be done now."""
    for c in ordered:
        if c.id == target.id:
            return None
        if c.mandatory and not _resolved(c):
            return c
    return None


def clear_later_steps(ordered: List[TaskCheck], target: TaskCheck) -> List[str]:
    """Untick every ticked check after `target` (waivers are a PM decision and stay). Returns the names cleared."""
    cleared, after = [], False
    for c in ordered:
        if c.id == target.id:
            after = True
            continue
        if after and c.passed:
            c.passed = False
            c.checked_by_user_id = None
            c.checked_at = None
            cleared.append(c.name)
    return cleared
