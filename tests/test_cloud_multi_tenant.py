"""
Unit tests for GRTS Cloud Multi-Tenant Architecture, Quotas, Rate Limiter, and Storage Caps.
"""
import unittest
import os
import sys
import shutil
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import database
import security
import auth
import tier_service

class TestCloudMultiTenant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database.init_db()

    def test_01_password_hashing(self):
        pwd = "UltraSecurePassword2026!"
        h = security.hash_password(pwd)
        self.assertTrue(security.verify_password(pwd, h))
        self.assertFalse(security.verify_password("WrongPassword", h))

    def test_02_account_creation_and_jwt(self):
        email = f"user_test_{int(time.time())}@grts.app"
        pwd_hash = security.hash_password("Pass123456")
        user = database.create_user_account(email, pwd_hash, tier="free")
        self.assertIsNotNone(user["id"])
        self.assertEqual(user["email"], email)
        self.assertEqual(user["tier"], "free")

        token = auth.create_access_token({"sub": user["id"], "email": user["email"], "tier": user["tier"]})
        decoded = auth.decode_access_token(token)
        self.assertEqual(decoded["sub"], user["id"])
        self.assertEqual(decoded["tier"], "free")

    def test_03_free_tier_100_quota_enforcement(self):
        dummy_user = {"id": "test_user_quota", "email": "quota@grts.app", "tier": "free"}
        # Below 100
        allowed, msg = tier_service.can_user_add_application(dummy_user, current_app_count=99)
        self.assertTrue(allowed)
        # At 100
        allowed, msg = tier_service.can_user_add_application(dummy_user, current_app_count=100)
        self.assertFalse(allowed)
        self.assertIn("100 applications reached", msg)

    def test_04_vip_friend_promo_redemption(self):
        email = f"friend_{int(time.time())}@grts.app"
        pwd_hash = security.hash_password("Pass123456")
        user = database.create_user_account(email, pwd_hash, tier="free")
        
        # Free before
        self.assertEqual(user["tier"], "free")
        
        # Redeem code
        is_valid, promo_name = tier_service.validate_vip_promo_code("GRTS-FRIEND-FREE")
        self.assertTrue(is_valid)
        database.record_promo_redemption(user["id"], "GRTS-FRIEND-FREE")

        updated = database.get_user_by_id(user["id"])
        self.assertEqual(updated["tier"], "vip_friend")

        # Now can add > 100 apps
        allowed, _ = tier_service.can_user_add_application(updated, current_app_count=150)
        self.assertTrue(allowed)

    def test_05_rate_limiter_sliding_window(self):
        limiter = security.SlidingWindowRateLimiter()
        key = "test_client_ip"
        
        # Max 3 requests in 2 seconds
        for _ in range(3):
            allowed, _ = limiter.is_allowed(key, max_requests=3, window_seconds=2)
            self.assertTrue(allowed)

        # 4th request must be rejected
        allowed, retry_after = limiter.is_allowed(key, max_requests=3, window_seconds=2)
        self.assertFalse(allowed)
        self.assertGreaterEqual(retry_after, 1)

    def test_06_storage_quota_and_payload_sanitization(self):
        payload = {
            "company_name": "A" * 500, # Max 255
            "job_title": "B" * 500,    # Max 255
            "notes": "C" * 10000       # Max 5000
        }
        cleaned = security.sanitize_application_payload(payload)
        self.assertEqual(len(cleaned["company_name"]), 255)
        self.assertEqual(len(cleaned["job_title"]), 255)
        self.assertEqual(len(cleaned["notes"]), 5000)

if __name__ == "__main__":
    unittest.main()
