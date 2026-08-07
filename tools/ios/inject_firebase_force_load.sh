#!/usr/bin/env bash
# Inject Firebase -force_load flags into the Godot-exported Xcode project.
# Required so GodotFirebaseiOS.framework can resolve static Firebase SDK symbols at launch.
#
# Also repairs a known GDScript export-plugin bug that stripped commas from -Wl,... flags
# (e.g. -Wl,-U,_swift_entry_point → -Wl-U_swift_entry_point), which crashes on launch.
set -euo pipefail

PROJECT_NAME="${1:-StimPad}"
BUILD_DIR="${2:-build}"
PBX="${BUILD_DIR}/${PROJECT_NAME}.xcodeproj/project.pbxproj"
FRAMEWORKS_DIR="${BUILD_DIR}/${PROJECT_NAME}/frameworks"

if [[ ! -f "$PBX" ]]; then
  echo "ERROR: missing $PBX"
  exit 1
fi
if [[ ! -d "$FRAMEWORKS_DIR" ]]; then
  echo "ERROR: missing $FRAMEWORKS_DIR"
  exit 1
fi

CORRUPTED=0
if grep -qE -- '-Wl-U_|-Wl -weak-l' "$PBX"; then
  CORRUPTED=1
  echo "WARNING: corrupted -Wl linker flags detected in $PBX — will rewrite OTHER_LDFLAGS"
fi

# Skip only when force_load is already present AND flags look healthy.
if [[ "$CORRUPTED" -eq 0 ]] && grep -q 'force_load' "$PBX"; then
  if grep -q -- '-Wl,-U,_swift_entry_point' "$PBX" || ! grep -q -- '_swift_entry_point' "$PBX"; then
    echo "force_load already present in $PBX and -Wl flags look healthy; skipping"
    exit 0
  fi
  echo "WARNING: force_load present but -Wl,-U,_swift_entry_point missing — rewriting"
fi

DEVICE_FLAGS=()
SIM_FLAGS=()
while IFS= read -r -d '' xcfw; do
  name="$(basename "$xcfw" .xcframework)"
  device_lib="${xcfw}/ios-arm64/${name}.framework/${name}"
  sim_lib="${xcfw}/ios-arm64_x86_64-simulator/${name}.framework/${name}"
  rel_device="\$(PROJECT_DIR)/${PROJECT_NAME}/frameworks/${name}.xcframework/ios-arm64/${name}.framework/${name}"
  rel_sim="\$(PROJECT_DIR)/${PROJECT_NAME}/frameworks/${name}.xcframework/ios-arm64_x86_64-simulator/${name}.framework/${name}"
  if [[ -f "$device_lib" ]]; then
    DEVICE_FLAGS+=("-force_load ${rel_device}")
  fi
  if [[ -f "$sim_lib" ]]; then
    SIM_FLAGS+=("-force_load ${rel_sim}")
  fi
done < <(find "$FRAMEWORKS_DIR" -maxdepth 1 -type d -name "*.xcframework" -print0 | sort -z)

