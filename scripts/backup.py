"""
Automated Database Backup Utility for GRTS.

Safely snapshots backend/grts.db into binary (.db) and SQL dump (.sql) formats
using SQLite's online backup API.
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


def get_db_stats(conn: sqlite3.Connection) -> dict:
    """Gathers quick statistics on tables and rows in the database."""
    stats = {}
    cursor = conn.cursor()
    try:
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
    except Exception as e:
        stats["error"] = str(e)
    return stats


def backup_database(
    db_path: pathlib.Path,
    dest_dir: pathlib.Path,
    save_to_home: bool = False,
    max_keep: int = 0,
    quiet: bool = False,
) -> tuple[pathlib.Path, pathlib.Path]:
    """
    Creates an atomic SQLite backup (.db) and a SQL dump (.sql).
    """
    if not db_path.exists():
        print(f"[-] Error: Database file not found at: {db_path}", file=sys.stderr)
        sys.exit(1)

    dest_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    target_db = dest_dir / f"grts_{ts}.db"
    target_sql = dest_dir / f"grts_{ts}.sql"

    # Connect to source database
    src_conn = sqlite3.connect(str(db_path))

    # 1. Atomic binary backup using SQLite backup API
    dst_conn = sqlite3.connect(str(target_db))
    with dst_conn:
        src_conn.backup(dst_conn, pages=100)
    dst_conn.close()

    # 2. Plain text SQL dump
    with open(target_sql, "w", encoding="utf-8") as f:
        for line in src_conn.iterdump():
            f.write(f"{line}\n")

    stats = get_db_stats(src_conn)
    src_conn.close()

    # 3. Optional copy to user home directory for off-repo safety
    if save_to_home:
        HOME_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        home_db = HOME_BACKUP_DIR / target_db.name
        home_sql = HOME_BACKUP_DIR / target_sql.name
        with open(target_db, "rb") as sf, open(home_db, "wb") as df:
            df.write(sf.read())
        with open(target_sql, "rb") as sf, open(home_sql, "wb") as df:
            df.write(sf.read())

    # 4. Optional retention pruning
    if max_keep > 0:
        prune_backups(dest_dir, max_keep)
        if save_to_home:
            prune_backups(HOME_BACKUP_DIR, max_keep)

    if not quiet:
        db_size_kb = target_db.stat().st_size / 1024
        sql_size_kb = target_sql.stat().st_size / 1024
        print(f"[+] GRTS Backup Successful! ({ts})")
        print(f"    - Binary Snapshot: {target_db} ({db_size_kb:.1f} KB)")
        print(f"    - SQL Dump Script: {target_sql} ({sql_size_kb:.1f} KB)")
        if save_to_home:
            print(f"    - Home Copy:      {HOME_BACKUP_DIR}")
        print("\n[i] Data Summary:")
        for tbl, count in sorted(stats.items()):
            print(f"    - {tbl}: {count} records")

    return target_db, target_sql


def prune_backups(backup_dir: pathlib.Path, max_keep: int):
    """Keeps only the most recent N backup files in the given directory."""
    if not backup_dir.exists():
        return
    for ext in (".db", ".sql"):
        files = sorted(backup_dir.glob(f"grts_*{ext}"), key=lambda p: p.stat().st_mtime)
        if len(files) > max_keep:
            to_delete = files[:-max_keep]
            for f in to_delete:
                try:
                    f.unlink()
                except OSError:
                    pass


def main():
    parser = argparse.ArgumentParser(description="GRTS Safe Database Backup Utility")
    parser.add_argument(
        "--db",
        type=pathlib.Path,
        default=DEFAULT_DB_PATH,
        help="Path to source SQLite database (default: backend/grts.db)",
    )
    parser.add_argument(
        "--dest",
        "-d",
        type=pathlib.Path,
        default=DEFAULT_BACKUP_DIR,
        help="Destination directory for backups (default: backups/)",
    )
    parser.add_argument(
        "--home",
        action="store_true",
        default=True,
        help="Also store a copy in ~/.grts_backups for off-repo safety (default: True)",
    )
    parser.add_argument(
        "--no-home",
        dest="home",
        action="store_false",
        help="Do not store a copy in ~/.grts_backups",
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=30,
        help="Number of recent backups to retain (default: 30, 0 = keep all)",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress informational output",
    )

    args = parser.parse_args()
    backup_database(
        db_path=args.db,
        dest_dir=args.dest,
        save_to_home=args.home,
        max_keep=args.keep,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    main()
