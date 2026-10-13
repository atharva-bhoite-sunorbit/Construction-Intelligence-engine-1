from datetime import date
from types import SimpleNamespace

from backend.app.services.cpm_engine import CPMEngine


def _act(i, duration):
    return SimpleNamespace(id=i, planned_duration=duration, name=f"A{i}")


def _dep(pred, succ, kind="FS", lag=0):
    return SimpleNamespace(predecessor_id=pred, successor_id=succ, dependency_type=kind, lag_days=lag)


def test_longest_path_is_critical_when_it_has_a_start_to_start_successor():
    # A (10d) is the longest thing in the project, but B (2d) starts 1 day after A starts.
    # B has float, A does not: A still defines the project end.
    result = CPMEngine.calculate_cpm([_act(1, 10), _act(2, 2)], [_dep(1, 2, "SS", 1)], date(2026, 1, 1))
    assert result["project_duration_days"] == 10
    assert result["activity_updates"][1]["total_float"] == 0
    assert 1 in result["critical_activity_ids"]
    assert result["activity_updates"][2]["total_float"] > 0


def test_plain_finish_to_start_chain_is_all_critical():
    result = CPMEngine.calculate_cpm([_act(1, 3), _act(2, 4)], [_dep(1, 2)], date(2026, 1, 1))
    assert result["project_duration_days"] == 7
    assert set(result["critical_activity_ids"]) == {1, 2}
