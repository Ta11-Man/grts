"""
Tier and Quota Enforcement Service for GRTS.
Manages Free Tier (100 app limit), Paid Premium (unlimited), and VIP Friend (free lifetime premium) accounts.
"""
from typing import Optional, Dict, Any, Tuple
import security

FREE_TIER_MAX_APPLICATIONS = 100
MAX_FREE_RESUMES = 3

# Built-in promo codes for friends & VIPs
DEFAULT_VIP_PROMO_CODES = {
    "GRTS-FRIEND-FREE": "VIP Friend Lifetime Access",
    "VIP-GABE-FRIEND": "VIP Friend Lifetime Access",
    "GRTS-PREMIUM-BETA": "Beta Tester Unlimited Access"
}

def can_user_add_application(user: Optional[Dict[str, Any]], current_app_count: int, db_path: Optional[str] = None) -> Tuple[bool, str]:
    """
    Validates whether a user is permitted to create/log another job application.
    Enforces the 100 application cap on Free tier accounts and storage limits on the DB file.
    """
    if not user:
        # Local single-user mode: no artificial caps
        return True, "OK"

    tier = user.get("tier", "free").lower()
    is_premium = tier in ("premium", "vip_friend", "admin")

    # 1. Storage Quota Check
    if db_path:
        within_quota, quota_msg, _ = security.check_database_storage_quota(db_path, is_premium=is_premium)
        if not within_quota:
            return False, quota_msg

    # 2. Application Count Quota Check (100 cap for Free tier)
    if not is_premium:
        if current_app_count >= FREE_TIER_MAX_APPLICATIONS:
            return False, (
                f"Free Tier limit of {FREE_TIER_MAX_APPLICATIONS} applications reached ({current_app_count}/{FREE_TIER_MAX_APPLICATIONS}). "
                f"Please upgrade to Premium for unlimited job tracking, or redeem a VIP Friend promo code."
            )

    return True, "OK"

def validate_vip_promo_code(code: str) -> Tuple[bool, str]:
    """Checks if a promo code is valid."""
    cleaned = code.strip().upper()
    if cleaned in DEFAULT_VIP_PROMO_CODES:
        return True, DEFAULT_VIP_PROMO_CODES[cleaned]
    return False, "Invalid or expired promo code."
