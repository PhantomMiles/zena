#!/usr/bin/env pwsh
# Zena Devnet - Health Check

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DevnetDir = Split-Path -Parent $ScriptDir
Set-Location $DevnetDir

node --experimental-strip-types scripts/health.ts

