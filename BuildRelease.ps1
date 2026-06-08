$WorkingDir = $PSScriptRoot
Set-Location $WorkingDir
Write-Host "Build starting..."
npm run build
Write-Host "Copying files..."
$ReleaseDir = Join-Path $WorkingDir "Release_Package"
if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $ReleaseDir
Copy-Item "dist" $ReleaseDir -Recurse
Copy-Item "server.mjs" $ReleaseDir
Copy-Item "package.json" $ReleaseDir
Copy-Item "Setup.ps1" $ReleaseDir
Write-Host "Archiving..."
$ZipFile = Join-Path $WorkingDir "ReportSerialize_Pro_Portable.zip"
if (Test-Path $ZipFile) { Remove-Item $ZipFile }
Compress-Archive -Path "$ReleaseDir\*" -DestinationPath $ZipFile
Write-Host "Done: $ZipFile"