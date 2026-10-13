"""The planned order of work: which activity follows which, what is ready to start, and what each one is waiting for.

Order comes from the dependency network (predecessors always come first), with ties broken by planned start date.
"Ready" is guidance for the site team, not a lock: an activity is ready when every finish-to-start predecessor is done
and every start-to-start predecessor has started. Finish-to-finish and start-to-finish links do not hold up a start.
A negative lag is a lead: "FS-5 days" lets the work begin 5 working days before the predecessor finishes, and
"SS-10 days" means the work is meant to start before the predecessor does, so it never waits for it.
"""
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import networkx as nx
from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, ActivityDependency

DONE, RUNNING, READY, WAITING = "DONE", "IN_PROGRESS", "READY", "WAITING"


def _finished(a: Activity) -> bool:
    return a.status == "COMPLETED" or (a.progress_percent or 0) >= 100


def _started(a: Activity) -> bool:
    return bool(a.actual_start_date) or (a.progress_percent or 0) > 0 or a.status in ("IN_PROGRESS", "COMPLETED")


def compute_sequence(db: Session, project_id: int, today: Optional[date] = None) -> List[Dict[str, Any]]:
    today = today or date.today()
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    by_id = {a.id: a for a in activities}
    deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

    graph = nx.DiGraph()
    graph.add_nodes_from(by_id)
    for dep in deps:
        if dep.predecessor_id in by_id and dep.successor_id in by_id:
            graph.add_edge(dep.predecessor_id, dep.successor_id)

    key = lambda aid: (by_id[aid].start_date, by_id[aid].sort_order or 0, aid)  # noqa: E731
    try:
        order = list(nx.lexicographical_topological_sort(graph, key=key))
    except nx.NetworkXUnfeasible:  # a cycle should never get in, but never fail a screen because of one
        order = sorted(by_id, key=key)

    preds_of: Dict[int, List[ActivityDependency]] = {}
    for dep in deps:
        if dep.predecessor_id in by_id and dep.successor_id in by_id:
            preds_of.setdefault(dep.successor_id, []).append(dep)

    result = []
    for step, aid in enumerate(order, start=1):
        a = by_id[aid]
        predecessors, waiting_on = [], []
        for dep in preds_of.get(aid, []):
            p = by_id[dep.predecessor_id]
            kind = dep.dependency_type or "FS"
            lag = dep.lag_days or 0
            if kind == "FS":
                lead_time_reached = lag < 0 and bool(p.end_date) and p.end_date + timedelta(days=round(lag * 7 / 6)) <= today
                satisfied = _finished(p) or lead_time_reached
            elif kind == "SS":
                satisfied = _started(p) or lag < 0
            else:
                satisfied = True  # FF / SF do not stop the work from starting
            predecessors.append({"id": p.id, "name": p.name, "type": kind, "lag_days": dep.lag_days or 0, "done": satisfied})
            if not satisfied:
                waiting_on.append(p.name)
        if _finished(a):
            state = DONE
        elif _started(a):
            state = RUNNING
        elif waiting_on:
            state = WAITING
        else:
            state = READY
        result.append({
            "activity_id": a.id, "step": step, "name": a.name, "tower": a.tower, "state": state,
            "waiting_on": waiting_on, "predecessors": predecessors, "status": a.status,
            "progress_percent": a.progress_percent or 0.0, "start_date": a.start_date, "end_date": a.end_date,
            "planned_duration": a.planned_duration,
        })
    return result


def sequence_index(db: Session, project_id: int) -> Dict[int, Dict[str, Any]]:
    return {item["activity_id"]: item for item in compute_sequence(db, project_id)}
