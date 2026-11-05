# Zena Settle

## What it does

The payments service that closes the settlement loop. It:

- Subscribes to proof-of-delivery events on the consortium chain
- Verifies contract terms are met (both signatures, cargo condition)
- Issues payout instructions to licensed payment partners (Paystack, Flutterwave, bank rails) using idempotency keys
- Records every instruction in an append-only PostgreSQL ledger
- Freezes only the disputed portion in a dispute

## Why it is designed this way

Payments are the highest-risk surface. The service uses sandbox credentials only, never touches mainnet, and uses an idempotency key on every outgoing instruction. The append-only ledger gives auditors a full history. See security rule 20.

## Run locally

```bash
cp apps/settle/.env.example apps/settle/.env
pnpm --filter @zena/settle dev
```

## Test

```bash
pnpm --filter @zena/settle test
```
