#!/usr/bin/env bash
# Zena Devnet - Health Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVNET_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEVNET_DIR"

node --experimental-strip-types scripts/health.ts

