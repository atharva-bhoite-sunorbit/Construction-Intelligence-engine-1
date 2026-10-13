"""In-app notifications. Called from the workflow code in the same transaction as the change that caused them.

Who hears about what:
  approvers (Project Manager, Admin)  - a task needs approval; a problem was reported; a problem was resolved
  the person who raised it            - their task was approved or sent back; the PM decided a problem's impact
  directors (Top Management)          - the project end now moves because of a confirmed problem
Nobody is notified about their own action.
"""
from datetime import datetime
from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from backend.app.models.all_models import Notification, ProjectMember, User

APPROVER_ROLES = ("Project Manager", "Admin")
DIRECTOR_ROLES = ("Top Management",)


def project_recipients(db: Session, project_id: int, roles: Iterable[str], exclude_user_id: Optional[int] = None) -> List[User]:
    roles = list(roles)
    members = (db.query(User).join(ProjectMember, ProjectMember.user_id == User.id)
               .filter(ProjectMember.project_id == project_id, User.role.in_(roles), User.is_active == True).all())  # noqa: E712
    people = {u.id: u for u in members}
    if "Admin" in roles:  # administrators reach every project without being members
        for u in db.query(User).filter(User.role == "Admin", User.is_active == True).all():  # noqa: E712
            people[u.id] = u
    people.pop(exclude_user_id, None)
    return list(people.values())


def notify(db: Session, users: Iterable[User], *, project_id: Optional[int], kind: str, title: str, body: Optional[str] = None,
           entity_type: Optional[str] = None, entity_id: Optional[int] = None) -> int:
    count = 0
    for user in users:
        db.add(Notification(user_id=user.id, project_id=project_id, kind=kind, title=title[:255], body=body,
                            entity_type=entity_type, entity_id=entity_id))
        count += 1
    return count


def notify_user(db: Session, user_id: Optional[int], actor_id: Optional[int], **kwargs) -> int:
    """One person, unless it is the person who did the thing."""
    if not user_id or user_id == actor_id:
        return 0
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    return notify(db, [user], **kwargs) if user else 0


def short(text: Optional[str], limit: int = 140) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def backfill_open_items(db: Session) -> int:
    """For data created before notifications existed: tell approvers about what is still waiting on them."""
    from backend.app.models.all_models import Blocker, Project, Task

    created = 0
    for project in db.query(Project).filter(Project.status != "ARCHIVED").all():
        approvers = project_recipients(db, project.id, APPROVER_ROLES)
        for task in db.query(Task).filter(Task.project_id == project.id, Task.status == "PENDING_APPROVAL").all():
            for user in approvers:
                if not db.query(Notification).filter_by(user_id=user.id, kind="APPROVAL_NEEDED", entity_type="task", entity_id=task.id).first():
                    created += notify(db, [user], project_id=project.id, kind="APPROVAL_NEEDED", title=f"Approval needed: {task.title}",
                                      body=short(task.unplanned_reason), entity_type="task", entity_id=task.id)
        for problem in db.query(Blocker).filter(Blocker.project_id == project.id, Blocker.impact_status.in_(["NOT_ASSESSED", "PROPOSED"])).all():
            for user in approvers:
                if not db.query(Notification).filter_by(user_id=user.id, kind="PROBLEM_REPORTED", entity_type="problem", entity_id=problem.id).first():
                    created += notify(db, [user], project_id=project.id, kind="PROBLEM_REPORTED", title=f"Problem to review: {problem.category}",
                                      body=short(problem.description), entity_type="problem", entity_id=problem.id)
    db.commit()
    return created
