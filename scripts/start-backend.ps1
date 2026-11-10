param([switch]$Restart, [switch]$NoReload)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.tooling\python\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    $pythonPath = Join-Path $projectRoot 'services\narration-service\.venv\Scripts\python.exe'
}
$servePath = Join-Path $PSScriptRoot 'serve.py'
$logDirectory = Join-Path $projectRoot '.runtime'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Local Python is missing. Install backend dependencies or run scripts/serve.py with your configured Python.'
}
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Test-ServiceHealth([int]$servicePort) {
    try {
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:$servicePort/health" -TimeoutSec 2
        return $result.status -eq 'ok'
    } catch { return $false }
}

foreach ($service in @(
    @{ Name = 'auth'; Port = 8001 },
    @{ Name = 'narration'; Port = 8003 },
    @{ Name = 'content'; Port = 8002 },
    @{ Name = 'gateway'; Port = 8000 }
)) {
    if ($Restart) {
        # Restart only Python services launched from this workspace's serve.py.
        $servicePattern = '["\s]' + [regex]::Escape($service.Name) + '(?:\s|$)'
        $ownedProcesses = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object {
            $_.ExecutablePath -eq $pythonPath -and $_.CommandLine -and
            $_.CommandLine.Contains($servePath) -and $_.CommandLine -match $servicePattern
        }
        foreach ($ownedProcess in $ownedProcesses) {
            # Include the reload worker, which owns the listening socket.
            & taskkill.exe /PID $ownedProcess.ProcessId /T /F | Out-Null
            Wait-Process -Id $ownedProcess.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
        }
    }
    if (Test-ServiceHealth $service.Port) {
        Write-Output "$($service.Name): already available on $($service.Port)"
        continue
    }
    $serviceArguments = @("`"$servePath`"", $service.Name)
    if (-not $NoReload) { $serviceArguments += '--reload' }
    $process = Start-Process -FilePath $pythonPath -ArgumentList $serviceArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "$($service.Name).stdout.log") -RedirectStandardError (Join-Path $logDirectory "$($service.Name).stderr.log")
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ($process.HasExited) { break }
        if (Test-ServiceHealth $service.Port) { $ready = $true; break }
        Start-Sleep -Milliseconds 300
    }
    if (-not $ready) { throw "$($service.Name) failed to start. See .runtime/$($service.Name).stderr.log." }
    Write-Output "$($service.Name): ready on $($service.Port), PID $($process.Id)"
}
Write-Output 'Backend is ready. Web: http://localhost:5173'
if (-not $NoReload) { Write-Output 'Python auto-reload is enabled for newly started services. Use -Restart to replace already running services.' }
