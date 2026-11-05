# @zena/sdk

## What it does

The shared TypeScript SDK consumed by every app in the monorepo. It is the **source of truth for domain types and the public interface between packages**.

Planned contents (Phase 1–3):

- Domain types: `Shipment`, `Handover`, `ZenaEvent`, `Member`, `SettlementInstruction`
- Re-exported contract ABIs from `@zena/contracts`
- Chain client helpers for reading and signing events on the Besu consortium chain
- EPCIS 2.0 → Zena event mappers
- Zod validation schemas for all external inputs (webhooks, EDI, telematics) — treat all as untrusted (rule 20)

## Why it is designed this way

A single SDK package means type changes surface immediately at build time across the monorepo. No app can silently diverge from the contract ABI. See engineering rule 10: "Public interfaces are the contract between agents."

## Test

```bash
pnpm --filter @zena/sdk test
```
