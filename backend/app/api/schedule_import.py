from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, User
from backend.app.services.schedule_import import ScheduleImportError, apply_import, parse_workbook
from backend.app.utils.access import ALL_SCOPE, member_scopes
from backend.app.utils.security import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/schedule", tags=["Schedule Import"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
IMPORT_ROLES = {"Admin", "Project Manager", "Planning Engineer"}
XLSX_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}


@router.post("/import")
async def import_schedule(
    project_id: int,
    file: UploadFile = File(..., description="The schedule workbook (.xlsx), sheet 'Schedule'"),
    dry_run: bool = Form(False, description="Validate only; nothing is written"),
    replace_existing: bool = Form(False, description="Admin only: delete the project's current activities first"),
    new_baseline: bool = Form(False, description="Confirm overwriting an existing baseline (Admin / Project Manager)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Imports activities, baseline dates and dependencies from the Excel template.

    All or nothing: any error in the file returns 422 with the full list and writes nothing.
    The baseline is never overwritten silently.
    """
    if current_user.role not in IMPORT_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an Admin, Project Manager or Planning Engineer can import a schedule")
    if current_user.role != "Admin" and ALL_SCOPE not in (member_scopes(db, current_user, project_id) or set()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Importing a schedule needs access to the whole project")
    if replace_existing and current_user.role != "Admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an Admin can replace the existing activities")
    if new_baseline and current_user.role not in {"Admin", "Project Manager"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an Admin or Project Manager can create a new baseline")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if not (file.filename or "").lower().endswith(".xlsx") or (file.content_type or "") not in XLSX_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload an Excel .xlsx file")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is larger than 10 MB")

    parsed = parse_workbook(content)
    report = parsed.report()
    if dry_run:
        return {**report, "dry_run": True}
    if parsed.errors:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={**report, "dry_run": False})

    try:
        result = apply_import(db, project, current_user, parsed, file.filename, replace_existing, new_baseline)
    except ScheduleImportError as exc:
        raise HTTPException(exc.status_code, str(exc))
    return {**report, "dry_run": False, "result": result}
