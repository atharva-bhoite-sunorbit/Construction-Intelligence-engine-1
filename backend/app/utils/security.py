import os
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt

# Fix passlib/bcrypt incompatibility if __about__ missing
if not hasattr(bcrypt, "__about__"):
    class About:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = About()

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import User

APP_ENV = os.getenv("APP_ENV", "development").lower()
_DEV_SECRET_KEY = "dev-only-secret-key-change-me"
SECRET_KEY = os.getenv("SECRET_KEY") or ""
if not SECRET_KEY:
    if APP_ENV == "production":
        raise RuntimeError("SECRET_KEY must be set when APP_ENV=production")
    SECRET_KEY = _DEV_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Returns the user behind a valid token, or None. There is no default or demo user."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        return None
    return user

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    user = get_current_user_optional(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles and user.role != "Admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {allowed_roles}. Current role: {user.role}"
            )
        return user
    return role_checker
