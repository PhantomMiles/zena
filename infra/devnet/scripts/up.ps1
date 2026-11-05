#!/usr/bin/env pwsh
# Zena Devnet - Start Containers

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DevnetDir = Split-Path -Parent $ScriptDir
Set-Location $DevnetDir

if (!(Test-Path "genesis.json") -or !(Test-Path "keys")) {
    Write-Host "Devnet keys or genesis not found. Generating now..." -ForegroundColor Yellow
    node --experimental-strip-types scripts/generate.ts
}

Write-Host "Starting Zena Consortium Devnet (4 Besu Validators + 1 RPC node)..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Devnet started. Run .\scripts\health.ps1 to verify consensus." -ForegroundColor Green
Write-Host "RPC Gateway: http://localhost:8545" -ForegroundColor White

