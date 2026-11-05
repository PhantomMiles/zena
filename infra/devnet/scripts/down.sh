#!/usr/bin/env bash
# Zena Devnet - Stop Containers
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVNET_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEVNET_DIR"

echo "Stopping Zena Consortium Devnet..."
docker compose down
echo "Devnet stopped."

