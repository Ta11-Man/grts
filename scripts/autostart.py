"""
GRTS Cross-Platform Auto-Start & Desktop Launcher Installer (Windows & macOS).

Manages automatic startup of the GRTS backend on login (Windows Startup & macOS LaunchAgents),
and creates convenient 1-click desktop launchers.
"""
import argparse
import os
import pathlib
import stat
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
SERVICE_SCRIPT = REPO_ROOT / "scripts" / "grts_service.py"
DASHBOARD_HTML = REPO_ROOT / "extension" / "dashboard.html"
MAC_LAUNCH_AGENT_PATH = pathlib.Path.home() / "Library" / "LaunchAgents" / "com.grts.backend.plist"


def get_windows_startup_dir() -> pathlib.Path | None:
    """Returns the user's Windows Startup directory path."""
    if sys.platform != "win32":
        return None
    appdata = os.environ.get("APPDATA")
    if appdata:
        p = pathlib.Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        if p.exists():
            return p
    return None


def get_desktop_dir() -> pathlib.Path | None:
    """Returns the user's Desktop directory path on Windows or macOS."""
    if sys.platform == "win32":
        userprofile = os.environ.get("USERPROFILE")
        if userprofile:
            onedrive_desktop = pathlib.Path(userprofile) / "OneDrive" / "Desktop"
            if onedrive_desktop.exists():
                return onedrive_desktop
            standard_desktop = pathlib.Path(userprofile) / "Desktop"
            if standard_desktop.exists():
                return standard_desktop
        h_desktop = pathlib.Path.home() / "Desktop"
        if h_desktop.exists():
            return h_desktop
    else:
        # macOS / Linux
        mac_desktop = pathlib.Path.home() / "Desktop"
        if mac_desktop.exists():
            return mac_desktop
    return None


def generate_vbs_launcher(action: str = "start", open_dashboard: bool = False) -> str:
    """Generates a silent VBScript for Windows."""
    python_exe = sys.executable
    pyw_exe = python_exe
    if sys.platform == "win32":
        pyw = pathlib.Path(python_exe).parent / "pythonw.exe"
        if pyw.exists():
            pyw_exe = str(pyw)

    lines = [
        "' GRTS Silent Background Launcher (Windows)",
        "Set WshShell = CreateObject(\"WScript.Shell\")",
        f"WshShell.CurrentDirectory = \"{REPO_ROOT}\"",
    ]

    if action == "start":
        lines.append(f"WshShell.Run \"\"\"{pyw_exe}\"\" -m uvicorn main:app --app-dir backend --port 8000\", 0, False")
    else:
        lines.append(f"WshShell.Run \"\"\"{python_exe}\"\" \"\"{SERVICE_SCRIPT}\"\" {action}\", 0, True")

    if open_dashboard:
        lines.append("WScript.Sleep 600")
        lines.append(f"WshShell.Run \"\"\"{DASHBOARD_HTML}\"\"\", 1, False")

    return "\r\n".join(lines) + "\r\n"


def generate_mac_command_launcher(action: str = "start", open_dashboard: bool = False) -> str:
    """Generates a double-clickable .command shell script for macOS."""
    python_exe = sys.executable
    lines = [
        "#!/bin/bash",
        f"cd \"{REPO_ROOT}\"",
    ]

    if action == "start":
        lines.append(f"\"{python_exe}\" \"{SERVICE_SCRIPT}\" start")
    else:
        lines.append(f"\"{python_exe}\" \"{SERVICE_SCRIPT}\" {action}")

    if open_dashboard:
        lines.append(f"sleep 0.5")
        lines.append(f"open \"{DASHBOARD_HTML}\"")

    return "\n".join(lines) + "\n"


