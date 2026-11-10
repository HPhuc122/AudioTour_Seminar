param([string]$HostAddress = '127.0.0.1')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'services\narration-service\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Create services/narration-service/.venv and install its requirements.txt first. See docs/guides/demo-narration-adapter.md.'
}
# serve.py reads the root .env. Run in this terminal; Ctrl+C stops the service.
& $pythonPath (Join-Path $PSScriptRoot 'serve.py') narration --host $HostAddress
