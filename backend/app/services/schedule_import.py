"""Import a project schedule from an Excel workbook (the 41 ZOY template).

The workbook is the read-only baseline source. Parsing and validation are separate from writing so a file with
any error imports nothing (all or nothing) and a dry run can show the same report without touching the database.

Expected sheet "Schedule" (header row 1). Required columns:
    ID, Level, Task Name, Wing / Area, Type, Duration (days), Baseline Start, Baseline Finish,
    Start, Finish, Actual Start, Actual Finish, % Complete, Predecessors
Optional: WBS, Site Engineer.
Predecessors are MSP style, comma separated: "12" (finish-to-start), "14SS+30d", "9FF-2d".
Only work rows (Type Task / Milestone) become activities; Summary rows give the hierarchy (phase, work package).
"""
import io
import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx
import openpyxl
from sqlalchemy.orm import Session

from backend.app.models.all_models import Activity, ActivityDependency, Project
from backend.app.services.audit_service import AuditService

SHEET_NAME = "Schedule"
REQUIRED_COLUMNS = [
    "ID", "Level", "Task Name", "Wing / Area", "Type", "Duration (days)", "Baseline Start", "Baseline Finish",
    "Start", "Finish", "Actual Start", "Actual Finish", "% Complete", "Predecessors",
]
WING_TO_TOWER = {
    "project": "Common",
    "a-wing": "Tower A",
    "b-wing": "Tower B",
    "external development": "External / Infra",
}
ROW_TYPES = {"summary": "Summary", "task": "Task", "milestone": "Milestone"}
DEPENDENCY_TYPES = {"FS", "SS", "FF", "SF"}
_PRED_TOKEN = re.compile(r"^(\d+)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*d?)?$", re.IGNORECASE)
_FLOOR = re.compile(r"\b(\d+)(?:ST|ND|RD|TH)\s+FLOOR", re.IGNORECASE)

# (keywords in the work package / ancestor names, phase) - first match wins
_PHASES = [
    (("SITE MOBILIZATION", "START OF CONSTRUCTION"), "Pre-Construction"),
    (("EXCAVATION", "SUB- STRUCTURE", "SUBSTRUCTURE"), "Substructure"),
    (("SUPER- STRUCTURE", "SUPERSTRUCTURE", "ABOVE TERRACE", "RCC"), "Superstructure"),
    (("PLUMBING", "ELECTRICAL", "FIRE FIGHTING", "LIFT", "SOLAR", "MEP"), "MEP"),
    (("SNAGGING", "DEEP CLEANING", "NOC", "OTHER SERVICE"), "Handover"),
    (("EXTERNAL DEVELOPMENT",), "External Development"),
    (("BLOCKWORK", "PLASTER", "GRINDING", "WATERPROOFING", "TILING", "CARPENTRY", "FABRICATION", "ALUMINIUM",
      "PAINTING", "FALSE CEILING", "SANITARY", "CP", "VDP", "ACID WASH", "TILE GROUTING", "ELEVATION"), "Finishing"),
]


@dataclass
class ImportRow:
    excel_row: int
    id: int
    level: int
    name: str
    wing: str
    tower: Optional[str]
    kind: str
    duration: float
    baseline_start: Optional[date]
    baseline_finish: Optional[date]
    start: Optional[date]
    finish: Optional[date]
    actual_start: Optional[date]
    actual_finish: Optional[date]
    percent: float
    predecessors: List[Tuple[int, str, int]] = field(default_factory=list)
    phase: str = "Execution"
    work_package: Optional[str] = None
    floor: int = 0
    sort_order: int = 0

    @property
    def is_work(self) -> bool:
        return self.kind != "Summary"


@dataclass
class ParsedSchedule:
    rows: List[ImportRow] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def work_rows(self) -> List[ImportRow]:
        return [r for r in self.rows if r.is_work]

    def error(self, row: Optional[int], field_name: str, message: str) -> None:
        self.errors.append({"row": row, "field": field_name, "message": message})

    def warn(self, row: Optional[int], field_name: str, message: str) -> None:
        self.warnings.append({"row": row, "field": field_name, "message": message})

    def report(self) -> Dict[str, Any]:
        work = self.work_rows
        towers: Dict[str, int] = {}
        for r in work:
            towers[r.tower or "?"] = towers.get(r.tower or "?", 0) + 1
        return {
            "ok": not self.errors,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": {
                "rows": len(self.rows),
                "work_rows": len(work),
                "summary_rows": len(self.rows) - len(work),
                "dependencies": sum(len(r.predecessors) for r in work),
                "activities_per_tower": towers,
            },
        }


