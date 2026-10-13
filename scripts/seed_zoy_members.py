"""Give the existing users access to the 41 ZOY project (idempotent).

Run once after upgrading to project membership, otherwise only Admin and Top Management see any project:
    python scripts/seed_zoy_members.py

Site engineers from the 41 ZOY organisation chart are created with placeholder emails and a
random password that is printed once. Replace the emails/passwords through the Admin user flow.
"""
import os
import secrets
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database.connection import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.all_models import Project, ProjectMember, User  # noqa: E402
from backend.app.utils.security import get_password_hash  # noqa: E402

PROJECT_CODE = "PRJ-41ZOY"

# (email, full name, role, scope) - scope is "ALL" or an Activity.tower value
EXISTING = [
    ("pm@construction.ai", "Project Manager", "ALL"),
    ("sm@construction.ai", "Site Manager", "ALL"),
    ("eng@construction.ai", "Site Engineer", "Tower A"),
]
FROM_ORG_CHART = [
    ("aditya.patil@construction.ai", "Aditya Patil", "Site Engineer", "Tower A"),   # A-Wing Sr. Engineer
    ("vicky.satpute@construction.ai", "Vicky Satpute", "Site Engineer", "Tower B"),  # B-Wing Sr. Engineer
]


def add_member(db, project, user, scope):
    exists = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id, ProjectMember.user_id == user.id, ProjectMember.scope == scope
    ).first()
    if exists:
        return False
    db.add(ProjectMember(project_id=project.id, user_id=user.id, scope=scope))
    return True


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.code == PROJECT_CODE).first()
        if not project:
            sys.exit(f"Project {PROJECT_CODE} not found")
        for email, _name, scope in EXISTING:
            user = db.query(User).filter(User.email == email).first()
            if user and add_member(db, project, user, scope):
                print(f"member: {email} -> {scope}")
        for email, name, role, scope in FROM_ORG_CHART:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                password = secrets.token_urlsafe(9)
                user = User(email=email, hashed_password=get_password_hash(password), full_name=name, role=role)
                db.add(user)
                db.flush()
                print(f"created user {email} (password: {password})")
            if add_member(db, project, user, scope):
                print(f"member: {email} -> {scope}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
