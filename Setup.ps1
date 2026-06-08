$ErrorActionPreference = "Continue"
$WorkingDir = $PSScriptRoot
Set-Location $WorkingDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ReportSerialize Pro Setup Guide" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "[1/3] Checking Node.js environment..." -ForegroundColor Yellow
$NodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $NodeCheck) {
    Write-Host "Error: Node.js not found! Please install Node.js (LTS)." -ForegroundColor Red
    pause
    exit
}
Write-Host "Found Node.js: $(node -v)" -ForegroundColor Green

# 2. Install Dependencies
Write-Host "[2/3] Syncing components (Only once)..." -ForegroundColor Yellow
npm install --production --no-audit --no-fund

# 3. Create Desktop Shortcut
Write-Host "[3/3] Creating desktop shortcut..." -ForegroundColor Yellow

# Try to find Edge full path for the icon
$EdgePath = (Get-Command msedge.exe -ErrorAction SilentlyContinue).Source
if ($null -eq $EdgePath) {
    $EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$Shell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "ReportSerialize Pro.lnk")
$Shortcut = $Shell.CreateShortcut($DesktopPath)

# Generate VBS Launcher (using Default encoding to avoid BOM)
$LauncherVBS = Join-Path $WorkingDir "Launch.vbs"
$vbsLines = @(
    'Set WshShell = CreateObject("WScript.Shell")',
    'strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)',
    'WshShell.Run "node """ & strPath & "\server.mjs""", 0, False',
    'WScript.Sleep 2000',
    'WshShell.Run "msedge.exe --app=http://localhost:3005 --start-fullscreen"'
)
# Use -Encoding default (ANSI/GBK) so VBScript can read it without BOM errors
$vbsLines | Out-File -FilePath $LauncherVBS -Encoding default

$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$LauncherVBS"""
$Shortcut.WorkingDirectory = $WorkingDir
if (Test-Path $EdgePath) {
    $Shortcut.IconLocation = "$EdgePath, 0"
}
$Shortcut.Description = "Deep Report Serializer Pro"
$Shortcut.Save()

Write-Host ""
Write-Host "--- Setup Complete! ---" -ForegroundColor Green
Write-Host "You can now launch 'ReportSerialize Pro' from your desktop." -ForegroundColor White
Write-Host "Press any key to exit..."
pause