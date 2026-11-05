#!/usr/bin/env pwsh
# Zena Devnet - Reset Chain Data & Genesis

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DevnetDir = Split-Path -Parent $ScriptDir
Set-Location $DevnetDir

Write-Host "Resetting Zena Consortium Devnet..." -ForegroundColor Yellow
docker compose down -v --remove-orphans 2>$null

if (Test-Path "data") {
    Write-Host "Removing existing chain data..." -ForegroundColor Yellow
    Remove-Item -Path "data" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Re-generating fresh genesis and validator keys..." -ForegroundColor Cyan
node --experimental-strip-types scripts/generate.ts

Write-Host "Reset complete. Run .\scripts\up.ps1 to start the fresh network." -ForegroundColor Green

