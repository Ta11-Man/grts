"""
Authentication, JWT Token Handling, and User Identity Verification for GRTS.
Supports both Cloud/Multi-Tenant and Local/Self-Hosted single user mode.
"""
import os
import time
import secrets
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException, status, Depends
import security

SECRET_KEY_FILE = os.path.join(os.path.dirname(__file__), ".secret_key")

def _get_or_create_jwt_secret() -> str:
    env_secret = os.environ.get("GRTS_JWT_SECRET")
    if env_secret:
        return env_secret
    if os.path.exists(SECRET_KEY_FILE):
        try:
            with open(SECRET_KEY_FILE, "r", encoding="utf-8") as f:
                s = f.read().strip()
                if s:
                    return s
        except Exception:
            pass
    new_secret = secrets.token_urlsafe(48)
    try:
        with open(SECRET_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(new_secret)
    except Exception:
        pass
    return new_secret

JWT_SECRET = _get_or_create_jwt_secret()
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 90  # 90-day persistent session token for browser addon

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + (expires_delta or timedelta(days=JWT_EXPIRATION_DAYS))
    to_encode.update({"exp": expire, "iat": now_utc})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def extract_token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    if len(parts) == 1:
        return parts[0]
    return None

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """
    Returns user dict if valid Bearer token is provided.
    If no header is passed, returns None (allowing local single-tenant fallback).
    """
    token = extract_token_from_header(authorization)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )
    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "tier": payload.get("tier", "free")
    }

async def require_authenticated_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Strict dependency requiring valid JWT authentication."""
    user = await get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in or provide a valid API token."
        )
    return user
