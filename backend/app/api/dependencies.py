from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import Activity, ActivityDependency, User
from backend.app.schemas.all_schemas import DependencyCreate, DependencyResponse
from backend.app.services.dependency_engine import DependencyEngine, CircularDependencyException
from backend.app.services.scheduling_engine import SchedulingEngine
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["Dependencies"])

@router.post("/api/projects/{project_id}/dependencies", response_model=DependencyResponse, status_code=status.HTTP_201_CREATED)
def create_dependency(
    project_id: int,
    dep_in: DependencyCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Creates an activity dependency (FS, SS, FF, SF) with circular dependency validation.
    Prevents cyclic graphs and immediately recalculates the CPM schedule.
    """
    if dep_in.predecessor_id == dep_in.successor_id:
        raise HTTPException(status_code=400, detail="An activity cannot depend on itself.")

    pred = db.query(Activity).filter(Activity.id == dep_in.predecessor_id, Activity.project_id == project_id).first()
    succ = db.query(Activity).filter(Activity.id == dep_in.successor_id, Activity.project_id == project_id).first()
    if not pred or not succ:
        raise HTTPException(status_code=404, detail="Predecessor or successor activity not found in project.")

    # Check existing dependency
    existing = db.query(ActivityDependency).filter(
        ActivityDependency.project_id == project_id,
        ActivityDependency.predecessor_id == dep_in.predecessor_id,
        ActivityDependency.successor_id == dep_in.successor_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This dependency already exists.")

    # Circular Dependency Detection (Tarjan / DFS cycle detection)
    all_acts = db.query(Activity).filter(Activity.project_id == project_id).all()
    all_deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()

    try:
        DependencyEngine.validate_no_cycles(
            activities=all_acts,
            dependencies=all_deps,
            new_dep=(dep_in.predecessor_id, dep_in.successor_id)
        )
    except CircularDependencyException as e:
        raise HTTPException(status_code=400, detail=str(e))

    dependency = ActivityDependency(
        project_id=project_id,
        predecessor_id=dep_in.predecessor_id,
        successor_id=dep_in.successor_id,
        dependency_type=dep_in.dependency_type,
        lag_days=dep_in.lag_days
    )
    db.add(dependency)
    db.commit()
    db.refresh(dependency)

    # Recalculate schedule
    SchedulingEngine.generate_and_apply_schedule(db, project_id)

    AuditService.log_action(
        db,
        action="CREATE",
        entity_name="Dependency",
        entity_id=str(dependency.id),
        new_values=dep_in.model_dump(),
        user_id=current_user.id if current_user else None
    )

    return {
        "id": dependency.id,
        "project_id": dependency.project_id,
        "predecessor_id": dependency.predecessor_id,
        "successor_id": dependency.successor_id,
        "dependency_type": dependency.dependency_type,
        "lag_days": dependency.lag_days,
        "predecessor_name": pred.name,
        "successor_name": succ.name
    }

@router.get("/api/projects/{project_id}/dependencies", response_model=List[DependencyResponse])
def list_dependencies(project_id: int, db: Session = Depends(get_db)):
    deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()
    act_map = {a.id: a.name for a in db.query(Activity).filter(Activity.project_id == project_id).all()}

    results = []
    for d in deps:
        results.append({
            "id": d.id,
            "project_id": d.project_id,
            "predecessor_id": d.predecessor_id,
            "successor_id": d.successor_id,
            "dependency_type": d.dependency_type,
            "lag_days": d.lag_days,
            "predecessor_name": act_map.get(d.predecessor_id, "Unknown"),
            "successor_name": act_map.get(d.successor_id, "Unknown")
        })
    return results

@router.delete("/api/dependencies/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependency(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    dep = db.query(ActivityDependency).filter(ActivityDependency.id == id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")

    p_id = dep.project_id
    db.delete(dep)
    db.commit()

    # Recalculate schedule
    SchedulingEngine.generate_and_apply_schedule(db, p_id)

    AuditService.log_action(
        db,
        action="DELETE",
        entity_name="Dependency",
        entity_id=str(id),
        user_id=current_user.id if current_user else None
    )
    return None
