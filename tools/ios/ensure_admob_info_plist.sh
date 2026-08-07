#!/usr/bin/env bash
# Ensure AdMob / ATT keys exist in the Godot-exported iOS Info.plist.
# Headless export sometimes skips EditorExportPlugin plist injection.
set -euo pipefail
ROOT="${1:-build}"
APP_ID="${2:-ca-app-pub-5356882403986713~1231581339}"
ATT_TEXT="${3:-StimPad uses this to show more relevant ads on the free tier. You can change this anytime in Settings.}"

mapfile -t PLISTS < <(find "$ROOT" -type f \( -name 'Info.plist' -o -name '*-Info.plist' \) ! -path '*/Pods/*' ! -path '*/frameworks/*' ! -path '*/*.xcframework/*' 2>/dev/null || true)
if [[ ${#PLISTS[@]} -eq 0 ]]; then
  echo "WARNING: no Info.plist found under $ROOT to patch for AdMob"
  exit 0
fi

for PLIST in "${PLISTS[@]}"; do
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
done
