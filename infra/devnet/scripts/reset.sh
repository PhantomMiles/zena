#!/usr/bin/env bash
# Zena Devnet - Reset Chain Data & Genesis
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVNET_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEVNET_DIR"

echo "Resetting Zena Consortium Devnet..."
docker compose down -v --remove-orphans 2>/dev/null || true

if [ -d "data" ]; then
    echo "Removing existing chain data..."
    rm -rf data
fi

echo "Re-generating fresh genesis and validator keys..."
node --experimental-strip-types scripts/generate.ts

echo "Reset complete. Run ./scripts/up.sh to start the fresh network."

