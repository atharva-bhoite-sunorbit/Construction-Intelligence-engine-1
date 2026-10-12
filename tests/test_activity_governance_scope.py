from types import SimpleNamespace

from backend.app.api.activities import is_structure_or_handover_activity


def make_activity(**overrides):
    fields = {
        "phase": "External Utilities",
        "work_package": "Infrastructure",
        "category": None,
        "subcategory": None,
        "name": "SITE MOBILIZATION",
    }
    fields.update(overrides)
    return SimpleNamespace(**fields)


def test_structure_and_handover_activities_are_in_scope():
    assert is_structure_or_handover_activity(make_activity(phase="Substructure"))
    assert is_structure_or_handover_activity(
        make_activity(work_package="RCC & Shear Wall", name="LEVEL 2 SLAB")
    )
    assert is_structure_or_handover_activity(
        make_activity(phase="External Utilities", name="OCCUPANCY CERTIFICATE")
    )


def test_infrastructure_is_not_mistaken_for_structure():
    assert not is_structure_or_handover_activity(make_activity())
