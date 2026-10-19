# Build the Play Store AAB on Windows.
# Requires android/build/google-services.json and:
#   GODOT_ANDROID_KEYSTORE_RELEASE_PATH
#   GODOT_ANDROID_KEYSTORE_RELEASE_USER
#   GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path "android\build\google-services.json")) {
	Write-Error "Missing android/build/google-services.json"
}

foreach ($name in @(
	"GODOT_ANDROID_KEYSTORE_RELEASE_PATH",
	"GODOT_ANDROID_KEYSTORE_RELEASE_USER",
	"GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD"
)) {
	$value = [Environment]::GetEnvironmentVariable($name)
	if ([string]::IsNullOrWhiteSpace($value)) {
		Write-Error "Missing environment variable $name"
	}
}

$godot = $null
$cmd = Get-Command godot -ErrorAction SilentlyContinue
if ($cmd) {
	$godot = $cmd.Source
} elseif (Test-Path "C:\Users\Ultima\Desktop\Godot_v4.6.3-stable_win64_console.exe") {
	$godot = "C:\Users\Ultima\Desktop\Godot_v4.6.3-stable_win64_console.exe"
} else {
	Write-Error "Godot 4.6.3 was not found on PATH."
}

New-Item -ItemType Directory -Force -Path "build" | Out-Null
& $godot --headless --path . --export-release "Android (Play Store .aab)" "build/StimPad.aab"
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}
Write-Host "Wrote build/StimPad.aab"
