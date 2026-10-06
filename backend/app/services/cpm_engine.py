from typing import List, Dict, Any, Tuple
import networkx as nx
from datetime import date, timedelta
from backend.app.models.all_models import Activity, ActivityDependency

class CPMEngine:
    @staticmethod
    def calculate_cpm(
        activities: List[Activity],
        dependencies: List[ActivityDependency],
        project_start_date: date
    ) -> Dict[str, Any]:
        """
        Executes Forward Pass, Backward Pass, Float calculations, and Critical Path detection.
        Returns updated activity timing dict and list of critical activity IDs.
        """
        if not activities:
            return {
                "activity_updates": {},
                "critical_activity_ids": [],
                "project_duration_days": 0,
                "project_finish_date": project_start_date
            }

        act_dict = {a.id: a for a in activities}
        node_ids = list(act_dict.keys())

        # Build graph
        G = nx.DiGraph()
        for a in activities:
            dur = max(1, a.planned_duration)
            G.add_node(a.id, duration=dur, name=a.name)

        for dep in dependencies:
            if dep.predecessor_id in act_dict and dep.successor_id in act_dict:
                G.add_edge(
                    dep.predecessor_id,
                    dep.successor_id,
                    dep_type=dep.dependency_type or "FS",
                    lag_days=dep.lag_days or 0
                )

        # Verify acyclic
        if not nx.is_directed_acyclic_graph(G):
            # Fallback sequential if cyclic or broken
            topo_order = node_ids
        else:
            topo_order = list(nx.topological_sort(G))

        # 1. FORWARD PASS
        es: Dict[int, int] = {}
        ef: Dict[int, int] = {}

        for u in topo_order:
            dur = G.nodes[u]["duration"]
            in_edges = list(G.in_edges(u, data=True))
            if not in_edges:
                es[u] = 0
            else:
                max_es = 0
                for pred, _, data in in_edges:
                    dep_type = data.get("dep_type", "FS")
                    lag = data.get("lag_days", 0)
                    pred_dur = G.nodes[pred]["duration"]
                    pred_es = es.get(pred, 0)
                    pred_ef = ef.get(pred, pred_es + pred_dur)

                    if dep_type == "FS":
                        cand_es = pred_ef + lag
                    elif dep_type == "SS":
                        cand_es = pred_es + lag
                    elif dep_type == "FF":
                        cand_es = pred_ef + lag - dur
                    elif dep_type == "SF":
                        cand_es = pred_es + lag - dur
                    else:
                        cand_es = pred_ef + lag

                    max_es = max(max_es, cand_es)
                es[u] = max(0, max_es)
            ef[u] = es[u] + dur

        project_duration = max(ef.values()) if ef else 0

        # 2. BACKWARD PASS
        lf: Dict[int, int] = {}
        ls: Dict[int, int] = {}

        for u in reversed(topo_order):
            dur = G.nodes[u]["duration"]
            out_edges = list(G.out_edges(u, data=True))
            if not out_edges:
                lf[u] = project_duration
            else:
                min_lf = float("inf")
                for _, succ, data in out_edges:
                    dep_type = data.get("dep_type", "FS")
                    lag = data.get("lag_days", 0)
                    succ_ls = ls.get(succ, es.get(succ, 0))
                    succ_lf = lf.get(succ, ef.get(succ, 0))

                    if dep_type == "FS":
                        cand_lf = succ_ls - lag
                    elif dep_type == "SS":
                        cand_lf = succ_ls - lag + dur
                    elif dep_type == "FF":
                        cand_lf = succ_lf - lag
                    elif dep_type == "SF":
                        cand_lf = succ_lf - lag + dur
                    else:
                        cand_lf = succ_ls - lag

                    min_lf = min(min_lf, cand_lf)
                lf[u] = int(min_lf)
            ls[u] = lf[u] - dur

        # 3. FLOAT & CRITICAL PATH
        total_float: Dict[int, int] = {}
        free_float: Dict[int, int] = {}
        critical_ids: List[int] = []

        for u in topo_order:
            tf = ls[u] - es[u]
            total_float[u] = max(0, tf)

            out_edges = list(G.out_edges(u, data=True))
            if not out_edges:
                free_float[u] = max(0, project_duration - ef[u])
            else:
                min_succ_es = min(es.get(succ, ef[u]) - data.get("lag_days", 0) for _, succ, data in out_edges)
                free_float[u] = max(0, min_succ_es - ef[u])

            if total_float[u] <= 0:
                critical_ids.append(u)

        # 4. MAP TO CALENDAR DATES
        activity_updates = {}
        for u in node_ids:
            act_start = project_start_date + timedelta(days=es.get(u, 0))
            act_dur = G.nodes[u]["duration"]
            act_end = act_start + timedelta(days=max(1, act_dur) - 1)
            activity_updates[u] = {
                "early_start": es.get(u, 0),
                "early_finish": ef.get(u, 0),
                "late_start": ls.get(u, 0),
                "late_finish": lf.get(u, 0),
                "total_float": total_float.get(u, 0),
                "free_float": free_float.get(u, 0),
                "is_critical": u in critical_ids,
                "calculated_start_date": act_start,
                "calculated_end_date": act_end,
            }

        project_finish_date = project_start_date + timedelta(days=max(0, project_duration - 1))

        return {
            "activity_updates": activity_updates,
            "critical_activity_ids": critical_ids,
            "project_duration_days": project_duration,
            "project_finish_date": project_finish_date
        }
