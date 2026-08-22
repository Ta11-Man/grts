"""
GRTS Background Service Manager.

Manages the GRTS FastAPI backend as a silent background daemon on Windows/macOS/Linux.
On Windows, uses pythonw.exe with CREATE_NO_WINDOW so no console window appears.
"""
import argparse
import os
import pathlib
import signal
import subprocess
import sys
import time
import urllib.request

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
PID_FILE = BACKEND_DIR / "grts.pid"
LOG_FILE = BACKEND_DIR / "grts_service.log"
PING_URL = "http://127.0.0.1:8000/ping"


def is_server_responding(timeout: float = 1.0) -> bool:
    """Checks if GRTS backend responds on port 8000."""
    try:
        req = urllib.request.Request(PING_URL, headers={"User-Agent": "GRTS-Service-Check"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_stored_pid() -> int | None:
    """Reads PID from grts.pid file if present and valid."""
    if not PID_FILE.exists():
        return None
    try:
        pid_text = PID_FILE.read_text(encoding="utf-8").strip()
        return int(pid_text)
    except Exception:
        return None


def is_pid_running(pid: int) -> bool:
    """Checks if a process with the given PID is currently active."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            # Query tasklist for PID
            output = subprocess.check_output(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
                text=True,
            )
            return str(pid) in output
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False


def start_service(port: int = 8000, host: str = "127.0.0.1") -> bool:
    """Starts the GRTS backend in the background."""
    if is_server_responding(0.8):
        print(f"[i] GRTS backend is ALREADY running and responding on http://{host}:{port}")
        return True

    stored_pid = get_stored_pid()
    if stored_pid and is_pid_running(stored_pid):
        print(f"[i] GRTS process (PID {stored_pid}) is already running.")
        return True

    python_exe = sys.executable
    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "main:app",
        "--app-dir",
        str(BACKEND_DIR),
        "--host",
        host,
        "--port",
        str(port),
    ]

    kwargs = {
        "cwd": str(REPO_ROOT),
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "stdin": subprocess.DEVNULL,
    }

    if sys.platform == "win32":
        # Detach completely so process persists when parent terminal closes
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200
        kwargs["creationflags"] = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    try:
        proc = subprocess.Popen(cmd, **kwargs)
        PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    except Exception as e:
        print(f"[-] Failed to start GRTS service: {e}", file=sys.stderr)
        return False

    # Wait up to 5 seconds for health check
    for _ in range(25):
        time.sleep(0.2)
        if is_server_responding(0.5):
            print(f"[+] GRTS backend started successfully in background! (PID {proc.pid})")
            print(f"    - URL: http://{host}:{port}")
            print(f"    - API Docs: http://{host}:{port}/docs")
            return True

    if is_pid_running(proc.pid):
        print(f"[+] GRTS process started (PID {proc.pid}).")
        return True

    print("[-] Warning: Service started but port 8000 is not responding yet.", file=sys.stderr)
    return False


def find_pids_on_port(port: int = 8000) -> list[int]:
    """Finds PIDs listening on the specified port on Windows, macOS, or Linux."""
    pids = []
    if sys.platform == "win32":
        try:
            output = subprocess.check_output(
                ["netstat", "-ano", "-p", "TCP"],
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
                text=True,
            )
            for line in output.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
                    try:
                        pids.append(int(parts[-1]))
                    except ValueError:
                        pass
        except Exception:
            pass
    else:
        # macOS / Linux: use lsof
        try:
            output = subprocess.check_output(["lsof", "-ti", f":{port}"], text=True)
            for line in output.splitlines():
                if line.strip().isdigit():
                    pids.append(int(line.strip()))
        except Exception:
            pass
    return list(set(pids))


def stop_service(port: int = 8000) -> bool:
    """Stops the running GRTS background process."""
    stored_pid = get_stored_pid()
    target_pids = set()
    if stored_pid:
        target_pids.add(stored_pid)

    # Also query any listening process on port 8000
    for p in find_pids_on_port(port):
        target_pids.add(p)

    for pid in target_pids:
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass
        else:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass

    # Cleanup PID file
    if PID_FILE.exists():
        try:
            PID_FILE.unlink()
        except OSError:
            pass

    time.sleep(0.5)
    if not is_server_responding(0.5):
        print("[+] GRTS backend service stopped.")
        return True
    else:
        print("[-] Warning: Port 8000 is still responding.")
        return False


def check_status():
    """Prints current status of GRTS background service."""
    responding = is_server_responding(0.8)
    stored_pid = get_stored_pid()

    print("--- GRTS Service Status ---")
    if responding:
        pid_info = f" (PID {stored_pid})" if stored_pid else ""
        print(f"Status:  RUNNING / ONLINE{pid_info}")
        print("Address: http://127.0.0.1:8000")
        print("Docs:    http://127.0.0.1:8000/docs")
    else:
        if stored_pid and is_pid_running(stored_pid):
            print(f"Status:  PROCESS ACTIVE (PID {stored_pid}) but not responding on port 8000")
        else:
            print("Status:  STOPPED / OFFLINE")


def main():
    parser = argparse.ArgumentParser(description="GRTS Background Service Manager")
    subparsers = parser.add_subparsers(dest="command", help="Service command")

    subparsers.add_parser("start", help="Start GRTS backend in silent background mode")
    subparsers.add_parser("stop", help="Stop GRTS background service")
    subparsers.add_parser("restart", help="Restart GRTS background service")
    subparsers.add_parser("status", help="Check status of GRTS background service")

    args = parser.parse_args()
    cmd = args.command or "status"

    if cmd == "start":
        start_service()
    elif cmd == "stop":
        stop_service()
    elif cmd == "restart":
        stop_service()
        time.sleep(0.5)
        start_service()
    elif cmd == "status":
        check_status()


if __name__ == "__main__":
    main()
