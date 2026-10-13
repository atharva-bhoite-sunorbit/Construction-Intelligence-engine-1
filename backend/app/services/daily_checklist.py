"""The daily checklist for each role (the "Real Estate Bible"): a short list done in order every day, no step skipped.

Each person ticks their own list for a project, for today only; past days are a read-only record. A step opens once
every earlier step is done. Unticking a step clears the steps after it, so the order always holds.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models.all_models import DailyCheck, DailyChecklistItem, User

# the checklist a role follows; "Engineer" is the older name of a site engineer
ROLE_LIST = {"Site Engineer": "Site Engineer", "Engineer": "Site Engineer", "Site Manager": "Site Manager",
             "Project Manager": "Project Manager", "Top Management": "Top Management"}

DEFAULT_ITEMS: Dict[str, List[tuple]] = {
    "Site Engineer": [
        ("Read today's plan", "Open Today and go through the work planned for your floors"),
        ("Labour on site", "Gangs for today's work have reported and match the plan"),
        ("Material at the workface", "Steel, shuttering, concrete or blocks needed today are on the floor"),
        ("Safety walk", "PPE worn, edge protection and openings covered on your floors"),
        ("Readiness checks for work starting today", "Tick the checks on each task before you start it"),
        ("Update progress", "Record progress on every task you worked on"),
        ("Report what stopped work", "Log a problem for anything that held up work, and pick a Plan B"),
        ("Confirm the next 5 days", "Look at the coming days and flag anything that will not be ready"),
    ],
    "Site Manager": [
        ("Morning meeting", "Engineers and contractors agree today's plan"),
        ("Deliveries and vendors", "Material and vendors due today have arrived or are confirmed"),
        ("Blocked work has a Plan B", "Every blocked item has another piece of work going on"),
        ("Safety and quality round", "Walk the site with the safety and QA/QC team"),
        ("Progress against plan", "Check each tower against today's plan"),
        ("Escalate old problems", "Raise anything open for more than 7 days with the project manager"),
    ],
    "Project Manager": [
        ("Approvals waiting", "Decide on unplanned work waiting for approval"),
        ("New problems", "Review new problems and confirm or reject their delay"),
        ("Plan against actual", "Check each tower against the plan and the finish date"),
        ("Drawings and vendors", "Chase pending drawings, approvals and vendor commitments"),
        ("Close the day", "Agree tomorrow's priorities with the site managers"),
    ],
    "Top Management": [
        ("Needs attention", "Go through the list of overdue and stuck items"),
        ("Projects slipping", "Check which projects are behind their plan"),
        ("Escalated delays", "Read delays escalated to directors and decide the action"),
        ("Decisions waiting on you", "Approvals or decisions the team is waiting for"),
    ],
}


def ensure_default_daily_items(db: Session) -> int:
    created = 0
    for role, items in DEFAULT_ITEMS.items():
        if db.query(DailyChecklistItem).filter(DailyChecklistItem.role == role).first():
            continue
        for order, (name, description) in enumerate(items):
            db.add(DailyChecklistItem(role=role, name=name, description=description, sort_order=order))
            created += 1
    if created:
        db.commit()
    return created


class ChecklistError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.status_code = status_code


def _items(db: Session, role: Optional[str]) -> List[DailyChecklistItem]:
    if not role:
        return []
    return (db.query(DailyChecklistItem)
            .filter(DailyChecklistItem.role == role, DailyChecklistItem.active == True)  # noqa: E712
            .order_by(DailyChecklistItem.sort_order, DailyChecklistItem.id).all())


def checklist(db: Session, user: User, project_id: int, day: date, today: Optional[date] = None) -> Dict[str, Any]:
    today = today or date.today()
    role = ROLE_LIST.get(user.role)
    items = _items(db, role)
    done = {c.item_id: c for c in db.query(DailyCheck).filter(
        DailyCheck.user_id == user.id, DailyCheck.project_id == project_id, DailyCheck.day == day)}
    out, blocked_by = [], None
    for step, it in enumerate(items, start=1):
        row = done.get(it.id)
        out.append({"id": it.id, "step": step, "name": it.name, "description": it.description,
                    "done": row is not None, "done_at": row.done_at if row else None,
                    "locked": row is None and blocked_by is not None, "locked_by": blocked_by})
        if row is None and blocked_by is None:
            blocked_by = it.name
    return {"role": role, "day": day, "editable": day == today and bool(items),
            "done": sum(1 for i in out if i["done"]), "total": len(out), "items": out}


def set_step(db: Session, user: User, project_id: int, item_id: int, done: bool, today: Optional[date] = None) -> Dict[str, Any]:
    today = today or date.today()
    role = ROLE_LIST.get(user.role)
    items = _items(db, role)
    if not items:
        raise ChecklistError("Your role has no daily checklist", 403)
    index = next((i for i, it in enumerate(items) if it.id == item_id), None)
    if index is None:
        raise ChecklistError("That step is not on your checklist", 404)
    rows = {c.item_id: c for c in db.query(DailyCheck).filter(
        DailyCheck.user_id == user.id, DailyCheck.project_id == project_id, DailyCheck.day == today)}
    if done:
        if item_id not in rows:
            earlier = next((it for it in items[:index] if it.id not in rows), None)
            if earlier is not None:
                raise ChecklistError(f"Do the steps in order: '{earlier.name}' comes first")
            db.add(DailyCheck(project_id=project_id, user_id=user.id, item_id=item_id, day=today, done_at=datetime.utcnow()))
    else:
        for it in items[index:]:          # this step and every later one go back to not done
            if it.id in rows:
                db.delete(rows[it.id])
    db.commit()
    return checklist(db, user, project_id, today, today)
