"""
Packages the GRTS browser extension into a Mozilla/AMO-compliant zip file.
Ensures standard POSIX forward slashes (/) are used for all file paths in the archive.
"""
import os
import pathlib
import zipfile

def package_extension(output_zip: str = "grts-firefox.zip"):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    ext_dir = repo_root / "extension"
    out_file = repo_root / output_zip

    print(f"Packaging extension from: {ext_dir}")
    print(f"Destination archive: {out_file}")

    file_count = 0
    with zipfile.ZipFile(out_file, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(ext_dir):
            for f in files:
                if f.endswith(".DS_Store") or f.endswith(".pyc") or f.endswith(".git"):
                    continue
                full_path = pathlib.Path(root) / f
                rel_posix = full_path.relative_to(ext_dir).as_posix()
                zipf.write(full_path, arcname=rel_posix)
                file_count += 1

    print(f"Successfully packaged {file_count} files into {output_zip} with standard POSIX paths.")

if __name__ == "__main__":
    package_extension()
