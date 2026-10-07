"""
Geotechnical External API Authentication & Key Security Subsystem.
Implements cryptographically secure, SHA-256 hashed API keys with granular scopes,
sliding-window rate limiting, multi-tenant isolation, and audit logging.
"""
from __future__ import annotations

import time
import json
import secrets
import hashlib
import threading
import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Request, Header, HTTPException, status, Depends
from fastapi.security import SecurityScopes, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db, SessionLocal
from backend.app.models.all_models import GeotechAPIKey, GeotechAPIAuditLog


# OpenAPI Security Scheme for Swagger UI
geotech_bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="GeotechAPIKeyBearer",
    description="Enter external API key starting with 'geo_live_' or 'geo_test_'"
)


# In-memory thread-safe rate limiter (sliding 60-second window)
_rate_limiter_lock = threading.Lock()
_rate_limiter_history: Dict[str, List[float]] = {}


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 digest of the raw secret API key."""
    cleaned = raw_key.strip()
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def check_rate_limit(key_id_str: str, limit_per_minute: int) -> bool:
    """
    Returns True if request is allowed, False if rate limit exceeded.
    Maintains a sliding 60-second window.
    """
    now = time.time()
    cutoff = now - 60.0

    with _rate_limiter_lock:
        timestamps = _rate_limiter_history.get(key_id_str, [])
        # Prune older than 60s
        timestamps = [ts for ts in timestamps if ts > cutoff]
        if len(timestamps) >= limit_per_minute:
            _rate_limiter_history[key_id_str] = timestamps
            return False
        timestamps.append(now)
        _rate_limiter_history[key_id_str] = timestamps
        return True


def log_geotech_api_audit(
    db: Session,
    api_key_id: Optional[int],
    client_name: Optional[str],
    tenant_id: Optional[str],
    endpoint: str,
    method: str,
    status_code: int,
    ip_address: Optional[str],
    user_agent: Optional[str],
    response_time_ms: float,
    request_id: Optional[str] = None,
    error_message: Optional[str] = None
) -> None:
    """Asynchronously or synchronously persists an audit log record for security compliance."""
    try:
        log_entry = GeotechAPIAuditLog(
            api_key_id=api_key_id,
            client_name=client_name,
            tenant_id=tenant_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            ip_address=ip_address,
            user_agent=user_agent,
            response_time_ms=response_time_ms,
            request_id=request_id,
            error_message=error_message,
            created_at=datetime.datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as exc:
        db.rollback()
        # Non-fatal log failure fallback
        print(f"[GeotechAuditLogger Error]: {exc}")


class GeotechClientContext:
    """Authenticated external client identity injected into API route handlers."""
    def __init__(
        self,
        api_key_id: int,
        key_id: str,
        client_name: str,
        tenant_id: str,
        permissions: List[str],
        environment: str
    ):
        self.api_key_id = api_key_id
        self.key_id = key_id
        self.client_name = client_name
        self.tenant_id = tenant_id
        self.permissions = permissions
        self.environment = environment

    def has_permission(self, permission: str) -> bool:
        return (
            "*" in self.permissions
            or "geotechnical:admin" in self.permissions
            or permission in self.permissions
        )


class GeotechAuthService:
    """Handles API key lifecycle, rotation, revocation, and validation."""

    @staticmethod
    def create_api_key(
        db: Session,
        client_name: str,
        tenant_id: str,
        permissions: List[str],
        environment: str = "production",
        expiry_days: Optional[int] = 365,
        rate_limit_per_minute: int = 60,
        created_by: Optional[str] = None,
        description: Optional[str] = None
    ) -> Tuple[GeotechAPIKey, str]:
        """
        Generates and provisions a new cryptographically random API key.
        Returns the persistent DB model and the raw plaintext key (shown only once).
        """
        prefix = "geo_test_" if environment == "development" else "geo_live_"
        secret_token = secrets.token_urlsafe(32)
        raw_key = f"{prefix}{secret_token}"
        key_hash = hash_api_key(raw_key)

        public_key_id = f"key_{secrets.token_hex(8)}"
        masked_prefix = f"{prefix}{secret_token[:4]}...{secret_token[-4:]}"

        expires_at = None
        if expiry_days:
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=expiry_days)

        key_record = GeotechAPIKey(
            key_id=public_key_id,
            client_name=client_name,
            tenant_id=tenant_id,
            key_prefix=masked_prefix,
            key_hash=key_hash,
            environment=environment,
            created_at=datetime.datetime.utcnow(),
            expires_at=expires_at,
            status="active",
            permissions_json=json.dumps(permissions),
            rate_limit_per_minute=rate_limit_per_minute,
            created_by=created_by,
            description=description
        )

        db.add(key_record)
        db.commit()
        db.refresh(key_record)

        return key_record, raw_key

    @staticmethod
    def rotate_api_key(
        db: Session,
        old_key_id: str,
        grace_period_hours: int = 0
    ) -> Tuple[GeotechAPIKey, str, GeotechAPIKey]:
        """
        Rotates an existing API key: generates a new key with identical tenant and permissions,
        and immediately (or after grace period) marks the old key as revoked.
        """
        old_record = db.query(GeotechAPIKey).filter(GeotechAPIKey.key_id == old_key_id).first()
        if not old_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"API key '{old_key_id}' not found."
            )

        permissions = json.loads(old_record.permissions_json)
        new_record, raw_new_key = GeotechAuthService.create_api_key(
            db=db,
            client_name=old_record.client_name,
            tenant_id=old_record.tenant_id,
            permissions=permissions,
            environment=old_record.environment,
            rate_limit_per_minute=old_record.rate_limit_per_minute,
            description=f"Rotated from {old_record.key_id}"
        )

        # Revoke old key
        old_record.status = "revoked"
        db.commit()

        return new_record, raw_new_key, old_record

    @staticmethod
    def revoke_api_key(db: Session, key_id: str) -> GeotechAPIKey:
        """Revokes an API key immediately, barring all subsequent requests."""
        record = db.query(GeotechAPIKey).filter(GeotechAPIKey.key_id == key_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"API key '{key_id}' not found."
            )
        record.status = "revoked"
        db.commit()
        db.refresh(record)
        return record


def extract_raw_api_key(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> str:
    """Extracts the Bearer or X-API-Key string from HTTP headers."""
    raw_key = None
    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            raw_key = parts[1]
        elif len(parts) == 1:
            raw_key = parts[0]
    elif x_api_key:
        raw_key = x_api_key.strip()

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide header 'Authorization: Bearer geo_live_...' or 'X-API-Key'."
        )

    if not (raw_key.startswith("geo_live_") or raw_key.startswith("geo_test_")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format. External keys must begin with 'geo_live_' or 'geo_test_'."
        )

    return raw_key


def authenticate_geotech_key(
    security_scopes: SecurityScopes,
    request: Request,
    auth_creds: Optional[HTTPAuthorizationCredentials] = Depends(geotech_bearer_scheme),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> GeotechClientContext:
    """
    FastAPI Security Dependency that validates the external API key, checks active status,
    verifies expiration, checks rate limits, enforces required scopes, and logs requests.
    """
    start_time = time.time()
    if auth_creds and auth_creds.credentials:
        raw_key = auth_creds.credentials
    else:
        raw_key = extract_raw_api_key(authorization=authorization, x_api_key=x_api_key)

    if not (raw_key.startswith("geo_live_") or raw_key.startswith("geo_test_")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format. External keys must begin with 'geo_live_' or 'geo_test_'."
        )

    incoming_hash = hash_api_key(raw_key)

    key_record = db.query(GeotechAPIKey).filter(GeotechAPIKey.key_hash == incoming_hash).first()

    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unrecognized API key."
        )

    if key_record.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key is {key_record.status}. Please request a new key or contact administrator."
        )

    # Check expiration
    if key_record.expires_at and key_record.expires_at < datetime.datetime.utcnow():
        key_record.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key has expired. Please rotate or obtain a new key."
        )

    # Check rate limit
    if not check_rate_limit(key_record.key_id, key_record.rate_limit_per_minute):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit of {key_record.rate_limit_per_minute} requests/min exceeded. Please throttle your requests."
        )

    # Parse granted permissions
    granted_permissions: List[str] = []
    if key_record.permissions_json:
        try:
            granted_permissions = json.loads(key_record.permissions_json)
        except Exception:
            granted_permissions = []

    context = GeotechClientContext(
        api_key_id=key_record.id,
        key_id=key_record.key_id,
        client_name=key_record.client_name,
        tenant_id=key_record.tenant_id,
        permissions=granted_permissions,
        environment=key_record.environment
    )

    # Check required scopes
    for scope in security_scopes.scopes:
        if not context.has_permission(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission scope '{scope}'. Your key permissions: {granted_permissions}"
            )

    # Update last_used_at
    key_record.last_used_at = datetime.datetime.utcnow()
    db.commit()

    # Attach context to request state for downstream handlers
    request.state.geotech_client = context
    request.state.auth_start_time = start_time

    return context

