#!/usr/bin/env pwsh
# Zena Devnet - Print Active RPC Endpoints

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "              ZENA DEVNET RPC ENDPOINTS                   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Chain ID:          1337" -ForegroundColor White
Write-Host "Consensus:         QBFT (2-second block period)" -ForegroundColor White
Write-Host ""
Write-Host "Service Gateway (Read-Only RPC Node):" -ForegroundColor Green
Write-Host "  HTTP JSON-RPC:   http://localhost:8545" -ForegroundColor White
Write-Host "  WebSocket RPC:   ws://localhost:8546" -ForegroundColor White
Write-Host ""
Write-Host "Validator Voting Endpoints (qbft_proposeValidatorVote):" -ForegroundColor Yellow
Write-Host "  Validator 1:     http://localhost:8541" -ForegroundColor Gray
Write-Host "  Validator 2:     http://localhost:8542" -ForegroundColor Gray
Write-Host "  Validator 3:     http://localhost:8543" -ForegroundColor Gray
Write-Host "  Validator 4:     http://localhost:8544" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

