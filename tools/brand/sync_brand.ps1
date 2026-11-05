<#
.SYNOPSIS
  Sync UMS+ brand assets (ums-brand/) into ums-logbook and satellite apps.
  IMPORTANT SAFETY RULE:
  - Copies ONLY into `public/brand/` (and `BrandMark.tsx`).
  - NEVER overwrites or modifies the official UMS school logo (`public/logo.jpg`, `public/logo.png`, `public/logoums*`).
#>
param(
  [switch]$IncludeSatellites = $false
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BrandDir = Join-Path $RepoRoot "ums-brand"
$SourceLogos = Join-Path $BrandDir "logos"
$SourceTokens = Join-Path $BrandDir "tokens.css"
$SourcePreset = Join-Path $BrandDir "tailwind.preset.js"
$SourceBrandMark = Join-Path $BrandDir "BrandMark.tsx"

function Sync-AppBrand {
  param(
    [string]$AppName,
    [string]$PublicDir,
    [string]$BrandMarkDest = ""
  )

  if (-not (Test-Path -LiteralPath $PublicDir)) {
    Write-Host "[SKIP] $AppName : Not found at $PublicDir" -ForegroundColor Yellow
    return
  }

  $DestBrandDir = Join-Path $PublicDir "brand"
  $DestLogosDir = Join-Path $DestBrandDir "logos"
  New-Item -ItemType Directory -Force -Path $DestLogosDir | Out-Null

  Copy-Item -Path (Join-Path $SourceLogos "*") -Destination $DestLogosDir -Recurse -Force
  Copy-Item -LiteralPath $SourceTokens -Destination (Join-Path $DestBrandDir "tokens.css") -Force
  Copy-Item -LiteralPath $SourcePreset -Destination (Join-Path $DestBrandDir "tailwind.preset.js") -Force

  if ($BrandMarkDest -ne "" -and (Test-Path -LiteralPath (Split-Path -Parent $BrandMarkDest))) {
    Copy-Item -LiteralPath $SourceBrandMark -Destination $BrandMarkDest -Force
  }

  Write-Host "[OK] Synced UMS+ brand kit into $DestBrandDir (official UMS school logo preserved)" -ForegroundColor Green
}

# 1. Sync into ums-logbook (UMS SmartConnect)
$LogbookPublic = Join-Path $RepoRoot "ums-logbook\public"
$LogbookBrandMark = Join-Path $RepoRoot "ums-logbook\src\components\common\BrandMark.tsx"
Sync-AppBrand -AppName "ums-logbook" -PublicDir $LogbookPublic -BrandMarkDest $LogbookBrandMark

# 2. Optional sync into satellite apps if -IncludeSatellites is passed
if ($IncludeSatellites) {
  $DesktopDir = Split-Path -Parent $RepoRoot
  $PracticePublic = Join-Path $DesktopDir "2627_ENG 9_August Test (2026)\practice-client\public"
  $StudentMgmtPublic = Join-Path $DesktopDir "2627_ENG 9_August Test (2026)\student-management\client\public"
  $GradingPublic = "C:\Users\Lenovo\Documents\antigravity\wonderful-shannon\frontend\public"

  Sync-AppBrand -AppName "umseng9practice" -PublicDir $PracticePublic
  Sync-AppBrand -AppName "umseng9hub-homeroom9" -PublicDir $StudentMgmtPublic
  Sync-AppBrand -AppName "umseng9grading" -PublicDir $GradingPublic
}
