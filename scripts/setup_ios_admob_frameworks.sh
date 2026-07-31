#!/usr/bin/env bash
# Verify AdMob iOS frameworks are present before export (CI + local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/ios/plugins/AdmobPlugin.gdip"
test -d "$ROOT/ios/plugins/AdmobPlugin.release.xcframework"
test -d "$ROOT/ios/framework/GoogleMobileAds.xcframework"
test -d "$ROOT/ios/framework/UserMessagingPlatform.xcframework"
echo "AdMob iOS frameworks OK"
