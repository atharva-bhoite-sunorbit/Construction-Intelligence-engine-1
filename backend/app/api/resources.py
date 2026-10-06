from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Resource, ActivityResourcePlan, Activity, User
from backend.app.schemas.all_schemas import (
    ResourceCreate, ResourceUpdate, ResourceResponse,
    ActivityResourcePlanCreate, ActivityResourcePlanResponse
)
from backend.app.services.resource_service import ResourceService
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["Resources"])

@router.get("/api/projects/{project_id}/resources")
def get_project_resources(project_id: int, db: Session = Depends(get_db)):
    """Returns total requirements, availability, shortages, and utilization by resource category."""
    return ResourceService.get_project_resources_summary(db, project_id)

@router.post("/api/projects/{project_id}/resources", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    project_id: int,
    res_in: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    res_data = res_in.model_dump()
    res_data["project_id"] = project_id
    resource = Resource(**res_data)
    db.add(resource)
    db.commit()
    db.refresh(resource)

    AuditService.log_action(
        db,
        action="CREATE",
        entity_name="Resource",
        entity_id=str(resource.id),
        new_values=res_in.model_dump(),
        user_id=current_user.id if current_user else None
    )

    return resource

@router.put("/api/resources/{id}", response_model=ResourceResponse)
def update_resource(
    id: int,
    res_update: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    res = db.query(Resource).filter(Resource.id == id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    old_data = {c.name: getattr(res, c.name) for c in res.__table__.columns}
    update_data = res_update.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(res, k, v)
    db.commit()
    db.refresh(res)

    AuditService.log_action(
        db,
        action="UPDATE",
        entity_name="Resource",
        entity_id=str(id),
        old_values=old_data,
        new_values=update_data,
        user_id=current_user.id if current_user else None
    )

    return res

@router.post("/api/activities/{activity_id}/resources", response_model=ActivityResourcePlanResponse, status_code=status.HTTP_201_CREATED)
def allocate_resource_to_activity(
    activity_id: int,
    plan_in: ActivityResourcePlanCreate,
    db: Session = Depends(get_db)
):
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    resource = db.query(Resource).filter(Resource.id == plan_in.resource_id).first()
    if not activity or not resource:
        raise HTTPException(status_code=404, detail="Activity or Resource not found")

    plan = ActivityResourcePlan(
        activity_id=activity_id,
        resource_id=plan_in.resource_id,
        required_qty=plan_in.required_qty,
        allocated_qty=plan_in.allocated_qty,
        notes=plan_in.notes
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    shortage = max(0.0, plan.required_qty - plan.allocated_qty)

    return {
        "id": plan.id,
        "activity_id": plan.activity_id,
        "resource_id": plan.resource_id,
        "resource_name": resource.type_name,
        "category": resource.category,
        "unit": resource.unit,
        "required_qty": plan.required_qty,
        "allocated_qty": plan.allocated_qty,
        "shortage": shortage,
        "notes": plan.notes
    }