if [[ ${#DEVICE_FLAGS[@]} -eq 0 ]]; then
  echo "ERROR: no device Firebase libraries found under $FRAMEWORKS_DIR"
  exit 1
fi

DEVICE_STR="${DEVICE_FLAGS[*]}"
SIM_STR="${SIM_FLAGS[*]}"
echo "Injecting ${#DEVICE_FLAGS[@]} device force_load entries into $PBX"

export PBX DEVICE_STR SIM_STR
python3 <<'PY'
import os, re, sys

pbx_path = os.environ["PBX"]
device_str = os.environ["DEVICE_STR"]
sim_str = os.environ["SIM_STR"]

with open(pbx_path, "r", encoding="utf-8") as f:
    content = f.read()

def parse_value(content: str, eq_end: int):
    i = eq_end
    while i < len(content) and content[i] in " \t\r\n":
        i += 1
    if i >= len(content):
        return None
    if content[i] == "(":
        depth = 0
        j = i
        while j < len(content):
            if content[j] == "(":
                depth += 1
            elif content[j] == ")":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
    elif content[i] == '"':
        j = i + 1
        while j < len(content):
            if content[j] == "\\":
                j += 2
                continue
            if content[j] == '"':
                j += 1
                break
            j += 1
    else:
        return None
    while j < len(content) and content[j] in " \t\r\n":
        j += 1
    if j >= len(content) or content[j] != ";":
        return None
    return i, j + 1, content[i:j].strip()

def repair_wl_flag(flag: str) -> str:
    """Undo export-plugin bug that stripped commas from -Wl,... flags."""
    # -Wl-U_foo → -Wl,-U,_foo
    m = re.fullmatch(r"-Wl-U_(.+)", flag)
    if m:
        return f"-Wl,-U,_{m.group(1)}"
    # -Wl -weak-lswiftCore → -Wl,-weak-lswiftCore
    if flag == "-Wl":
        return flag  # handled with next token below
    return flag

def flags_from_raw(raw: str):
    raw = raw.strip()
    out = []
    if raw.startswith("(") and raw.endswith(")"):
        for line in raw[1:-1].splitlines():
            # strip trailing list comma only — commas inside -Wl,... are significant
            flag = line.strip().rstrip(",").strip().strip('"')
            if flag:
                out.append(flag)
    else:
        out.extend(x for x in raw.strip('"').split() if x)

    # Repair adjacent "-Wl" "+ -weak-l..." pairs produced by comma stripping
    repaired = []
    i = 0
    while i < len(out):
        f = out[i]
        if f == "-Wl" and i + 1 < len(out) and out[i + 1].startswith("-weak-l"):
            repaired.append(f"-Wl,{out[i + 1]}")
            i += 2
            continue
        repaired.append(repair_wl_flag(f))
        i += 1

    cleaned = []
    skip = False
    for f in repaired:
        if skip:
            skip = False
            continue
        if f == "-force_load":
            skip = True
            continue
        if "/frameworks/" in f and "force_load" not in f:
            # orphaned path after -force_load skip edge cases
            continue
        cleaned.append(f)
    return cleaned

def make_replacement(raw: str) -> str:
    flags = flags_from_raw(raw)
    if "$(inherited)" not in flags:
        flags.insert(0, "$(inherited)")
    if "-ObjC" not in flags:
        flags.append("-ObjC")
    # Base may already carry an export flag from a prior injection; don't duplicate.
    flags = [f for f in flags if f not in ("-rdynamic", "-Wl,-export_dynamic")]
    base = " ".join(flags)
    # The framework flat-looks-up Firebase symbols in the main executable, so the
    # app has to export them. Bare -rdynamic is not reliably honored by Apple ld.
    return (
        f'"OTHER_LDFLAGS[sdk=iphoneos*]" = "{base} -Wl,-export_dynamic {device_str}";\n'
        f'\t\t\t\t"OTHER_LDFLAGS[sdk=iphonesimulator*]" = "{base} -Wl,-export_dynamic {sim_str}";'
    )

# Rewrite both plain OTHER_LDFLAGS and already sdk-conditioned ones (repair path).
edits = []
for m in re.finditer(r'"?OTHER_LDFLAGS(?:\[sdk=[^\]]+\])?"?\s*=\s*', content):
    key = m.group(0)
    # Prefer collapsing each iphoneos* + iphonesimulator* pair once via the first of the pair.
    if "iphonesimulator" in key:
        # Will be replaced together with the preceding iphoneos rewrite, or alone below.
        pass
    parsed = parse_value(content, m.end())
    if not parsed:
        print(f"WARNING: could not parse OTHER_LDFLAGS near {m.start()}")
        continue
    _vs, value_end, raw = parsed
    edits.append((m.start(), value_end, key, raw))

if not edits:
    insert = (
        '"OTHER_LDFLAGS[sdk=iphoneos*]" = "$(inherited) -ObjC -Wl,-export_dynamic %s";\n'
        '\t\t\t\t"OTHER_LDFLAGS[sdk=iphonesimulator*]" = "$(inherited) -ObjC -Wl,-export_dynamic %s";\n\t\t\t\t'
    ) % (device_str, sim_str)
    content, n = re.subn(r"(buildSettings\s*=\s*\{)", r"\1\n\t\t\t\t" + insert, content)
    if n == 0:
        print("ERROR: no OTHER_LDFLAGS and no buildSettings blocks found", file=sys.stderr)
        sys.exit(1)
    print(f"Inserted OTHER_LDFLAGS into {n} buildSettings block(s)")
else:
    # Group into (start,end) replacements. For sdk pairs, replace both with one dual assignment.
    replacements = []
    i = 0
    while i < len(edits):
        start, end, key, raw = edits[i]
        if "iphoneos" in key and i + 1 < len(edits) and "iphonesimulator" in edits[i + 1][2]:
            # Use device entry's flags (same base); span through simulator entry.
            end = edits[i + 1][1]
            replacements.append((start, end, make_replacement(raw)))
            i += 2
            continue
        if "iphonesimulator" in key and replacements:
            # Orphan simulator line already covered — skip
            i += 1
            continue
        replacements.append((start, end, make_replacement(raw)))
        i += 1

    for start, end, repl in reversed(replacements):
        content = content[:start] + repl + content[end:]
    print(f"Rewrote {len(replacements)} OTHER_LDFLAGS assignment group(s)")

if "force_load" not in content:
    print("ERROR: force_load still missing after patch", file=sys.stderr)
    sys.exit(1)
if re.search(r"-Wl-U_|-Wl -weak-l", content):
    print("ERROR: corrupted -Wl flags still present after rewrite", file=sys.stderr)
    sys.exit(1)

with open(pbx_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("OK: force_load present in pbxproj with healthy -Wl flags")
PY

# Hard fail in CI if the known crash-causing corruption is still present.
if grep -qE -- '-Wl-U_|-Wl -weak-l' "$PBX"; then
  echo "ERROR: corrupted -Wl flags remain in $PBX"
  exit 1
fi
if grep -q -- '_swift_entry_point' "$PBX" && ! grep -q -- '-Wl,-U,_swift_entry_point' "$PBX"; then
  echo "ERROR: _swift_entry_point present without proper -Wl,-U, form"
  exit 1
fi
echo "Firebase force_load injection OK (linker flags verified)"
