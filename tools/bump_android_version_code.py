#!/usr/bin/env python3
"""Set both Android export presets from application/config/version.

versionCode = MAJOR * 1000000 + MINOR * 10000 + PATCH * 100 + rebuild
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "project.godot"
PRESETS = ROOT / "export_presets.cfg"


def read_version() -> str:
    text = PROJECT.read_text(encoding="utf-8")
    match = re.search(r'^config/version="([^"]+)"', text, re.M)
    if not match:
        raise SystemExit("application/config/version not found in project.godot")
    return match.group(1)


def version_code(version: str, rebuild: int) -> int:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise SystemExit(f"config/version must be MAJOR.MINOR.PATCH, got {version!r}")
    major, minor, patch = (int(part) for part in parts)
    return major * 1000000 + minor * 10000 + patch * 100 + rebuild


def bump_presets(text: str, code: int, name: str) -> str:
    chunks = re.split(r"(?=^\[preset\.\d+\]\n)", text, flags=re.M)
    changed = 0
    out = []
    for chunk in chunks:
        if 'platform="Android"' not in chunk:
            out.append(chunk)
            continue
        updated = re.sub(r"^version/code=\d+", f"version/code={code}", chunk, count=1, flags=re.M)
        updated = re.sub(r'^version/name="[^"]*"', f'version/name="{name}"', updated, count=1, flags=re.M)
        if updated == chunk:
            raise SystemExit("An Android preset is missing version/code or version/name")
        changed += 1
        out.append(updated)
    if changed != 2:
        raise SystemExit(f"Expected 2 Android presets, updated {changed}")
    return "".join(out)


def main() -> None:
    rebuild = 0
    if len(sys.argv) > 1:
        if not sys.argv[1].isdigit():
            raise SystemExit("rebuild must be a non-negative integer")
        rebuild = int(sys.argv[1])
    name = read_version()
    code = version_code(name, rebuild)
    original = PRESETS.read_text(encoding="utf-8")
    updated = bump_presets(original, code, name)
    PRESETS.write_text(updated, encoding="utf-8", newline="\n")
    print(f"Android version/name={name} version/code={code}")


if __name__ == "__main__":
    main()
