"""Import the baseline dates from the 41 ZOY master schedule PDF."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from pypdf import PdfReader
from sqlalchemy import inspect, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.database.connection import Base, SessionLocal, engine
from backend.app.models.all_models import Activity, Project


DEFAULT_PDF = Path(
    r"C:\Users\athar\Downloads\ZOY - Baseline Master Schedule Tracker 06-OCT-2026(2).pdf"
)
WING_NAME = re.compile(r"^(?:A-WING|B-WING)\b", re.IGNORECASE)
WEEKDAY = r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)"
DATE_TOKEN = r"\d{1,2}/\d{1,2}/\d{2}"
DATED_ROW = re.compile(
    rf"(?P<name>.*?){WEEKDAY}\s*(?P<start>{DATE_TOKEN})\s*"
    rf"{WEEKDAY}\s*(?P<end>{DATE_TOKEN})\s*$",
    re.IGNORECASE,
)
UNDATED_ROW = re.compile(r"^(?P<name>.+?)\s+NA\s+NA$", re.IGNORECASE)


@dataclass(frozen=True)
class BaselineTask:
    task_id: int
    name: str
    tower: str
    start_date: Optional[date]
    end_date: Optional[date]


def normalize_name(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", value.upper())


def parse_pdf_rows(pdf_path: Path) -> list[BaselineTask]:
    reader = PdfReader(str(pdf_path), strict=False)
    tasks: list[BaselineTask] = []
    tower = "Common"

    for page in reader.pages[:4]:
        lines = (page.extract_text() or "").splitlines()
        for index, line in enumerate(lines[:-1]):
            if not line.strip().isdigit():
                continue

            row_text = lines[index + 1].strip()
            match = DATED_ROW.match(row_text)
            if match:
                name = match.group("name").strip()
                start_date = datetime.strptime(match.group("start"), "%m/%d/%y").date()
                end_date = datetime.strptime(match.group("end"), "%m/%d/%y").date()
            else:
                match = UNDATED_ROW.match(row_text)
                if not match:
                    raise ValueError(
                        f"Could not parse the baseline dates for PDF task {line.strip()}: "
                        f"{row_text!r}"
                    )
                name = match.group("name").strip()
                start_date = None
                end_date = None

            if name.upper().startswith("A-WING"):
                tower = "Tower A"
            elif name.upper().startswith("B-WING"):
                tower = "Tower B"
            elif name.upper().startswith("EXTERNAL DEVELOPMENT"):
                tower = "External / Infra"

            tasks.append(
                BaselineTask(
                    task_id=int(line.strip()),
                    name=name,
                    tower=tower,
                    start_date=start_date,
                    end_date=end_date,
                )
            )

    if not tasks:
        raise ValueError("No schedule rows were found in the first four PDF pages.")
    if len({task.task_id for task in tasks}) != len(tasks):
        raise ValueError("The PDF contains duplicate task IDs; import was stopped.")
    if tasks[0].name.upper() != "41 ZOY":
        raise ValueError("The PDF does not appear to contain the 41 ZOY master schedule.")

    return tasks


def ensure_baseline_columns() -> None:
    """Add baseline columns to existing SQLite databases before importing."""
    Base.metadata.create_all(bind=engine)
    existing_columns = {column["name"] for column in inspect(engine).get_columns("activities")}
    column_definitions = {
        "baseline_task_id": "INTEGER",
        "baseline_start_date": "DATE",
        "baseline_end_date": "DATE",
        "baseline_source_file": "VARCHAR(255)",
    }
    with engine.begin() as connection:
        for name, definition in column_definitions.items():
            if name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE activities ADD COLUMN {name} {definition}")
                )


def import_baseline(pdf_path: Path, apply_changes: bool) -> dict[str, int | str]:
    tasks = parse_pdf_rows(pdf_path)
    ensure_baseline_columns()
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.code == "PRJ-41ZOY").one_or_none()
        if not project:
            raise ValueError("Project PRJ-41ZOY was not found.")

        activities = db.query(Activity).filter(Activity.project_id == project.id).all()
        by_baseline_id = {
            activity.baseline_task_id: activity
            for activity in activities
            if activity.baseline_task_id is not None
        }
        by_name_and_tower: dict[tuple[str, str], list[Activity]] = {}
        for activity in activities:
            key = (activity.tower or "Common", normalize_name(activity.name))
            by_name_and_tower.setdefault(key, []).append(activity)

        matches: list[tuple[BaselineTask, Activity]] = []
        unresolved: list[str] = []
        for task in tasks:
            activity = by_baseline_id.get(task.task_id)
            if activity is None:
                candidates = by_name_and_tower.get(
                    (task.tower, normalize_name(task.name)), []
                )
                if len(candidates) == 1:
                    activity = candidates[0]
                elif len(candidates) > 1:
                    unresolved.append(
                        f"PDF task {task.task_id} {task.name!r} has multiple matches."
                    )
                    continue
                else:
                    unresolved.append(
                        f"PDF task {task.task_id} {task.name!r} ({task.tower}) "
                        "does not match an existing activity."
                    )
                    continue
            matches.append((task, activity))

        if unresolved:
            raise ValueError(
                "Baseline import stopped without changing project data:\n"
                + "\n".join(unresolved)
            )

        matched_activity_ids = {activity.id for _, activity in matches}
        if len(matched_activity_ids) != len(matches):
            raise ValueError(
                "Multiple PDF tasks resolve to the same activity; import was stopped."
            )

        summary = {
            "pdf_tasks": len(tasks),
            "matched_activities": len(matches),
            "activities_without_pdf_rows": len(activities) - len(matched_activity_ids),
            "dated_baseline_tasks": sum(
                task.start_date is not None and task.end_date is not None
                for task in tasks
            ),
            "undated_baseline_tasks": sum(
                task.start_date is None or task.end_date is None for task in tasks
            ),
        }

        if apply_changes:
            for task, activity in matches:
                activity.baseline_task_id = task.task_id
                activity.baseline_start_date = task.start_date
                activity.baseline_end_date = task.end_date
                activity.baseline_source_file = pdf_path.name
            db.commit()

        return summary
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "pdf",
        nargs="?",
        type=Path,
        default=DEFAULT_PDF,
        help="Path to the 41 ZOY baseline schedule PDF.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist the baseline after validating every PDF row against an activity.",
    )
    args = parser.parse_args()

    if not args.pdf.is_file():
        parser.error(f"PDF file does not exist: {args.pdf}")

    summary = import_baseline(args.pdf, apply_changes=args.apply)
    mode = "Applied" if args.apply else "Dry run; no project schedule data changed"
    print(f"{mode}: {args.pdf.name}")
    for key, value in summary.items():
        print(f"{key.replace('_', ' ').capitalize()}: {value}")
    if not args.apply:
        print("Re-run with --apply to save these baseline dates.")


if __name__ == "__main__":
    main()
