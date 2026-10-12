from typing import List, Dict, Any, Set, Tuple
from datetime import timedelta
from math import ceil
import networkx as nx
from sqlalchemy.orm import Session
from backend.app.models.all_models import Activity, ActivityDependency, ImpactAnalysis

class ImpactService:
    @staticmethod
    def analyze_activity_delay(
        db: Session,
        project_id: int,
        source_activity_id: int,
        delay_days: float
    ) -> Dict[str, Any]:
        """
        Calculates downstream cascading delays when a source activity slips by `delay_days`.
        Propagates along the directed dependency graph, considering float absorption.
        """
        activities = db.query(Activity).filter(Activity.project_id == project_id).all()
        dependencies = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

        act_map = {a.id: a for a in activities}
        source_act = act_map.get(source_activity_id)
        if not source_act:
            raise ValueError(f"Activity {source_activity_id} not found")

        # Build directed graph
        G = nx.DiGraph()
        for a in activities:
            G.add_node(a.id, name=a.name, free_float=a.free_float or 0, total_float=a.total_float or 0, is_critical=a.is_critical)

        for dep in dependencies:
            if dep.predecessor_id in act_map and dep.successor_id in act_map:
                predecessor = act_map[dep.predecessor_id]
                successor = act_map[dep.successor_id]
                baseline_gap = None
                if predecessor.baseline_start_date and predecessor.baseline_end_date and successor.baseline_start_date and successor.baseline_end_date:
                    dependency_type = dep.dependency_type or "FS"
                    if dependency_type == "SS":
                        baseline_gap = (successor.baseline_start_date - predecessor.baseline_start_date).days - (dep.lag_days or 0)
                    elif dependency_type == "FF":
                        baseline_gap = (successor.baseline_end_date - predecessor.baseline_end_date).days - (dep.lag_days or 0)
                    elif dependency_type == "SF":
                        baseline_gap = (successor.baseline_end_date - predecessor.baseline_start_date).days - (dep.lag_days or 0)
                    else:
                        baseline_gap = (
                            successor.baseline_start_date - predecessor.baseline_end_date
                        ).days - 1 - (dep.lag_days or 0)
                G.add_edge(
                    dep.predecessor_id,
                    dep.successor_id,
                    dep_type=dep.dependency_type or "FS",
                    lag_days=dep.lag_days or 0,
                    baseline_gap_days=baseline_gap,
                )

        # Propagate each activity's greatest effective delay through the dependency graph.
        affected: Dict[int, Dict[str, Any]] = {}
        queue: List[Tuple[int, float, int, List[str], Set[int]]] = [
            (source_activity_id, delay_days, 0, [source_act.name], {source_activity_id})
        ]
        greatest_delay: Dict[int, float] = {source_activity_id: delay_days}

        critical_path_affected = False
        max_project_slippage = 0.0

        while queue:
            curr_id, curr_delay, depth, chain, path_ids = queue.pop(0)

            # Check if this node is on critical path
            if G.nodes[curr_id].get("is_critical", False):
                critical_path_affected = True
                max_project_slippage = max(max_project_slippage, curr_delay)

            # Traverse direct successors
            for _, succ_id, data in G.out_edges(curr_id, data=True):
                succ_node = G.nodes[succ_id]
                succ_name = succ_node["name"]
                if succ_id in path_ids:
                    continue
                baseline_gap = data.get("baseline_gap_days")
                free_float = max(
                    0.0,
                    baseline_gap if baseline_gap is not None else G.nodes[curr_id].get("free_float", 0),
                )

                absorbed_delay = max(0.0, curr_delay - free_float)
                if absorbed_delay <= 0 or absorbed_delay <= greatest_delay.get(succ_id, 0):
                    continue
                greatest_delay[succ_id] = absorbed_delay
                new_chain = chain + [succ_name]

                if succ_node.get("is_critical", False):
                    critical_path_affected = True
                    max_project_slippage = max(max_project_slippage, absorbed_delay)

                if absorbed_delay >= 5 or succ_node.get("is_critical"):
                    level = "CRITICAL" if succ_node.get("is_critical") else "HIGH"
                elif absorbed_delay >= 2:
                    level = "MEDIUM"
                else:
                    level = "LOW"

                successor = act_map[succ_id]
                baseline_start = successor.baseline_start_date
                baseline_end = successor.baseline_end_date
                date_basis = "PDF baseline" if baseline_start and baseline_end else "live plan (PDF baseline dates unavailable)"
                shift_days = ceil(absorbed_delay)
                affected[succ_id] = {
                    "affected_activity_id": succ_id,
                    "affected_activity_name": succ_name,
                    "activity_code": successor.code,
                    "baseline_task_id": successor.baseline_task_id,
                    "phase": successor.phase,
                    "work_package": successor.work_package,
                    "tower": successor.tower,
                    "floor": successor.floor,
                    "baseline_start_date": baseline_start,
                    "baseline_end_date": baseline_end,
                    "live_start_date": successor.start_date,
                    "live_end_date": successor.end_date,
                    "impacted_start_date": baseline_start + timedelta(days=shift_days) if baseline_start else successor.start_date + timedelta(days=shift_days),
                    "impacted_end_date": baseline_end + timedelta(days=shift_days) if baseline_end else successor.end_date + timedelta(days=shift_days),
                    "date_basis": date_basis,
                    "impact_days": round(absorbed_delay, 1),
                    "impact_level": level,
                    "path_depth": depth + 1,
                    "reason": (
                        f"{date_basis} dependency window absorbs {free_float:g}d before {round(absorbed_delay, 1)}d passes to this activity."
                    ),
                    "cascade_chain": new_chain,
                }

                queue.append((succ_id, absorbed_delay, depth + 1, new_chain, path_ids | {succ_id}))

        affected_list = list(affected.values())
        # Sort by depth then impact days descending
        affected_list.sort(key=lambda x: (x["path_depth"], -x["impact_days"]))

        # If source activity itself was critical, it directly slips project
        if source_act.is_critical:
            critical_path_affected = True
            max_project_slippage = max(max_project_slippage, delay_days)

        baseline_finish = max(
            (activity.baseline_end_date for activity in activities if activity.baseline_end_date),
            default=None,
        )
        projected_finish = (
            baseline_finish + timedelta(days=ceil(max_project_slippage))
            if baseline_finish
            else None
        )

        return {
            "source_activity_id": source_act.id,
            "source_activity_name": source_act.name,
            "source_activity_code": source_act.code,
            "source_baseline_task_id": source_act.baseline_task_id,
            "source_phase": source_act.phase,
            "source_work_package": source_act.work_package,
            "source_baseline_start_date": source_act.baseline_start_date,
            "source_baseline_end_date": source_act.baseline_end_date,
            "source_live_start_date": source_act.start_date,
            "source_live_end_date": source_act.end_date,
            "baseline_completion_date": baseline_finish,
            "projected_completion_date": projected_finish,
            "delay_days": delay_days,
            "affected_activities": affected_list,
            "project_completion_slippage_days": round(max_project_slippage, 1),
            "critical_path_affected": critical_path_affected
        }
