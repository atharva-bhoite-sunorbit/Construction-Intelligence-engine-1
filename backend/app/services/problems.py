"""Problems (blockers): what was reported, what the system estimates, and what the PM has confirmed.

A reported problem is NOT a delay. The system proposes an impact from the dependency graph and float; only a
PM-confirmed impact appears in delay reports. Proposals use working days (6-day week), like activity durations.
"""
from collections import defaultdict
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, Blocker
from backend.app.services.impact_service import ImpactService

CATEGORIES = [
    "Material not available",
    "Labour shortage",
    "Equipment unavailable",
    "Drawing or design approval pending",
    "Client decision pending",
    "Waiting on another activity",
    "Site access or coordination",
    "Weather",
    "Quality issue or rework",
    "Other",
]
SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
CALENDAR_TO_WORKING = 6 / 7  # six-day work week


def blocked_working_days(blocker: Blocker, today: Optional[date] = None) -> float:
    """Days the work has been (or is expected to be) held up: until resolved, else the expected fix date, else today."""
    today = today or date.today()
    end = blocker.resolved_date or blocker.expected_resolution or today
    calendar = max((end - blocker.opened_date).days, 0)
    return round(calendar * CALENDAR_TO_WORKING, 1)


def refresh_proposal(db: Session, blocker: Blocker, today: Optional[date] = None) -> None:
    """Recompute the system's estimate. Never touches the PM's confirmed numbers."""
    from datetime import datetime

    blocker.proposed_at = datetime.utcnow()
    if not blocker.activity_id:
        # Project-wide problem: no activity to push through the network, the PM sets the impact by hand.
        blocker.proposed_delay_days = None
        blocker.proposed_project_delay_days = None
        blocker.proposed_on_critical_path = None
        blocker.proposal_note = "Not tied to one activity, so the system cannot estimate the effect. The project manager decides."
        return
    days = blocked_working_days(blocker, today)
    activity = db.query(Activity).filter(Activity.id == blocker.activity_id).first()
    try:
        result = ImpactService.analyze_activity_delay(db, blocker.project_id, blocker.activity_id, float(days))
    except ValueError:
        result = {"affected_activities": [], "project_completion_slippage_days": 0.0, "critical_path_affected": False}
    affected = result["affected_activities"]
    project_days = float(result["project_completion_slippage_days"] or 0.0)
    blocker.proposed_delay_days = days
    blocker.proposed_project_delay_days = project_days
    blocker.proposed_on_critical_path = bool(result["critical_path_affected"])
    name = activity.name if activity else "the activity"
    parts = [f"Holds up “{name}” for about {days:g} working day{'s' if days != 1 else ''}."]
    if affected:
        parts.append(f"Pushes {len(affected)} later activit{'ies' if len(affected) != 1 else 'y'}.")
    if blocker.proposed_on_critical_path and project_days > 0:
        parts.append(f"It is on the critical path, so the project end slips by about {project_days:g} day{'s' if project_days != 1 else ''}.")
    elif days > 0:
        parts.append("The project end is not expected to move: float absorbs the delay.")
    blocker.proposal_note = " ".join(parts)
    if blocker.impact_status == "NOT_ASSESSED":
        blocker.impact_status = "PROPOSED"


def needs_review(blocker: Blocker) -> bool:
    return blocker.impact_status in ("NOT_ASSESSED", "PROPOSED")


def estimate_changed_since_confirmed(blocker: Blocker) -> bool:
    """The PM confirmed a number, but the system's latest estimate now differs (e.g. the fix took longer)."""
    if blocker.impact_status != "CONFIRMED" or blocker.proposed_delay_days is None:
        return False
    return abs((blocker.proposed_delay_days or 0) - (blocker.confirmed_delay_days or 0)) >= 1 or \
        abs((blocker.proposed_project_delay_days or 0) - (blocker.confirmed_project_delay_days or 0)) >= 1


def delay_summary(db: Session, project_id: int, allowed_towers=None) -> Dict[str, Any]:
    """Confirmed delay and unreviewed problems, kept apart so management is not misled."""
    rows: List[Blocker] = db.query(Blocker).filter(Blocker.project_id == project_id).all()
    towers = {a.id: a.tower for a in db.query(Activity).filter(Activity.project_id == project_id).all()}
    if allowed_towers is not None:
        rows = [b for b in rows if b.activity_id is None or towers.get(b.activity_id) in allowed_towers
                or towers.get(b.activity_id) in {"Common", "All"}]
    confirmed = [b for b in rows if b.impact_status == "CONFIRMED"]
    waiting = [b for b in rows if needs_review(b)]  # open or already fixed: the PM still has to say whether it cost time
    by_category: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"problems": 0, "open": 0, "confirmed_delay_days": 0.0})
    for b in rows:
        entry = by_category[b.category]
        entry["problems"] += 1
        entry["open"] += 1 if b.status != "RESOLVED" else 0
        entry["confirmed_delay_days"] += (b.confirmed_delay_days or 0.0) if b.impact_status == "CONFIRMED" else 0.0
    return {
        "open_problems": sum(1 for b in rows if b.status != "RESOLVED"),
        "waiting_for_review": len(waiting),
        "confirmed_problems": len(confirmed),
        "confirmed_activity_delay_days": round(sum(b.confirmed_delay_days or 0 for b in confirmed), 1),
        "largest_confirmed_project_delay_days": round(max((b.confirmed_project_delay_days or 0 for b in confirmed), default=0.0), 1),
        "unconfirmed": [
            {"id": b.id, "category": b.category, "proposed_project_delay_days": b.proposed_project_delay_days}
            for b in waiting
        ],
        "by_category": sorted(
            ({"category": k, **{kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in d.items()}} for k, d in by_category.items()),
            key=lambda e: (-e["confirmed_delay_days"], -e["problems"]),
        ),
    }
