from typing import List, Dict, Any, Set, Tuple
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
                G.add_edge(
                    dep.predecessor_id,
                    dep.successor_id,
                    dep_type=dep.dependency_type or "FS",
                    lag_days=dep.lag_days or 0
                )

        # BFS / Dijkstra-style traversal from source activity
        # We track {activity_id: (effective_delay, path_depth, [chain])}
        affected: Dict[int, Dict[str, Any]] = {}
        queue: List[Tuple[int, float, int, List[str]]] = [(source_activity_id, delay_days, 0, [source_act.name])]
        visited: Set[int] = {source_activity_id}

        critical_path_affected = False
        max_project_slippage = 0.0

        while queue:
            curr_id, curr_delay, depth, chain = queue.pop(0)

            # Check if this node is on critical path
            if G.nodes[curr_id].get("is_critical", False):
                critical_path_affected = True
                max_project_slippage = max(max_project_slippage, curr_delay)

            # Traverse direct successors
            for _, succ_id, data in G.out_edges(curr_id, data=True):
                succ_node = G.nodes[succ_id]
                succ_name = succ_node["name"]
                free_float = succ_node.get("free_float", 0)

                # Delay passed forward: absorbs free float
                absorbed_delay = max(0.0, curr_delay - free_float)
                new_chain = chain + [succ_name]

                if absorbed_delay > 0:
                    if succ_node.get("is_critical", False):
                        critical_path_affected = True
                        max_project_slippage = max(max_project_slippage, absorbed_delay)

                    # Determine severity
                    if absorbed_delay >= 5 or succ_node.get("is_critical"):
                        level = "CRITICAL" if succ_node.get("is_critical") else "HIGH"
                    elif absorbed_delay >= 2:
                        level = "MEDIUM"
                    else:
                        level = "LOW"

                    # If already in affected, keep maximum impact
                    if succ_id not in affected or affected[succ_id]["impact_days"] < absorbed_delay:
                        affected[succ_id] = {
                            "affected_activity_id": succ_id,
                            "affected_activity_name": succ_name,
                            "impact_days": round(absorbed_delay, 1),
                            "impact_level": level,
                            "path_depth": depth + 1,
                            "reason": f"Successor in chain from {source_act.name}; absorbed {free_float}d float.",
                            "cascade_chain": new_chain
                        }

                    queue.append((succ_id, absorbed_delay, depth + 1, new_chain))

        affected_list = list(affected.values())
        # Sort by depth then impact days descending
        affected_list.sort(key=lambda x: (x["path_depth"], -x["impact_days"]))

        # If source activity itself was critical, it directly slips project
        if source_act.is_critical:
            critical_path_affected = True
            max_project_slippage = max(max_project_slippage, delay_days)

        return {
            "source_activity_id": source_act.id,
            "source_activity_name": source_act.name,
            "delay_days": delay_days,
            "affected_activities": affected_list,
            "project_completion_slippage_days": round(max_project_slippage, 1),
            "critical_path_affected": critical_path_affected
        }
