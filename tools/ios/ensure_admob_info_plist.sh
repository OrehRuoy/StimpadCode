#!/usr/bin/env bash
# Ensure AdMob / ATT keys exist in the Godot-exported iOS Info.plist.
# Headless export sometimes skips EditorExportPlugin plist injection.
# Compatible with macOS bash 3.2 (no mapfile).
set -euo pipefail
ROOT="${1:-build}"
APP_ID="${2:-ca-app-pub-5356882403986713~1231581339}"
ATT_TEXT="${3:-StimPad uses this to show more relevant ads on the free tier. You can change this anytime in Settings.}"

FOUND=0
# Use newline find (paths have no spaces) — avoid mapfile / process substitution quirks.
while IFS= read -r PLIST; do
  [ -z "$PLIST" ] && continue
  FOUND=1
  echo "Checking AdMob keys in $PLIST"
  if ! /usr/libexec/PlistBuddy -c "Print :GADApplicationIdentifier" "$PLIST" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Add :GADApplicationIdentifier string ${APP_ID}" "$PLIST"
    echo "Added GADApplicationIdentifier"
  else
    echo "GADApplicationIdentifier already present"
  fi
  if ! /usr/libexec/PlistBuddy -c "Print :NSUserTrackingUsageDescription" "$PLIST" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Add :NSUserTrackingUsageDescription string ${ATT_TEXT}" "$PLIST"
    echo "Added NSUserTrackingUsageDescription"
  else
    echo "NSUserTrackingUsageDescription already present"
  fi
done <<EOF
$(find "$ROOT" -type f \( -name 'Info.plist' -o -name '*-Info.plist' \) ! -path '*/Pods/*' ! -path '*/frameworks/*' ! -path '*/*.xcframework/*' 2>/dev/null || true)
EOF

if [[ "$FOUND" -eq 0 ]]; then
  echo "WARNING: no Info.plist found under $ROOT to patch for AdMob"
fi
