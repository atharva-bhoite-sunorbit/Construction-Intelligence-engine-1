from typing import List, Dict, Any, Tuple, Set, Optional
import networkx as nx
from backend.app.models.all_models import Activity, ActivityDependency

class CircularDependencyException(Exception):
    def __init__(self, cycle_path: List[str]):
        self.cycle_path = cycle_path
        super().__init__(f"Circular dependency detected: {' -> '.join(cycle_path)}. Please review the activity sequence.")


class DependencyEngine:
    @staticmethod
    def build_graph(activities: List[Activity], dependencies: List[ActivityDependency]) -> nx.DiGraph:
        """Build a directed graph of activities and dependencies."""
        G = nx.DiGraph()
        act_map = {a.id: a.name for a in activities}

        for act in activities:
            G.add_node(act.id, name=act.name, duration=act.planned_duration, act=act)

        for dep in dependencies:
            if dep.predecessor_id in act_map and dep.successor_id in act_map:
                G.add_edge(
                    dep.predecessor_id,
                    dep.successor_id,
                    dep_type=dep.dependency_type,
                    lag_days=dep.lag_days,
                    id=dep.id
                )

        return G

    @staticmethod
    def validate_no_cycles(activities: List[Activity], dependencies: List[ActivityDependency], new_dep: Optional[Tuple[int, int]] = None):
        """Checks if adding a dependency introduces a circular dependency."""
        G = DependencyEngine.build_graph(activities, dependencies)
        act_map = {a.id: a.name for a in activities}

        if new_dep:
            pred_id, succ_id = new_dep
            G.add_edge(pred_id, succ_id, dep_type="FS", lag_days=0)

        try:
            cycles = list(nx.simple_cycles(G))
            if cycles:
                # Format cycle with activity names
                first_cycle = cycles[0]
                cycle_names = [act_map.get(node_id, f"Activity {node_id}") for node_id in first_cycle]
                cycle_names.append(cycle_names[0]) # complete the loop
                raise CircularDependencyException(cycle_names)
        except nx.NetworkXNoCycle:
            pass

        return True

    @staticmethod
    def get_predecessors_and_successors(activities: List[Activity], dependencies: List[ActivityDependency]) -> Dict[str, Any]:
        """Returns adjacency analysis including predecessors, successors, and parallel candidates."""
        G = DependencyEngine.build_graph(activities, dependencies)
        analysis = {}

        for act in activities:
            preds = list(G.predecessors(act.id))
            succs = list(G.successors(act.id))
            analysis[act.id] = {
                "predecessor_ids": preds,
                "successor_ids": succs,
                "is_leaf": len(succs) == 0,
                "is_root": len(preds) == 0,
            }

        return analysis

    @staticmethod
    def find_parallel_activities(activities: List[Activity], dependencies: List[ActivityDependency]) -> List[List[int]]:
        """Identify sets of activities that have no mutual dependency order and can run concurrently."""
        G = DependencyEngine.build_graph(activities, dependencies)
        # Topological generation provides levels of activities that can run in parallel
        if not nx.is_directed_acyclic_graph(G):
            return []

        levels = list(nx.topological_generations(G))
        return [list(gen) for gen in levels if len(gen) > 1]
