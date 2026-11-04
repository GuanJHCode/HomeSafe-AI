#!/usr/bin/env python3
"""Stage only verified local demo files for the Vite development preview."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from stage_browser_core import R, stage
from vendor_pyodide_from_dir import VERSION, read_lock, selection


PUBLIC = R / "apps/web/public"
DIST = R / "apps/web/dist"
ENGINE_FILES = {
    "engine/rule-worker.mjs", "engine/worker-controller.mjs",
    "engine/python/homesafe_core.zip", "engine/python/manifest.json",
    "engine/config.json", "engine/scene-before.json",
}
VITE_ASSET = re.compile(r"assets/[A-Za-z0-9_-]+\.(?:js|css)")


def stage_preview():
    spike = R / "browser-spike"
    source = spike / "vendor/pyodide"
    manifest_path = source / "vendor-manifest.json"
    if not manifest_path.is_file():
        raise ValueError("Run vendor_pyodide_from_dir.py preview and --copy first")
    manifest = json.loads(manifest_path.read_text())
    records = selection(source, manifest["lock_sha256"])
    lock, _ = read_lock(source, manifest["lock_sha256"])
    if (manifest["version"] != VERSION or manifest["files"] != records
            or manifest["lock_info"] != lock["info"]):
        raise ValueError("Vendored runtime differs from its selection manifest")

    stage()
    vendor = PUBLIC / "vendor/pyodide"
    engine = PUBLIC / "engine"
    vendor.mkdir(parents=True, exist_ok=True)
    (engine / "python").mkdir(parents=True, exist_ok=True)
    if set(vendor.iterdir()) - {vendor / name for name in
                              ["vendor-manifest.json", *(entry["path"] for entry in records)]}:
        raise ValueError("Unexpected files under staged Pyodide directory")
    for entry in records:
        shutil.copyfile(source / entry["path"], vendor / entry["path"])
    shutil.copyfile(manifest_path, vendor / manifest_path.name)
    for name in ("rule-worker.mjs", "worker-controller.mjs",
                 "python/homesafe_core.zip", "python/manifest.json"):
        shutil.copyfile(spike / name, engine / name)
    config = json.loads((spike / "config.same-origin.json").read_text())
    for key in ("coreBundle", "coreManifest"):
        config[key] = f"engine/{config[key]}"
    config["mode"] = "development_preview"
    (engine / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    shutil.copyfile(R / "examples/scene-before.json", engine / "scene-before.json")
    print("Staged same-origin Worker, canonical demo, Python bundle and verified vendor files.")


def verify_dist():
    vendor = "vendor/pyodide"
    manifest = json.loads((PUBLIC / vendor / "vendor-manifest.json").read_text())
    public_files = ENGINE_FILES | {f"{vendor}/vendor-manifest.json"} | {
        f"{vendor}/{entry['path']}" for entry in manifest["files"]
    }
    records = []
    actual = set()
    for path in sorted(DIST.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Unexpected symbolic link: {path.name}")
        if not path.is_file():
            continue
        name = path.relative_to(DIST).as_posix()
        if name in {"preview-manifest.json", "CHECKSUMS.sha256"}:
            continue
        if name not in public_files and name != "index.html" and not VITE_ASSET.fullmatch(name):
            raise ValueError(f"Unreviewed preview file: {name}")
        data = path.read_bytes()
        if name in public_files and data != (PUBLIC / name).read_bytes():
            raise ValueError(f"Staged file differs from build: {name}")
        actual.add(name)
        records.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})

    missing = (public_files | {"index.html"}) - actual
    if missing:
        raise ValueError(f"Missing preview files: {', '.join(sorted(missing))}")
    html = (DIST / "index.html").read_text()
    entrypoints = re.findall(r'(?:src|href)="([^"]+)"', html)
    if (not any(url.endswith(".js") for url in entrypoints)
            or any(not url.startswith("./") or url[2:] not in actual for url in entrypoints)):
        raise ValueError("Preview entrypoints must be relative build files")
    report = {"release_type": "development_preview", "real_lux3d_assets": 0, "files": records}
    manifest_bytes = (json.dumps(report, indent=2) + "\n").encode()
    (DIST / "preview-manifest.json").write_bytes(manifest_bytes)
    hashes = [f"{entry['sha256']}  {entry['path']}" for entry in records]
    hashes.append(f"{hashlib.sha256(manifest_bytes).hexdigest()}  preview-manifest.json")
    (DIST / "CHECKSUMS.sha256").write_text("\n".join(hashes) + "\n")
    print(f"Verified {len(records)} development preview files; anonymous hosting still requires verification.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-dist", action="store_true")
    args = parser.parse_args()
    try:
        verify_dist() if args.verify_dist else stage_preview()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f"BLOCKED: {error}") from error
