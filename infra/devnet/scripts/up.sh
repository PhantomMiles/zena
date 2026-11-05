#!/usr/bin/env bash
# Zena Devnet - Start Containers
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVNET_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEVNET_DIR"

if [ ! -f "genesis.json" ] || [ ! -d "keys" ]; then
    echo "Devnet keys or genesis not found. Generating now..."
    node --experimental-strip-types scripts/generate.ts
fi

echo "Starting Zena Consortium Devnet (4 Besu Validators + 1 RPC node)..."
docker compose up -d

echo "Devnet started. Run ./scripts/health.sh to verify consensus."
echo "RPC Gateway: http://localhost:8545"

