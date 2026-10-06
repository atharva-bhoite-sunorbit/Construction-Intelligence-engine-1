import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database.connection import get_db
from backend.app.models.all_models import Project, Activity, User
from backend.app.schemas.all_schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from backend.app.services.resource_service import ResourceService
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    code_clean = (project_in.code or "").strip()
    if not code_clean:
        raise HTTPException(status_code=400, detail="Project code is required.")

    # Check duplicate code
    existing = db.query(Project).filter(Project.code == code_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project code '{code_clean}' already exists. Please choose a different code.")

    try:
        p_dict = project_in.model_dump()
        stage_engineers = p_dict.pop("stage_engineers", None)
        if stage_engineers is not None:
            p_dict["stage_engineers_json"] = json.dumps(stage_engineers)
        p_dict["code"] = code_clean
        p_dict["name"] = (p_dict.get("name") or "").strip()
        project = Project(**p_dict)
        db.add(project)
        db.commit()
        db.refresh(project)

        # Initialize standard resource suite (Labour, Materials, Equipment)
        try:
            ResourceService.initialize_standard_resources_for_project(db, project.id)
        except Exception as res_err:
            print(f"Warning: Standard resource initialization note: {res_err}")

        AuditService.log_action(
            db,
            action="CREATE",
            entity_name="Project",
            entity_id=str(project.id),
            new_values=project_in.model_dump(mode="json"),
            user_id=current_user.id if current_user else None
        )

        stage_eng = None
        if getattr(project, "stage_engineers_json", None):
            try:
                stage_eng = json.loads(project.stage_engineers_json)
            except Exception:
                stage_eng = {}

        return {
            "id": project.id,
            "name": project.name,
            "code": project.code,
            "construction_type": project.construction_type,
            "location": project.location,
            "num_floors": project.num_floors,
            "num_towers": project.num_towers,
            "built_up_area": project.built_up_area,
            "plot_area": project.plot_area,
            "planned_start_date": project.planned_start_date,
            "target_completion_date": project.target_completion_date,
            "project_manager": project.project_manager,
            "site_manager": project.site_manager,
            "contractor": project.contractor,
            "description": project.description,
            "stage_engineers": stage_eng,
            "status": project.status,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "total_activities": 0,
            "completed_activities": 0,
            "delayed_activities": 0,
            "overall_progress": 0.0
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not create project: {str(e)}")

@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    results = []

    for p in projects:
        acts = db.query(Activity).filter(Activity.project_id == p.id).all()
        total_acts = len(acts)
        completed_acts = sum(1 for a in acts if a.status == "COMPLETED")
        delayed_acts = sum(1 for a in acts if a.status == "DELAYED")
        overall_prog = round(sum(a.progress_percent for a in acts) / max(1, total_acts), 1) if total_acts > 0 else 0.0

        stage_eng = None
        if getattr(p, "stage_engineers_json", None):
            try:
                stage_eng = json.loads(p.stage_engineers_json)
            except Exception:
                stage_eng = {}

        p_dict = {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "construction_type": p.construction_type,
            "location": p.location,
            "num_floors": p.num_floors,
            "num_towers": p.num_towers,
            "built_up_area": p.built_up_area,
            "plot_area": p.plot_area,
            "planned_start_date": p.planned_start_date,
            "target_completion_date": p.target_completion_date,
            "project_manager": p.project_manager,
            "site_manager": p.site_manager,
            "contractor": p.contractor,
            "description": p.description,
            "stage_engineers": stage_eng,
            "status": p.status,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "total_activities": total_acts,
            "completed_activities": completed_acts,
            "delayed_activities": delayed_acts,
            "overall_progress": overall_prog
        }
        results.append(p_dict)

    return results

@router.get("/{id}", response_model=ProjectResponse)
def get_project(id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    acts = db.query(Activity).filter(Activity.project_id == id).all()
    total_acts = len(acts)
    completed_acts = sum(1 for a in acts if a.status == "COMPLETED")
    delayed_acts = sum(1 for a in acts if a.status == "DELAYED")
    overall_prog = round(sum(a.progress_percent for a in acts) / max(1, total_acts), 1) if total_acts > 0 else 0.0

    stage_eng = None
    if getattr(project, "stage_engineers_json", None):
        try:
            stage_eng = json.loads(project.stage_engineers_json)
        except Exception:
            stage_eng = {}

    p_dict = {
        "id": project.id,
        "name": project.name,
        "code": project.code,
        "construction_type": project.construction_type,
        "location": project.location,
        "num_floors": project.num_floors,
        "num_towers": project.num_towers,
        "built_up_area": project.built_up_area,
        "plot_area": project.plot_area,
        "planned_start_date": project.planned_start_date,
        "target_completion_date": project.target_completion_date,
        "project_manager": project.project_manager,
        "site_manager": project.site_manager,
        "contractor": project.contractor,
        "description": project.description,
        "stage_engineers": stage_eng,
        "status": project.status,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "total_activities": total_acts,
        "completed_activities": completed_acts,
        "delayed_activities": delayed_acts,
        "overall_progress": overall_prog
    }
    return p_dict

@router.put("/{id}", response_model=ProjectResponse)
def update_project(
    id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_data = {c.name: getattr(project, c.name) for c in project.__table__.columns}
    update_data = project_update.model_dump(exclude_unset=True)

    if "stage_engineers" in update_data:
        se = update_data.pop("stage_engineers")
        project.stage_engineers_json = json.dumps(se) if se is not None else None

    for k, v in update_data.items():
        setattr(project, k, v)

    db.commit()
    db.refresh(project)

    AuditService.log_action(
        db,
        action="UPDATE",
        entity_name="Project",
        entity_id=str(id),
        old_values=old_data,
        new_values=update_data,
        user_id=current_user.id if current_user else None
    )

    return get_project(id, db)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    AuditService.log_action(
        db,
        action="DELETE",
        entity_name="Project",
        entity_id=str(id),
        user_id=current_user.id if current_user else None
    )

    db.delete(project)
    db.commit()
    return None
