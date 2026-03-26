# DM Toolkit CLI
# Usage: dmtools <start|stop|restart>

param([string]$Command)

$RootDir   = $PSScriptRoot
$StateFile = Join-Path $RootDir ".dmtools_state.json"
$Compose   = Join-Path $RootDir "docker-compose.yml"

function Write-Step([string]$msg, [string]$color = "White") {
    Write-Host "  $msg" -ForegroundColor $color
}

function Wait-ForMySQL {
    Write-Step "Waiting for MySQL to be healthy..." "Yellow"
    for ($i = 0; $i -lt 30; $i++) {
        $status = (docker inspect --format="{{.State.Health.Status}}" dm_toolkit_db 2>$null)
        if ($status -and $status.Trim() -eq "healthy") { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Kill-Tree([int]$ProcessId) {
    if ($ProcessId -eq 0) { return }
    & taskkill /F /T /PID $ProcessId 2>&1 | Out-Null
}

function Start-Services {
    Write-Host ""
    Write-Host "  DM Toolkit - Starting" -ForegroundColor Cyan
    Write-Host "  -----------------------------------" -ForegroundColor DarkGray

    Write-Step "Starting MySQL (Docker Compose)..." "Yellow"
    docker compose -f $Compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Docker Compose failed. Is Docker Desktop running?" "Red"
        return
    }

    if (-not (Wait-ForMySQL)) {
        Write-Step "MySQL did not become healthy. Check Docker Desktop." "Red"
        return
    }
    Write-Step "MySQL is ready." "Green"

    Write-Step "Starting backend (new window)..." "Yellow"
    $backendCmd = "Set-Location '$RootDir\backend'; " +
                  "Write-Host 'Backend starting on http://localhost:8000' -ForegroundColor Cyan; " +
                  "& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    $backend = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", $backendCmd `
        -PassThru -WindowStyle Normal

    Start-Sleep -Seconds 2

    Write-Step "Starting frontend (new window)..." "Yellow"
    $frontendCmd = "Set-Location '$RootDir\frontend'; " +
                   "Write-Host 'Frontend starting on http://localhost:5173' -ForegroundColor Cyan; " +
                   "npm run dev"
    $frontend = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", $frontendCmd `
        -PassThru -WindowStyle Normal

    @{ backend = $backend.Id; frontend = $frontend.Id } |
        ConvertTo-Json | Set-Content $StateFile

    Write-Host ""
    Write-Host "  DM Toolkit is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "    Frontend : http://localhost:5173" -ForegroundColor Cyan
    Write-Host "    Backend  : http://localhost:8000" -ForegroundColor Cyan
    Write-Host "    API docs : http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    Login    : admin / changeme  (set in backend\.env)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Run 'dmtools stop' to shut everything down." -ForegroundColor DarkGray
    Write-Host ""
}

function Stop-Services {
    Write-Host ""
    Write-Host "  DM Toolkit - Stopping" -ForegroundColor Cyan
    Write-Host "  -----------------------------------" -ForegroundColor DarkGray

    if (Test-Path $StateFile) {
        $state = Get-Content $StateFile | ConvertFrom-Json
        if ($state.backend)  { Write-Step "Stopping backend...";  Kill-Tree $state.backend }
        if ($state.frontend) { Write-Step "Stopping frontend..."; Kill-Tree $state.frontend }
        Remove-Item $StateFile -Force
    } else {
        Write-Step "No state file found. Stopping any running uvicorn/node processes." "Yellow"
    }

    Write-Step "Stopping MySQL..." "Yellow"
    docker compose -f $Compose down

    Write-Host ""
    Write-Host "  DM Toolkit stopped." -ForegroundColor Green
    Write-Host ""
}

switch ($Command.ToLower()) {
    "start"   { Start-Services }
    "stop"    { Stop-Services }
    "restart" { Stop-Services; Start-Sleep -Seconds 2; Start-Services }
    default {
        Write-Host ""
        Write-Host "  DM Toolkit CLI" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Usage:  dmtools <command>" -ForegroundColor White
        Write-Host ""
        Write-Host "  Commands:" -ForegroundColor White
        Write-Host "    start    Start MySQL, backend, and frontend" -ForegroundColor Gray
        Write-Host "    stop     Stop all services and shut down MySQL" -ForegroundColor Gray
        Write-Host "    restart  Stop then start all services" -ForegroundColor Gray
        Write-Host ""
    }
}
