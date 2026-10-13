"""Derive a planned activity's progress and actual dates from its execution tasks. Never touches the baseline.

Activity % complete = sum(task % x task planned days) / max(activity planned days, sum of task planned days)
Only tasks that are committed work count (APPROVED, IN_PROGRESS, BLOCKED, COMPLETED). Using the larger of the
activity duration and the task days means a task covering half the activity cannot make it look 100% done.
"""
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, Task
from backend.app.services.task_workflow import COMPLETED, COUNTED_FOR_PROGRESS, IN_PROGRESS

_ROLLUP_STATUSES = {"NOT_STARTED", "IN_PROGRESS", "COMPLETED"}


def rollup_activity(db: Session, activity_id: Optional[int]) -> Optional[Activity]:
    if not activity_id:
        return None
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if activity is None:
        return None
    tasks = [t for t in db.query(Task).filter(Task.activity_id == activity_id).all()
             if t.status in COUNTED_FOR_PROGRESS]
    if not tasks:
        return activity

    task_days = sum(max(t.planned_days, 1) for t in tasks)
    denominator = max(activity.planned_duration or 0, task_days)
    done = sum((t.progress_percent or 0) * max(t.planned_days, 1) for t in tasks)
    activity.progress_percent = round(done / denominator, 1)

    starts = [t.actual_start_date for t in tasks if t.actual_start_date]
    activity.actual_start_date = min(starts) if starts else activity.actual_start_date
    all_done = all(t.status == COMPLETED for t in tasks) and activity.progress_percent >= 99.95
    if all_done:
        activity.progress_percent = 100.0
        activity.actual_end_date = max(t.actual_end_date for t in tasks if t.actual_end_date) \
            if any(t.actual_end_date for t in tasks) else activity.actual_end_date
    else:
        activity.actual_end_date = None

    if activity.status in _ROLLUP_STATUSES:
        if all_done:
            activity.status = "COMPLETED"
        elif any(t.status in (IN_PROGRESS, COMPLETED) or (t.progress_percent or 0) > 0 for t in tasks):
            activity.status = "IN_PROGRESS"
    return activity
