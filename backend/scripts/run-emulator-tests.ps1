# Runs the backend test suite against the Firestore emulator (in addition to the
# in-memory repository). Requires JDK 21+ and Node. Run from anywhere:
#   powershell -File backend\scripts\run-emulator-tests.ps1 [pytest args]
$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $backend

$venvScripts = Join-Path $backend ".venv\Scripts"
if (Test-Path $venvScripts) { $env:PATH = "$venvScripts;$env:PATH" }

$pytestArgs = if ($args.Count -gt 0) { $args -join " " } else { "-q" }

# Pinned so local runs and CI use the same emulator version. The project ID must
# start with "demo-" so no real Firebase project can ever be touched.
npx --yes firebase-tools@15.34.2 emulators:exec `
  --config ../frontend/firebase.json `
  --only auth,firestore `
  --project demo-attune-tests `
  "python -m pytest $pytestArgs"
exit $LASTEXITCODE
