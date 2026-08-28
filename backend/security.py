"""
Security, Rate Limiting, and Storage Quotas for GRTS.
Protects the Raspberry Pi server against spam, credential stuffing, and storage exhaustion.
"""
import os
import time
import hashlib
import secrets
from typing import Dict, Tuple, Optional, Any
from collections import defaultdict, deque

# Storage Quota Limits
MAX_USER_DB_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB per tenant database (Free tier)
MAX_PREMIUM_DB_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB per tenant database (Premium)
MAX_REQUEST_BODY_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB general HTTP body limit
MAX_RESUME_PDF_SIZE_BYTES = 3 * 1024 * 1024  # 3 MB per PDF upload

# Field Length Restrictions (Anti-Payload Bloat)
FIELD_LIMITS = {
    "job_title": 255,
    "company_name": 255,
    "location": 255,
    "status": 100,
    "workplace_type": 50,
    "salary_range": 100,
    "url": 2048,
    "notes": 5000,
    "description": 20000,
    "job_description": 20000,
    "cover_letter": 15000,
    "skills": 2000,
}

# ----------------- PASSWORD HASHING (PBKDF2-HMAC-SHA256) -----------------

def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique salt (200,000 iterations)."""
    salt = secrets.token_hex(16)
    iterations = 200_000
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations
    )
    return f"pbkdf2_sha256${iterations}${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a stored PBKDF2-HMAC-SHA256 hash using constant-time comparison."""
    if not hashed_password or not plain_password:
        return False
    try:
        parts = hashed_password.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_key = parts[3]
        
        test_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        )
        return secrets.compare_digest(test_key.hex(), expected_key)
    except Exception:
        return False

# ----------------- SLIDING-WINDOW RATE LIMITER -----------------

class SlidingWindowRateLimiter:
    """
    In-memory sliding window rate limiter.
    Maintains a rolling queue of timestamps per key.
    Automatically purges expired timestamps.
    """
    def __init__(self):
        # key -> deque of timestamps
        self._records: Dict[str, deque] = defaultdict(deque)
        self._last_cleanup = time.time()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Checks if a request under `key` is permitted.
        Returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        
        # Periodic cleanup of completely stale keys every 5 minutes
        if now - self._last_cleanup > 300:
            self._cleanup_all(now)
            self._last_cleanup = now

        timestamps = self._records[key]
        cutoff = now - window_seconds

        # Remove timestamps outside the active window
        while timestamps and timestamps[0] <= cutoff:
            timestamps.popleft()

        if len(timestamps) < max_requests:
            timestamps.append(now)
            return True, 0
        else:
            # Calculate wait time until oldest request in window expires
            retry_after = int(timestamps[0] + window_seconds - now) + 1
            return False, max(1, retry_after)

    def _cleanup_all(self, now: float):
        keys_to_delete = []
        for k, dq in self._records.items():
            while dq and dq[0] <= (now - 3600):
                dq.popleft()
            if not dq:
                keys_to_delete.append(k)
        for k in keys_to_delete:
            del self._records[k]

# Global Rate Limiter Instance
rate_limiter = SlidingWindowRateLimiter()

# ----------------- STORAGE QUOTA VERIFICATION -----------------

def check_database_storage_quota(db_path: str, is_premium: bool = False) -> Tuple[bool, str, int]:
    """
    Checks if a tenant's SQLite database file is within the maximum allowed storage quota.
    Returns (within_limit, message, current_size_bytes).
    """
    if not os.path.exists(db_path):
        return True, "OK", 0

    try:
        current_size = os.path.getsize(db_path)
        limit = MAX_PREMIUM_DB_SIZE_BYTES if is_premium else MAX_USER_DB_SIZE_BYTES

        if current_size >= limit:
            limit_mb = limit / (1024 * 1024)
            current_mb = round(current_size / (1024 * 1024), 2)
            return False, f"Storage quota exceeded: {current_mb}MB used of {limit_mb}MB maximum limit.", current_size

        return True, "OK", current_size
    except Exception as e:
        return True, str(e), 0

# ----------------- SANITIZATION HELPERS -----------------

def sanitize_application_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Truncates string fields exceeding allowed lengths to prevent database bloating."""
    cleaned = dict(data)
    for field, max_len in FIELD_LIMITS.items():
        if field in cleaned and isinstance(cleaned[field], str):
            cleaned[field] = cleaned[field][:max_len].strip()
    return cleaned
