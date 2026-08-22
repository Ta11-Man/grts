"""
Safe Database Restore Utility for GRTS.

Restores backend/grts.db from a chosen snapshot (.db or .sql).
Always creates a safety backup of the current database before modifying it.
"""
import argparse
import datetime
import os
import pathlib
import sqlite3
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = REPO_ROOT / "backend" / "grts.db"
DEFAULT_BACKUP_DIR = REPO_ROOT / "backups"
HOME_BACKUP_DIR = pathlib.Path.home() / ".grts_backups"


def get_available_backups(directories: list[pathlib.Path]) -> list[pathlib.Path]:
    """Returns sorted list of available backup files (.db and .sql)."""
    seen = set()
    backups = []
    for d in directories:
        if not d.exists():
            continue
        for f in d.glob("grts_*.*"):
            if f.suffix.lower() in (".db", ".sql") and "pre_restore" not in f.name:
                if f.name not in seen:
                    seen.add(f.name)
                    backups.append(f)
    # Sort newest first by stem name (contains timestamp); prefer .db over .sql
    backups.sort(key=lambda p: (p.stem, p.suffix.lower() == ".db"), reverse=True)
    return backups


def verify_db(db_path: pathlib.Path) -> tuple[bool, dict]:
    """Runs SQLite integrity check and counts records across tables."""
    stats = {}
    is_ok = False
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        chk = cursor.execute("PRAGMA integrity_check;").fetchone()
        is_ok = chk and chk[0] == "ok"

        tables = [
            r[0]
            for r in cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        ]
        for tbl in tables:
            try:
                cnt = cursor.execute(f"SELECT COUNT(*) FROM [{tbl}]").fetchone()[0]
                stats[tbl] = cnt
            except Exception:
                stats[tbl] = "?"
        conn.close()
    except Exception as e:
        stats["error"] = str(e)
    return is_ok, stats


def create_safety_backup(db_path: pathlib.Path, backup_dir: pathlib.Path) -> pathlib.Path | None:
    """Creates a quick pre-restore snapshot of the current active database."""
    if not db_path.exists():
        return None
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safety_db = backup_dir / f"grts_pre_restore_{ts}.db"
    src = sqlite3.connect(str(db_path))
    dst = sqlite3.connect(str(safety_db))
    with dst:
        src.backup(dst)
    dst.close()
    src.close()
    return safety_db


def restore_backup(
    backup_file: pathlib.Path,
    target_db: pathlib.Path = DEFAULT_DB_PATH,
    dry_run: bool = False,
) -> bool:
    """Restores database from either a .db binary or a .sql dump."""
    if not backup_file.exists():
        print(f"[-] Error: Backup file does not exist: {backup_file}", file=sys.stderr)
        return False

    print(f"\n[+] Restoring from: {backup_file}")
    print(f"    Target database: {target_db}")

    if dry_run:
        print("[!] Dry-run enabled. No changes made.")
        return True

    # 1. Take safety snapshot of existing DB if present
    if target_db.exists():
        safety_path = create_safety_backup(target_db, DEFAULT_BACKUP_DIR)
        if safety_path:
            print(f"[i] Safety pre-restore snapshot saved: {safety_path.name}")

    target_db.parent.mkdir(parents=True, exist_ok=True)

    # 2. Restore based on file extension
    ext = backup_file.suffix.lower()
    if ext == ".db":
        # Safe restore using SQLite backup API into fresh target
        tmp_target = target_db.with_suffix(".tmp")
        src_conn = sqlite3.connect(str(backup_file))
        dst_conn = sqlite3.connect(str(tmp_target))
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()

        # Atomically replace target
        if target_db.exists():
            target_db.unlink()
        tmp_target.rename(target_db)

    elif ext == ".sql":
        tmp_target = target_db.with_suffix(".tmp")
        if tmp_target.exists():
            tmp_target.unlink()
        conn = sqlite3.connect(str(tmp_target))
        with open(backup_file, "r", encoding="utf-8") as f:
            sql_content = f.read()
        conn.executescript(sql_content)
        conn.close()

        if target_db.exists():
            target_db.unlink()
        tmp_target.rename(target_db)

    else:
        print(f"[-] Unsupported file extension: {ext}", file=sys.stderr)
        return False

    # 3. Verify integrity
    is_ok, stats = verify_db(target_db)
    if is_ok:
        print("[+] Restore completed successfully! Database integrity verified (OK).")
        print("\n[i] Restored Table Summary:")
        for tbl, count in sorted(stats.items()):
            print(f"    - {tbl}: {count} records")
        return True
    else:
        print("[-] Warning: Integrity check returned errors after restore.", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="GRTS Safe Database Restore Utility")
    parser.add_argument(
        "--file",
        "-f",
        type=pathlib.Path,
        help="Path to specific .db or .sql backup file to restore",
    )
    parser.add_argument(
        "--latest",
        "-l",
        action="store_true",
        help="Restore the most recent available backup without prompting",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available backups and exit",
    )
    parser.add_argument(
        "--target",
        type=pathlib.Path,
        default=DEFAULT_DB_PATH,
        help="Target database path (default: backend/grts.db)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate restore without modifying the active database",
    )

    args = parser.parse_args()

    backups = get_available_backups([DEFAULT_BACKUP_DIR, HOME_BACKUP_DIR])

    if args.list:
        print(f"[i] Found {len(backups)} available backup files:")
        for idx, b in enumerate(backups, 1):
            mtime = datetime.datetime.fromtimestamp(b.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            sz = b.stat().st_size / 1024
            print(f"  [{idx}] {b.name:<30} ({sz:6.1f} KB, {mtime}) -> {b.parent}")
        return

    if args.file:
        restore_backup(args.file, target_db=args.target, dry_run=args.dry_run)
        return

    if not backups:
        print("[-] No backups found in backups/ or ~/.grts_backups", file=sys.stderr)
        sys.exit(1)

    if args.latest:
        restore_backup(backups[0], target_db=args.target, dry_run=args.dry_run)
        return

    # Interactive selection if no flags passed
    print("\n--- GRTS Database Restore ---")
    print(f"Available backups:")
    for idx, b in enumerate(backups[:10], 1):
        mtime = datetime.datetime.fromtimestamp(b.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        sz = b.stat().st_size / 1024
        print(f"  [{idx}] {b.name:<30} ({sz:6.1f} KB, {mtime})")

    print("\nEnter choice (1-10), 'l' for latest, or 'q' to quit:")
    try:
        choice = input("> ").strip().lower()
        if choice in ("q", "quit", "exit", ""):
            print("Aborted.")
            sys.exit(0)
        elif choice == "l":
            selected = backups[0]
        elif choice.isdigit() and 1 <= int(choice) <= min(10, len(backups)):
            selected = backups[int(choice) - 1]
        else:
            print("Invalid choice.")
            sys.exit(1)

        restore_backup(selected, target_db=args.target, dry_run=args.dry_run)
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        sys.exit(0)


if __name__ == "__main__":
    main()