def generate_mac_plist() -> str:
    """Generates a macOS LaunchAgent property list."""
    python_exe = sys.executable
    log_file = BACKEND_DIR / "grts_service.log"
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.grts.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>{python_exe}</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>main:app</string>
        <string>--app-dir</string>
        <string>{BACKEND_DIR}</string>
        <string>--port</string>
        <string>8000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>{REPO_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{log_file}</string>
    <key>StandardErrorPath</key>
    <string>{log_file}</string>
</dict>
</plist>
"""


def enable_autostart():
    """Installs silent startup script on Windows or LaunchAgent on macOS."""
    if sys.platform == "win32":
        startup_dir = get_windows_startup_dir()
        if not startup_dir:
            print("[-] Could not find Windows Startup folder.", file=sys.stderr)
            return False

        target_file = startup_dir / "GRTS_Autostart.vbs"
        vbs_content = generate_vbs_launcher(action="start", open_dashboard=False)
        target_file.write_text(vbs_content, encoding="utf-8")
        print(f"[+] Windows Auto-Start Enabled!")
        print(f"    Startup shortcut created: {target_file}")
        print(f"    GRTS will now start silently in the background whenever you log into Windows.")
        return True

    elif sys.platform == "darwin":
        MAC_LAUNCH_AGENT_PATH.parent.mkdir(parents=True, exist_ok=True)
        MAC_LAUNCH_AGENT_PATH.write_text(generate_mac_plist(), encoding="utf-8")
        try:
            subprocess.run(["launchctl", "load", str(MAC_LAUNCH_AGENT_PATH)], check=True)
            print(f"[+] macOS LaunchAgent Enabled!")
            print(f"    Installed: {MAC_LAUNCH_AGENT_PATH}")
            print(f"    GRTS backend will now run automatically on macOS login.")
            return True
        except Exception as e:
            print(f"[-] Failed to load macOS LaunchAgent: {e}", file=sys.stderr)
            return False
    else:
        print(f"[i] Auto-start configuration for {sys.platform} is available via cron/systemd.")
        return True


def disable_autostart():
    """Removes startup service on Windows or macOS."""
    if sys.platform == "win32":
        startup_dir = get_windows_startup_dir()
        if not startup_dir:
            return False
        target_file = startup_dir / "GRTS_Autostart.vbs"
        if target_file.exists():
            target_file.unlink()
            print(f"[+] Windows Auto-Start Disabled. (Removed {target_file.name})")
            return True
        else:
            print(f"[i] Auto-start is not currently installed.")
            return True

    elif sys.platform == "darwin":
        if MAC_LAUNCH_AGENT_PATH.exists():
            try:
                subprocess.run(["launchctl", "unload", str(MAC_LAUNCH_AGENT_PATH)], check=False)
            except Exception:
                pass
            MAC_LAUNCH_AGENT_PATH.unlink()
            print(f"[+] macOS LaunchAgent Disabled.")
            return True
        else:
            print(f"[i] LaunchAgent is not currently installed.")
            return True
    return True


def make_executable(p: pathlib.Path):
    """Sets executable permission bit (chmod +x) on POSIX."""
    if sys.platform != "win32" and p.exists():
        current = p.stat().st_mode
        p.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def create_desktop_shortcut():
    """Creates a 1-click desktop launcher to start GRTS and open Dashboard."""
    desktop_dir = get_desktop_dir()
    if not desktop_dir:
        print("[-] Could not locate Desktop folder.", file=sys.stderr)
        return False

    if sys.platform == "win32":
        target_file = desktop_dir / "GRTS Dashboard.vbs"
        vbs_content = generate_vbs_launcher(action="start", open_dashboard=True)
        target_file.write_text(vbs_content, encoding="utf-8")
        print(f"[+] Desktop Launcher Created: {target_file}")
    else:
        # macOS / Linux
        target_file = desktop_dir / "GRTS_Dashboard.command"
        target_file.write_text(generate_mac_command_launcher(action="start", open_dashboard=True), encoding="utf-8")
        make_executable(target_file)
        print(f"[+] macOS Desktop Launcher Created: {target_file}")

    print(f"    Double-clicking this icon will start the backend and open the Dashboard.")
    return True


def create_root_launchers():
    """Generates handy root-level scripts for both Windows and macOS."""
    # Windows launchers (.vbs)
    (REPO_ROOT / "start_grts.vbs").write_text(generate_vbs_launcher("start", False), encoding="utf-8")
    (REPO_ROOT / "stop_grts.vbs").write_text(generate_vbs_launcher("stop", False), encoding="utf-8")
    (REPO_ROOT / "launch_dashboard.vbs").write_text(generate_vbs_launcher("start", True), encoding="utf-8")

    # macOS launchers (.command)
    start_cmd = REPO_ROOT / "start_grts.command"
    stop_cmd = REPO_ROOT / "stop_grts.command"
    dash_cmd = REPO_ROOT / "launch_dashboard.command"

    start_cmd.write_text(generate_mac_command_launcher("start", False), encoding="utf-8")
    stop_cmd.write_text(generate_mac_command_launcher("stop", False), encoding="utf-8")
    dash_cmd.write_text(generate_mac_command_launcher("start", True), encoding="utf-8")

    for p in (start_cmd, stop_cmd, dash_cmd):
        make_executable(p)

    print(f"[+] Generated root launchers for Windows (.vbs) and macOS (.command)")


def main():
    parser = argparse.ArgumentParser(description="GRTS Cross-Platform Auto-Start & Desktop Launcher")
    parser.add_argument("--enable", action="store_true", help="Enable auto-start on login (Windows/macOS)")
    parser.add_argument("--disable", action="store_true", help="Disable auto-start on login")
    parser.add_argument("--desktop", action="store_true", help="Create 1-click Desktop launcher")
    parser.add_argument("--root-scripts", action="store_true", help="Generate root launcher scripts")

    args = parser.parse_args()

    if args.enable:
        enable_autostart()
    elif args.disable:
        disable_autostart()
    elif args.desktop:
        create_desktop_shortcut()
    elif args.root_scripts:
        create_root_launchers()
    else:
        enable_autostart()
        create_desktop_shortcut()
        create_root_launchers()


if __name__ == "__main__":
    main()
