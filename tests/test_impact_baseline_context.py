from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database.connection import Base
from backend.app.models.all_models import AIRecommendation, Activity, ActivityDependency, Project
from backend.app.schemas.all_schemas import AIRecommendationResponse, ImpactAnalysisResponse
from backend.app.api.ai import _recommendation_response
from backend.app.services.ai_service import get_baseline_recommendation_context
from backend.app.services.impact_service import ImpactService


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[Project.__table__, Activity.__table__, ActivityDependency.__table__],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def create_project(db):
    project = Project(
        name="Impact Test",
        code="PRJ-IMPACT-TEST",
        construction_type="Residential",
        location="Test site",
        built_up_area=1000,
        planned_start_date=date(2028, 1, 1),
        target_completion_date=date(2028, 12, 31),
    )
    db.add(project)
    db.flush()
    return project


@pytest.mark.parametrize(
    ("dependency_type", "baseline_gap"),
    [("FS", 2), ("SS", 2), ("FF", 2), ("SF", 2)],
)
def test_impact_uses_relationship_specific_baseline_window(db, dependency_type, baseline_gap):
    project = create_project(db)
    predecessor = Activity(
        project_id=project.id,
        name="Predecessor",
        start_date=date(2028, 1, 1),
        end_date=date(2028, 1, 5),
        baseline_start_date=date(2028, 1, 1),
        baseline_end_date=date(2028, 1, 5),
        planned_duration=5,
    )
    successor_start = date(2028, 1, 8) if dependency_type == "FS" else date(2028, 1, 3)
    successor_end = {
        "FS": date(2028, 1, 12),
        "SS": date(2028, 1, 7),
        "FF": date(2028, 1, 7),
        "SF": date(2028, 1, 3),
    }[dependency_type]
    successor = Activity(
        project_id=project.id,
        name="Successor",
        start_date=successor_start,
        end_date=successor_end,
        baseline_start_date=successor_start,
        baseline_end_date=successor_end,
        planned_duration=5,
        is_critical=True,
        baseline_task_id=603,
        phase="Superstructure",
        work_package="Frame",
        tower="Tower A",
        floor=2,
    )
    db.add_all([predecessor, successor])
    db.flush()
    db.add(
        ActivityDependency(
            project_id=project.id,
            predecessor_id=predecessor.id,
            successor_id=successor.id,
            dependency_type=dependency_type,
        )
    )
    db.commit()

    result = ImpactService.analyze_activity_delay(db, project.id, predecessor.id, 5)
    ImpactAnalysisResponse.model_validate(result)

    assert result["affected_activities"][0]["impact_days"] == 5 - baseline_gap
    assert result["affected_activities"][0]["baseline_task_id"] == 603
    assert result["affected_activities"][0]["impacted_start_date"] == successor_start + timedelta(days=3)
    expected_finish = max(date(2028, 1, 5), successor_end) + timedelta(days=3)
    assert result["projected_completion_date"] == expected_finish


def test_impact_falls_back_to_free_float_without_pdf_baseline(db):
    project = create_project(db)
    predecessor = Activity(
        project_id=project.id,
        name="Predecessor",
        start_date=date(2028, 1, 1),
        end_date=date(2028, 1, 5),
        planned_duration=5,
        free_float=2,
    )
    successor = Activity(
        project_id=project.id,
        name="Successor",
        start_date=date(2028, 1, 6),
        end_date=date(2028, 1, 10),
        planned_duration=5,
    )
    db.add_all([predecessor, successor])
    db.flush()
    db.add(
        ActivityDependency(
            project_id=project.id,
            predecessor_id=predecessor.id,
            successor_id=successor.id,
            dependency_type="FS",
        )
    )
    db.commit()

    result = ImpactService.analyze_activity_delay(db, project.id, predecessor.id, 5)

    assert result["affected_activities"][0]["impact_days"] == 3
    assert "baseline dates unavailable" in result["affected_activities"][0]["date_basis"]
    assert result["affected_activities"][0]["impacted_start_date"] == date(2028, 1, 9)


def test_impact_cycle_does_not_revisit_source_or_loop(db):
    project = create_project(db)
    activities = [
        Activity(
            project_id=project.id,
            name=name,
            start_date=date(2028, 1, 1),
            end_date=date(2028, 1, 5),
            baseline_start_date=date(2028, 1, 1),
            baseline_end_date=date(2028, 1, 5),
            planned_duration=5,
            free_float=0,
        )
        for name in ("A", "B", "C")
    ]
    db.add_all(activities)
    db.flush()
    db.add_all(
        [
            ActivityDependency(project_id=project.id, predecessor_id=activities[0].id, successor_id=activities[1].id),
            ActivityDependency(project_id=project.id, predecessor_id=activities[1].id, successor_id=activities[2].id),
            ActivityDependency(project_id=project.id, predecessor_id=activities[2].id, successor_id=activities[0].id),
        ]
    )
    db.commit()

    result = ImpactService.analyze_activity_delay(db, project.id, activities[0].id, 3)

    assert {item["affected_activity_id"] for item in result["affected_activities"]} == {
        activities[1].id,
        activities[2].id,
    }


def test_recommendation_context_compares_live_finish_to_baseline():
    activity = Activity(
        project_id=1,
        name="Slab pour",
        start_date=date(2028, 1, 1),
        end_date=date(2028, 1, 20),
        baseline_task_id=603,
        baseline_start_date=date(2028, 1, 1),
        baseline_end_date=date(2028, 1, 15),
        progress_percent=40,
        planned_duration=15,
    )

    context = get_baseline_recommendation_context(activity, today=date(2028, 1, 16))

    assert context["baseline_variance_days"] == 5
    assert any("5 calendar days later" in factor for factor in context["factors"])
    assert any("baseline finish passed" in factor for factor in context["factors"])


def test_recommendation_api_payload_includes_baseline_context():
    activity = Activity(
        id=4,
        project_id=1,
        name="Slab pour",
        phase="Superstructure",
        work_package="Frame",
        tower="Tower A",
        floor=2,
        start_date=date(2028, 1, 1),
        end_date=date(2028, 1, 20),
        baseline_task_id=604,
        baseline_start_date=date(2028, 1, 1),
        baseline_end_date=date(2028, 1, 15),
        planned_duration=15,
    )
    recommendation = AIRecommendation(
        id=7,
        project_id=1,
        activity_id=activity.id,
        risk_level="HIGH",
        issue_summary="Baseline schedule risk: Slab pour",
        contributing_factors_json="[]",
        ai_explanation="Review linked work against the baseline.",
        recommended_actions_json="[]",
        status="PENDING",
        created_at=datetime(2028, 1, 1),
    )

    response = AIRecommendationResponse.model_validate(
        _recommendation_response(recommendation, activity)
    )

    assert response.baseline_task_id == 604
    assert response.baseline_variance_days == 5
    assert response.phase == "Superstructure"
