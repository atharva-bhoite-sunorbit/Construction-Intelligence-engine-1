from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.progress import list_blockers, report_blocker, router
from backend.app.database.connection import Base, get_db
from backend.app.models.all_models import Activity, AuditLog, Blocker, Project, User
from backend.app.schemas.all_schemas import BlockerCreate, BlockerResponse, BlockerSubmissionResponse
from backend.app.utils.security import get_current_user


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Project.__table__,
            User.__table__,
            Activity.__table__,
            Blocker.__table__,
            AuditLog.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_reported_hindrance_is_persisted_for_admin_register(db):
    project = Project(
        name="Hindrance Register Test",
        code="PRJ-HINDRANCE-TEST",
        construction_type="Residential",
        location="Test site",
        built_up_area=1000,
        planned_start_date=date(2028, 1, 1),
        target_completion_date=date(2028, 12, 31),
    )
    db.add(project)
    db.flush()
    activity = Activity(
        project_id=project.id,
        name="Foundation excavation",
        start_date=date(2028, 1, 1),
        end_date=date(2028, 1, 10),
        planned_duration=10,
    )
    db.add(activity)
    db.commit()

    saved = report_blocker(
        project_id=project.id,
        blocker_in=BlockerCreate(
            activity_id=activity.id,
            category="Groundwater & Water Ingress",
            description="Water ingress is preventing excavation work.",
            severity="HIGH",
            opened_date=date(2028, 1, 3),
            delay_impact_days=4,
        ),
        db=db,
        current_user=None,
    )
    admin_register = list_blockers(project_id=project.id, db=db, admin=None)

    receipt = BlockerSubmissionResponse.model_validate(saved)
    assert set(saved) == {"id", "project_id", "status", "created_at", "message"}
    assert db.query(Blocker).filter(Blocker.id == receipt.id).one().description == (
        "Water ingress is preventing excavation work."
    )
    assert len(admin_register) == 1
    response = BlockerResponse.model_validate(admin_register[0])
    assert response.id == receipt.id
    assert response.activity_name == "Foundation excavation"
    assert response.delay_impact_days == 4


def test_hindrance_register_api_is_admin_only(db):
    project = Project(
        name="Admin Access Test",
        code="PRJ-HINDRANCE-ACCESS-TEST",
        construction_type="Residential",
        location="Test site",
        built_up_area=1000,
        planned_start_date=date(2028, 1, 1),
        target_completion_date=date(2028, 12, 31),
    )
    db.add(project)
    db.commit()
    db.add(
        Blocker(
            project_id=project.id,
            category="Material Delay",
            description="Supplier delay is stopping the scheduled work.",
            severity="HIGH",
            opened_date=date(2028, 2, 1),
            status="OPEN",
        )
    )
    db.commit()

    app = FastAPI()
    app.include_router(router)

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: User(
        id=7,
        email="site.manager@example.test",
        full_name="Site Manager",
        hashed_password="unused",
        role="Site Manager",
    )
    assert client.get(f"/api/projects/{project.id}/blockers").status_code == 403

    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        email="admin@example.test",
        full_name="Admin",
        hashed_password="unused",
        role="Admin",
    )
    admin_response = client.get(f"/api/projects/{project.id}/blockers")
    assert admin_response.status_code == 200
    assert len(admin_response.json()) == 1
    assert admin_response.json()[0]["description"] == (
        "Supplier delay is stopping the scheduled work."
    )
