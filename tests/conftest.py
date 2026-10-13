"""Run the whole suite against a throw-away SQLite file, never the developer's real database.

DATABASE_URL must be set before backend.app is imported anywhere, so this happens at import time
of conftest (pytest loads it before collecting test modules).
"""
import os
import tempfile

_TMP_DIR = tempfile.mkdtemp(prefix="cie-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP_DIR, 'test.db')}"
os.environ.setdefault("SECRET_KEY", "test-only-secret-key")


def ensure_project(db, code="PRJ-APEX-01", name="Apex Test Tower", floors=3):
    """Create a project with a generated plan if it doesn't exist (tests used to rely on seed_data.py)."""
    from datetime import date, timedelta

    from backend.app.models.all_models import Project
    from backend.app.services.scheduling_engine import SchedulingEngine
    from backend.app.services.template_engine import TemplateEngine

    project = db.query(Project).filter(Project.code == code).first()
    if project:
        return project
    project = Project(
        name=name, code=code, construction_type="Commercial", location="Test Site",
        num_floors=floors, num_towers=1, built_up_area=15000.0,
        planned_start_date=date.today(), target_completion_date=date.today() + timedelta(days=300),
        status="IN_PROGRESS",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    activities, dependencies = TemplateEngine.generate_plan_for_project(project, num_floors=floors, num_towers=1)
    for a in activities:
        db.add(a)
    db.flush()
    for d in dependencies:
        db.add(d)
    db.commit()
    SchedulingEngine.generate_and_apply_schedule(db, project.id)
    return project


import pytest

TEST_USERS = {
    "admin@construction.ai": ("Admin", "Test Admin"),
    "pm@construction.ai": ("Project Manager", "Test Project Manager"),
    "sm@construction.ai": ("Site Manager", "Test Site Manager"),
    "eng@construction.ai": ("Site Engineer", "Test Site Engineer"),
    "exec@construction.ai": ("Top Management", "Test Executive"),
    "aditya.patil@construction.ai": ("Site Engineer", "Test Engineer A"),
    "vicky.satpute@construction.ai": ("Site Engineer", "Test Engineer B"),
}
TEST_PASSWORD = "test-password-123"


@pytest.fixture(scope="session", autouse=True)
def _seed_test_users():
    """One user per role in the temp database, so tokens minted in tests resolve to a real user."""
    from backend.app import main  # noqa: F401  (creates the tables)
    from backend.app.database.connection import SessionLocal
    from backend.app.models.all_models import User
    from backend.app.utils.security import get_password_hash

    db = SessionLocal()
    try:
        for email, (role, name) in TEST_USERS.items():
            if not db.query(User).filter(User.email == email).first():
                db.add(User(email=email, hashed_password=get_password_hash(TEST_PASSWORD), full_name=name, role=role))
        db.commit()
    finally:
        db.close()
    yield


def auth_headers(email: str):
    """Bearer header for one of the seeded test users."""
    from backend.app.utils.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token({'sub': email, 'role': TEST_USERS[email][0]})}"}


def grant_membership(db, project_id, email, scope="ALL"):
    """Make a seeded test user a member of a project (tests create their own projects)."""
    from backend.app.models.all_models import ProjectMember, User

    user = db.query(User).filter(User.email == email).first()
    exists = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user.id, ProjectMember.scope == scope
    ).first()
    if not exists:
        db.add(ProjectMember(project_id=project_id, user_id=user.id, scope=scope))
        db.commit()
