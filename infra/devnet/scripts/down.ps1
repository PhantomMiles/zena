#!/usr/bin/env pwsh
# Zena Devnet - Stop Containers

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DevnetDir = Split-Path -Parent $ScriptDir
Set-Location $DevnetDir

Write-Host "Stopping Zena Consortium Devnet..." -ForegroundColor Yellow
docker compose down
Write-Host "Devnet stopped." -ForegroundColor Green

