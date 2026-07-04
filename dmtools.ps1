# DM Toolkit CLI
# Usage: dmtools <start|stop|restart>

param(
    [string]$Command,
    [switch]$Minor,   # vtt-release: bump x.Y.0 instead of x.y.Z
    [switch]$Major    # vtt-release: bump X.0.0
)

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

function Invoke-VttBuild {
    $VttDir = Join-Path $RootDir "vtt"

    Write-Host ""
    Write-Host "  DM Toolkit - VTT Build" -ForegroundColor Cyan
    Write-Host "  -----------------------------------" -ForegroundColor DarkGray
    Write-Step "Building VTT (this may take several minutes)..." "Yellow"
    Write-Host ""

    $origDir = Get-Location
    try {
        Set-Location $VttDir
        & pnpm tauri build
        $exitCode = $LASTEXITCODE
    } finally {
        Set-Location $origDir
    }

    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "  VTT build complete." -ForegroundColor Green
        Write-Host "  Installer: vtt\src-tauri\target\release\bundle\" -ForegroundColor DarkGray
    } else {
        Write-Step "Build failed (exit code $exitCode)." "Red"
    }
    Write-Host ""
}

function Invoke-VttRelease {
    param([switch]$Minor, [switch]$Major)

    $branch = git -C $RootDir rev-parse --abbrev-ref HEAD 2>&1
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        Write-Step "Must be on main branch (currently '$branch')." "Red"; return
    }

    $dirty = git -C $RootDir status --porcelain 2>&1
    if ($dirty) {
        Write-Step "Uncommitted changes detected. Commit or stash first." "Red"; return
    }

    Write-Step "Pulling latest main..." "Yellow"
    git -C $RootDir pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { Write-Step "Pull failed." "Red"; return }

    $tauriConf = Join-Path $RootDir "vtt\src-tauri\tauri.conf.json"
    $confText  = Get-Content $tauriConf -Raw
    $verMatch  = [regex]::Match($confText, '"version":\s*"(\d+)\.(\d+)\.(\d+)"')
    if (-not $verMatch.Success) {
        Write-Step "Could not parse version from tauri.conf.json" "Red"; return
    }

    [int]$vMaj = $verMatch.Groups[1].Value
    [int]$vMin = $verMatch.Groups[2].Value
    [int]$vPat = $verMatch.Groups[3].Value
    $oldVer = "$vMaj.$vMin.$vPat"

    if     ($Major) { $vMaj++; $vMin = 0; $vPat = 0 }
    elseif ($Minor) {          $vMin++;   $vPat = 0 }
    else            {                     $vPat++   }
    $newVer = "$vMaj.$vMin.$vPat"
    $tag    = "v$newVer"

    Write-Host ""
    Write-Host "  $oldVer  ->  $newVer" -ForegroundColor Cyan
    Write-Host ""

    Write-Step "Updating tauri.conf.json..." "Yellow"
    $newConfText = $confText.Replace(
        '"version": "' + $oldVer + '"',
        '"version": "' + $newVer + '"'
    )
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tauriConf, $newConfText, $utf8)

    Write-Step "Updating Cargo.toml..." "Yellow"
    $cargoPath    = Join-Path $RootDir "vtt\src-tauri\Cargo.toml"
    $cargoText    = Get-Content $cargoPath -Raw
    $newCargoText = $cargoText.Replace(
        'version = "' + $oldVer + '"',
        'version = "' + $newVer + '"'
    )
    [System.IO.File]::WriteAllText($cargoPath, $newCargoText, $utf8)

    Write-Step "Committing..." "Yellow"
    git -C $RootDir add "vtt/src-tauri/tauri.conf.json" "vtt/src-tauri/Cargo.toml"
    git -C $RootDir commit -m "chore: release $tag"

    Write-Step "Pushing main..." "Yellow"
    git -C $RootDir push origin main
    if ($LASTEXITCODE -ne 0) { Write-Step "Push failed." "Red"; return }

    Write-Step "Tagging and pushing $tag..." "Yellow"
    git -C $RootDir tag $tag
    git -C $RootDir push origin $tag

    Write-Host ""
    Write-Host "  Released $tag - GitHub Actions build started." -ForegroundColor Green
    Write-Host "  https://github.com/sven-johnson/DM-Toolkit/actions" -ForegroundColor DarkGray
    Write-Host ""
}

switch ($Command.ToLower()) {
    "start"       { Start-Services }
    "stop"        { Stop-Services }
    "restart"     { Stop-Services; Start-Sleep -Seconds 2; Start-Services }
    "vtt-build"   { Invoke-VttBuild }
    "vtt-release" { Invoke-VttRelease -Minor:$Minor -Major:$Major }
    default {
        Write-Host ""
        Write-Host "  DM Toolkit CLI" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Usage:  dmtools <command>" -ForegroundColor White
        Write-Host ""
        Write-Host "  Commands:" -ForegroundColor White
        Write-Host "    start          Start MySQL, backend, and frontend" -ForegroundColor Gray
        Write-Host "    stop           Stop all services and shut down MySQL" -ForegroundColor Gray
        Write-Host "    restart        Stop then start all services" -ForegroundColor Gray
        Write-Host "    vtt-build      Build the VTT app locally" -ForegroundColor Gray
        Write-Host "    vtt-release    Bump patch version and push release tag" -ForegroundColor Gray
        Write-Host "    vtt-release -Minor    Bump minor version (x.Y.0)" -ForegroundColor DarkGray
        Write-Host "    vtt-release -Major    Bump major version (X.0.0)" -ForegroundColor DarkGray
        Write-Host ""
    }
}
