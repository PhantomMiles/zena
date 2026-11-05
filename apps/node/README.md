# Zena Node

## What it does

The member node is the software each logistics company runs on its own infrastructure. It:

- Accepts events from the company's TMS / ERP via REST connectors
- Signs and publishes events to the Hyperledger Besu consortium chain
- Keeps private data (rates, documents, PII) in a local PostgreSQL store — never on-chain
- Runs the peer-to-peer sync agent that shares encrypted files with counterparty nodes
- Exposes a REST API consumed by Zena Hub

## Why it is designed this way

Each company owns its data. The node model means no single party controls the network or can observe commercial-in-confidence data. See `docs/blueprint.md` §"System architecture plan" and `docs/ADR/ADR-0001-monorepo.md`.

## Run locally

```bash
# From the repo root
pnpm install
cp apps/node/.env.example apps/node/.env   # fill in values
pnpm --filter @zena/node dev
```

## Test

```bash
pnpm --filter @zena/node test
```
