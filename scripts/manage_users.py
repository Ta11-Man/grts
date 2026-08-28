"""
GRTS User & Tier Administration CLI for Raspberry Pi self-hosted server.
Usage:
  python scripts/manage_users.py list
  python scripts/manage_users.py set-tier <email> <free|premium|vip_friend>
  python scripts/manage_users.py grant-vip <email>
  python scripts/manage_users.py create-user <email> <password> [--tier free|premium|vip_friend]
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import database
import security

def list_users():
    database.init_core_db()
    conn = database.get_core_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, tier, created_at, last_login_at FROM users ORDER BY created_at DESC")
    users = cursor.fetchall()
    conn.close()

    if not users:
        print("No users found in core_accounts.db.")
        return

    print(f"\n{'ID':<38} | {'Email':<30} | {'Tier':<12} | {'Apps':<6} | {'DB Size':<10} | {'Created At'}")
    print("-" * 115)
    for u in users:
        uid = u["id"]
        app_count = database.count_user_applications(uid)
        db_path = database.get_user_db_path(uid)
        size_kb = round(os.path.getsize(db_path) / 1024, 1) if os.path.exists(db_path) else 0.0
        print(f"{uid:<38} | {u['email']:<30} | {u['tier']:<12} | {app_count:<6} | {f'{size_kb} KB':<10} | {u['created_at']}")
    print("-" * 115)
    print(f"Total Accounts: {len(users)}\n")

def set_user_tier(email: str, tier: str):
    database.init_core_db()
    user = database.get_user_by_email(email)
    if not user:
        print(f"Error: User with email '{email}' not found.")
        sys.exit(1)
    
    tier_clean = tier.lower().strip()
    if tier_clean not in ("free", "premium", "vip_friend", "admin"):
        print("Invalid tier. Choose from: free, premium, vip_friend, admin")
        sys.exit(1)

    database.update_user_tier(user["id"], tier_clean)
    print(f"✓ Success: Updated {email} to tier '{tier_clean}'.")

def create_user(email: str, password: str, tier: str = "free"):
    database.init_core_db()
    existing = database.get_user_by_email(email)
    if existing:
        print(f"Error: User with email '{email}' already exists.")
        sys.exit(1)
    
    pwd_hash = security.hash_password(password)
    user = database.create_user_account(email, pwd_hash, tier=tier)
    print(f"✓ User created successfully: {user['email']} (ID: {user['id']}, Tier: {user['tier']})")

def main():
    parser = argparse.ArgumentParser(description="GRTS User & Tier Administration CLI")
    subparsers = parser.add_subparsers(dest="command")

    # list
    subparsers.add_parser("list", help="List all user accounts and storage metrics")

    # set-tier
    p_tier = subparsers.add_parser("set-tier", help="Set user subscription tier")
    p_tier.add_argument("email", help="User email address")
    p_tier.add_argument("tier", choices=["free", "premium", "vip_friend", "admin"], help="New tier")

    # grant-vip
    p_vip = subparsers.add_parser("grant-vip", help="Grant free lifetime VIP friend tier")
    p_vip.add_argument("email", help="User email address")

    # create-user
    p_create = subparsers.add_parser("create-user", help="Create a user account")
    p_create.add_argument("email", help="User email address")
    p_create.add_argument("password", help="User password")
    p_create.add_argument("--tier", default="free", choices=["free", "premium", "vip_friend", "admin"])

    args = parser.parse_args()

    if args.command == "list":
        list_users()
    elif args.command == "set-tier":
        set_user_tier(args.email, args.tier)
    elif args.command == "grant-vip":
        set_user_tier(args.email, "vip_friend")
    elif args.command == "create-user":
        create_user(args.email, args.password, args.tier)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
