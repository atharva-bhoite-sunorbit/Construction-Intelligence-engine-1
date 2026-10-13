import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import User
from backend.app.schemas.all_schemas import UserCreate, UserLogin, UserResponse, Token
from backend.app.utils.security import (
    verify_password, get_password_hash, create_access_token, get_current_user, require_roles, APP_ENV
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["Admin"])),
):
    """Creates a user. Admin only: self-registration would let anyone pick the Admin role."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

from fastapi.security import OAuth2PasswordRequestForm

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.post("/token", response_model=Token, summary="OAuth2 Swagger Authentication")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Provides standard OAuth2 token generation for Swagger UI."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user



# ---------------------------------------------------------------------------- demo mode
# One-tap sign-in by role for demos. The server picks the account; no password is sent or shown.
# On by default for development (DEMO_MODE=false turns it off). Never available when APP_ENV=production.
DEMO_ACCOUNTS = [
    {"key": "site-engineer-a", "label": "Site Engineer", "description": "Tower A: creates and runs tasks", "email": "aditya.patil@construction.ai"},
    {"key": "site-engineer-b", "label": "Site Engineer", "description": "Tower B: creates and runs tasks", "email": "vicky.satpute@construction.ai"},
    {"key": "project-manager", "label": "Project Manager", "description": "Approves unplanned work, sees everything", "email": "pm@construction.ai"},
    {"key": "director", "label": "Director", "description": "Overview and reports, read-only", "email": "exec@construction.ai"},
    {"key": "admin", "label": "Admin", "description": "Full access and settings", "email": "admin@construction.ai"},
]


def demo_mode_enabled() -> bool:
    """Demo sign-in exists for development only. With APP_ENV=production it is always off, whatever DEMO_MODE says."""
    if APP_ENV == "production":
        return False
    return os.getenv("DEMO_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}


class DemoRole(BaseModel):
    key: str
    label: str
    description: str


class DemoLogin(BaseModel):
    key: str


@router.get("/demo-roles", response_model=List[DemoRole])
def demo_roles(db: Session = Depends(get_db)):
    """Roles offered on the sign-in screen. Empty when demo mode is off."""
    if not demo_mode_enabled():
        return []
    emails = {u.email for u in db.query(User).filter(User.is_active == True).all()}  # noqa: E712
    return [DemoRole(key=a["key"], label=a["label"], description=a["description"])
            for a in DEMO_ACCOUNTS if a["email"] in emails]


@router.post("/demo-login", response_model=Token)
def demo_login(body: DemoLogin, db: Session = Depends(get_db)):
    if not demo_mode_enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    account = next((a for a in DEMO_ACCOUNTS if a["key"] == body.key), None)
    user = db.query(User).filter(User.email == account["email"], User.is_active == True).first() if account else None  # noqa: E712
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That demo role is not available")
    from backend.app.services.audit_service import AuditService
    AuditService.log_action(db, action="DEMO_LOGIN", entity_name="User", entity_id=str(user.id),
                            new_values={"role_key": body.key}, user_id=user.id)
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user}
