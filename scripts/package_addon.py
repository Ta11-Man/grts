"""
Packages the GRTS browser extension into Mozilla/AMO-compliant and Chrome-compliant zip files.
Ensures standard POSIX forward slashes (/) are used for all file paths in the archives.
"""
import os
import pathlib
import zipfile
import json

def package_extension(browser: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    ext_dir = repo_root / "extension"
    output_zip = f"grts-{browser}.zip"
    out_file = repo_root / output_zip

    print(f"Packaging {browser.capitalize()} extension from: {ext_dir}")
    print(f"Destination archive: {out_file}")

    file_count = 0
    try:
        with zipfile.ZipFile(out_file, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(ext_dir):
                for f in files:
                    # Exclude temporary, dev, and unused legacy files like dashboard.js
                    if f.endswith(".DS_Store") or f.endswith(".pyc") or f.endswith(".git") or f == "dashboard.js":
                        continue
                    full_path = pathlib.Path(root) / f
                    rel_posix = full_path.relative_to(ext_dir).as_posix()
                    
                    if rel_posix == "manifest.json" and browser == "firefox":
                        # Parse manifest and strip service_worker for Firefox compatibility
                        with open(full_path, "r", encoding="utf-8") as mf:
                            mdata = json.load(mf)
                        if "background" in mdata and "service_worker" in mdata["background"]:
                            del mdata["background"]["service_worker"]
                        zipf.writestr(rel_posix, json.dumps(mdata, indent=2))
                    else:
                        zipf.write(full_path, arcname=rel_posix)
                    file_count += 1

        print(f"Successfully packaged {file_count} files into {output_zip} with standard POSIX paths.\n")
    except (OSError, PermissionError) as e:
        print(f"\n[ERROR] Could not write to {output_zip} ({e}).")
        print(f"-> This happens when {output_zip} is currently open or loaded as a temporary add-on in Firefox.")
        print("-> Fix: In Firefox (about:debugging), click 'Remove' on the extension (or load 'extension/manifest.json' instead of the .zip).\n")
        raise

if __name__ == "__main__":
    package_extension("firefox")
    package_extension("chrome")