class ScheduleImportError(Exception):
    """Raised by apply_import when the database state forbids the import (not a file error)."""

    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.status_code = status_code


# --------------------------------------------------------------------------- parsing

def _to_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        text = value.strip()
        if text.upper() in {"NA", "N/A", "-"}:
            return None
        for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
    raise ValueError(f"not a date: {value!r}")


def _to_percent(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("%"):
            return float(text[:-1]) / 100
        value = float(text)
    value = float(value)
    if not 0 <= value <= 1:
        raise ValueError("must be between 0% and 100% (a fraction from 0 to 1 in the cell)")
    return value


def _parse_predecessors(text: Any) -> List[Tuple[int, str, int]]:
    if text is None or str(text).strip() == "":
        return []
    out = []
    for token in re.split(r"[;,]", str(text)):
        token = token.strip()
        if not token:
            continue
        m = _PRED_TOKEN.match(token)
        if not m:
            raise ValueError(f"cannot read predecessor {token!r} (use e.g. 12, 14SS+30d)")
        lag = int(m.group(4) or 0) * (-1 if m.group(3) == "-" else 1)
        out.append((int(m.group(1)), (m.group(2) or "FS").upper(), lag))
    return out


def _phase_for(names: List[str]) -> str:
    text = " | ".join(n.upper() for n in names)
    for keywords, phase in _PHASES:
        if any(k in text for k in keywords):
            return phase
    return "Execution"


def parse_workbook(content: bytes) -> ParsedSchedule:
    parsed = ParsedSchedule()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception:
        parsed.error(None, "file", "The file is not a readable .xlsx workbook")
        return parsed
    if SHEET_NAME not in wb.sheetnames:
        parsed.error(None, "sheet", f'Sheet "{SHEET_NAME}" not found (found: {", ".join(wb.sheetnames)})')
        return parsed

    sheet_rows = list(wb[SHEET_NAME].iter_rows(values_only=True))
    if not sheet_rows:
        parsed.error(None, "sheet", "The Schedule sheet is empty")
        return parsed
    header = [str(h).strip() if h is not None else "" for h in sheet_rows[0]]
    index = {h.lower(): i for i, h in enumerate(header)}
    missing = [c for c in REQUIRED_COLUMNS if c.lower() not in index]
    if missing:
        parsed.error(1, "header", f"Missing column(s): {', '.join(missing)}")
        return parsed

    def cell(row, name):
        i = index[name.lower()]
        return row[i] if i < len(row) else None

    seen_ids: Dict[int, int] = {}
    for offset, raw in enumerate(sheet_rows[1:], start=2):
        if all(v is None or str(v).strip() == "" for v in raw):
            continue
        try:
            row_id = int(cell(raw, "ID"))
        except (TypeError, ValueError):
            parsed.error(offset, "ID", "ID must be a whole number")
            continue
        if row_id in seen_ids:
            parsed.error(offset, "ID", f"Duplicate ID {row_id} (first used on row {seen_ids[row_id]})")
            continue
        seen_ids[row_id] = offset

        errs_before = len(parsed.errors)
        name = str(cell(raw, "Task Name") or "").strip()
        if not name:
            parsed.error(offset, "Task Name", "Task name is empty")
        try:
            level = int(cell(raw, "Level"))
            if level < 0:
                raise ValueError
        except (TypeError, ValueError):
            parsed.error(offset, "Level", "Level must be a whole number, 0 or more")
            level = 0
        wing = str(cell(raw, "Wing / Area") or "").strip()
        tower = WING_TO_TOWER.get(wing.lower())
        if tower is None:
            parsed.error(offset, "Wing / Area", f"Unknown wing {wing!r} (use: Project, A-Wing, B-Wing, External Development)")
        kind = ROW_TYPES.get(str(cell(raw, "Type") or "").strip().lower())
        if kind is None:
            parsed.error(offset, "Type", "Type must be Summary, Task or Milestone")
            kind = "Task"
        try:
            duration = float(cell(raw, "Duration (days)") or 0)
            if duration < 0:
                raise ValueError
        except (TypeError, ValueError):
            parsed.error(offset, "Duration (days)", "Duration must be a number of days, 0 or more")
            duration = 0.0

        dates = {}
        for col in ("Baseline Start", "Baseline Finish", "Start", "Finish", "Actual Start", "Actual Finish"):
            try:
                dates[col] = _to_date(cell(raw, col))
            except ValueError as exc:
                parsed.error(offset, col, str(exc))
                dates[col] = None
        try:
            percent = _to_percent(cell(raw, "% Complete"))
        except (TypeError, ValueError) as exc:
            parsed.error(offset, "% Complete", str(exc))
            percent = 0.0
        try:
            preds = _parse_predecessors(cell(raw, "Predecessors"))
        except ValueError as exc:
            parsed.error(offset, "Predecessors", str(exc))
            preds = []

        row = ImportRow(
            excel_row=offset, id=row_id, level=level, name=name, wing=wing, tower=tower, kind=kind, duration=duration,
            baseline_start=dates["Baseline Start"], baseline_finish=dates["Baseline Finish"],
            start=dates["Start"], finish=dates["Finish"], actual_start=dates["Actual Start"],
            actual_finish=dates["Actual Finish"], percent=percent, predecessors=preds, sort_order=len(parsed.rows),
        )
        parsed.rows.append(row)
        if len(parsed.errors) == errs_before:
            _check_row(parsed, row)

    if not parsed.rows and not parsed.errors:
        parsed.error(None, "sheet", "The Schedule sheet has no data rows")
    _check_hierarchy(parsed)
    _check_dependencies(parsed)
    _derive_labels(parsed)
    return parsed


def _check_row(parsed: ParsedSchedule, r: ImportRow) -> None:
    if r.is_work:
        for col, val in (("Start", r.start), ("Finish", r.finish), ("Baseline Start", r.baseline_start),
                         ("Baseline Finish", r.baseline_finish)):
            if val is None:
                parsed.error(r.excel_row, col, "Required for task and milestone rows")
    if r.start and r.finish and r.finish < r.start:
        parsed.error(r.excel_row, "Finish", "Finish is before Start")
    if r.baseline_start and r.baseline_finish and r.baseline_finish < r.baseline_start:
        parsed.error(r.excel_row, "Baseline Finish", "Baseline finish is before baseline start")
    if r.actual_start and r.actual_finish and r.actual_finish < r.actual_start:
        parsed.error(r.excel_row, "Actual Finish", "Actual finish is before actual start")
    if r.kind == "Milestone" and r.duration != 0:
        parsed.warn(r.excel_row, "Duration (days)", "Milestone with a duration; expected 0")
    if r.is_work and r.percent > 0 and not r.actual_start:
        parsed.warn(r.excel_row, "Actual Start", "Progress is recorded but there is no actual start date")
    if r.is_work and r.actual_finish and r.percent < 1:
        parsed.warn(r.excel_row, "% Complete", "Actual finish is set but progress is below 100%")
    if r.is_work and r.percent == 1 and not r.actual_finish:
        parsed.warn(r.excel_row, "Actual Finish", "100% complete but no actual finish date")


def _check_hierarchy(parsed: ParsedSchedule) -> None:
    previous = None
    for r in parsed.rows:
        if previous is not None and r.level > previous.level + 1:
            parsed.error(r.excel_row, "Level", f"Level jumps from {previous.level} to {r.level}")
        if previous is not None and previous.is_work and r.level > previous.level:
            parsed.error(r.excel_row, "Type", f"Row {previous.excel_row} has sub-rows, so its Type must be Summary")
        previous = r


def _check_dependencies(parsed: ParsedSchedule) -> None:
    by_id = {r.id: r for r in parsed.rows}
    graph = nx.DiGraph()
    for r in parsed.work_rows:
        graph.add_node(r.id)
    for r in parsed.work_rows:
        for pred_id, kind, _lag in r.predecessors:
            if pred_id == r.id:
                parsed.error(r.excel_row, "Predecessors", "A task cannot depend on itself")
                continue
            pred = by_id.get(pred_id)
            if pred is None:
                parsed.error(r.excel_row, "Predecessors", f"Predecessor ID {pred_id} does not exist")
            elif not pred.is_work:
                parsed.error(r.excel_row, "Predecessors", f"Predecessor {pred_id} is a summary row; link to a task instead")
            else:
                graph.add_edge(pred_id, r.id)
    if not parsed.errors:
        try:
            cycle = nx.find_cycle(graph)
            path = " -> ".join(str(u) for u, _ in cycle) + f" -> {cycle[0][0]}"
            parsed.error(by_id[cycle[0][0]].excel_row, "Predecessors", f"Circular dependency: {path}")
        except nx.NetworkXNoCycle:
            pass


def _derive_labels(parsed: ParsedSchedule) -> None:
    """Phase, work package and floor come from the summary hierarchy above each work row."""
    stack: List[ImportRow] = []
    for r in parsed.rows:
        while stack and stack[-1].level >= r.level:
            stack.pop()
        stack.append(r)
        if not r.is_work:
            continue
        names = [s.name for s in stack]
        r.phase = _phase_for(names[1:] or names)
        r.work_package = names[2] if len(names) > 2 else (names[-1] if len(names) > 1 else r.name)
        m = _FLOOR.search(r.name)
        r.floor = int(m.group(1)) if m else 0


# --------------------------------------------------------------------------- writing

def _status_for(r: ImportRow, today: date) -> str:
    if r.percent >= 1:
        return "COMPLETED"
    if r.percent == 0 and not r.actual_start:
        return "NOT_STARTED"
    return "IN_PROGRESS"


def _code(project: Project, row_id: int) -> str:
    return f"{project.code}-{row_id:03d}"


def apply_import(
    db: Session,
    project: Project,
    user,
    parsed: ParsedSchedule,
    filename: str,
    replace_existing: bool = False,
    new_baseline: bool = False,
) -> Dict[str, Any]:
    """Write a validated schedule. Raises ScheduleImportError (nothing written) when the project state forbids it."""
    if parsed.errors:
        raise ValueError("apply_import called with an invalid schedule")
    work = parsed.work_rows
    codes = {r.id: _code(project, r.id) for r in work}

    existing = db.query(Activity).filter(Activity.project_id == project.id).all()
    by_code = {a.code: a for a in existing if a.code}
    foreign = [a for a in existing if a.code not in set(codes.values())]
    if foreign and not replace_existing:
        raise ScheduleImportError(
            f"The project already has {len(foreign)} activities that are not part of this file. "
            "Import into an empty project, or ask an Admin to import with replace_existing=true."
        )
    matched = [a for a in existing if a.code in set(codes.values())]
    if any(a.baseline_start_date for a in matched) and not new_baseline and not replace_existing:
        raise ScheduleImportError(
            "A baseline is already set for these activities. Re-importing would overwrite it; "
            "repeat with new_baseline=true to confirm creating a new baseline."
        )

    today = date.today()
    replaced = 0
    try:
        if replace_existing and existing:
            replaced = len(existing)
            for a in existing:
                db.delete(a)
            db.flush()
            by_code = {}

        activity_by_row: Dict[int, Activity] = {}
        created = updated = 0
        for r in work:
            activity = by_code.get(codes[r.id])
            is_new = activity is None
            if is_new:
                activity = Activity(project_id=project.id, code=codes[r.id])
                db.add(activity)
                created += 1
            else:
                updated += 1
            activity.name = r.name
            activity.phase = r.phase
            activity.work_package = r.work_package
            activity.building = project.name
            activity.tower = r.tower
            activity.floor = r.floor
            activity.planned_duration = max(int(math.ceil(r.duration)), 0) if r.duration else 0
            activity.start_date = r.start
            activity.end_date = r.finish
            activity.actual_start_date = r.actual_start
            activity.actual_end_date = r.actual_finish
            activity.progress_percent = round(r.percent * 100, 1)
            activity.status = _status_for(r, today)
            activity.sort_order = r.sort_order
            activity.baseline_task_id = r.id
            activity.baseline_source_file = filename
            activity.baseline_start_date = r.baseline_start
            activity.baseline_end_date = r.baseline_finish
            activity_by_row[r.id] = activity
        db.flush()

        # Dependencies of the imported activities are rebuilt from the file.
        ids = [a.id for a in activity_by_row.values()]
        if ids:
            db.query(ActivityDependency).filter(ActivityDependency.project_id == project.id).filter(
                ActivityDependency.successor_id.in_(ids)
            ).delete(synchronize_session=False)
        dep_count = 0
        for r in work:
            for pred_id, kind, lag in r.predecessors:
                db.add(ActivityDependency(
                    project_id=project.id, predecessor_id=activity_by_row[pred_id].id,
                    successor_id=activity_by_row[r.id].id, dependency_type=kind, lag_days=lag,
                ))
                dep_count += 1
        db.flush()

        AuditService.log_action(
            db, action="IMPORT_SCHEDULE", entity_name="Project", entity_id=str(project.id),
            new_values={"file": filename, "created": created, "updated": updated, "dependencies": dep_count,
                        "replaced_existing": replaced, "new_baseline": bool(new_baseline)},
            user_id=user.id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    cpm: Dict[str, Any] = {}
    try:
        from backend.app.services.scheduling_engine import SchedulingEngine

        result = SchedulingEngine.generate_and_apply_schedule(db, project.id, overwrite_dates=False)
        cpm = {k: result.get(k) for k in ("project_duration_days", "critical_activities_count", "total_activities")}
    except Exception as exc:  # the import itself is done; report why float/critical path could not be computed
        db.rollback()
        cpm = {"error": str(exc)}

    return {"created": created, "updated": updated, "dependencies": dep_count, "replaced_existing": replaced,
            "schedule": cpm}
