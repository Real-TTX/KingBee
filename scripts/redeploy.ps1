#!/usr/bin/env pwsh
<#
.SYNOPSIS
    King Bee runs inside MatGame: rebuilds and starts the local MatGame stack (with King Bee and every other game from the sibling repositories).
.DESCRIPTION
    Needs ../MatGame next to this repository. -Clean is passed on (drops the volumes of the local stack).
    King Bee then answers at http://localhost:2770/kingbee/.
.EXAMPLE
    ./scripts/redeploy.ps1
#>
param([switch]$Clean)

$matgame = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'MatGame/scripts/redeploy.ps1'
if (-not (Test-Path $matgame)) {
    throw "MatGame fehlt: $matgame (das Repository Real-TTX/MatGame neben KingBee auschecken)."
}

if ($Clean) { & $matgame -Clean } else { & $matgame }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'King Bee: http://localhost:2770/kingbee/' -ForegroundColor Green
