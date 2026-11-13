# Zena Network

> **One record. Every carrier.**

Zena is a decentralised, blockchain-structured logistics network owned and run by logistics companies — carriers, freight forwarders, 3PLs, warehouses, and ports. Each company runs a member node. Shared events and handovers are recorded on a permissioned consortium chain (Hyperledger Besu). A public L2 anchors state for neutral audit.

See [`docs/blueprint.md`](docs/blueprint.md) for the full architecture and [`docs/ADR/ADR-0001-monorepo.md`](docs/ADR/ADR-0001-monorepo.md) for the monorepo decision.

---

## Prerequisites

| Tool    | Minimum version |
| ------- | --------------- |
| Node.js | 22 LTS          |
| pnpm    | 9               |
| Git     | 2.40            |

Install pnpm: `npm install -g pnpm@9`

---

## Quick start

```bash
# 1. Clone
git clone <repo-url>
cd zena

# 2. Install all workspace dependencies
pnpm install

# 3. Copy environment templates (fill in values before running any service)
cp .env.example .env
cp apps/node/.env.example apps/node/.env
cp apps/hub/.env.example  apps/hub/.env
cp apps/field/.env.example apps/field/.env
cp apps/settle/.env.example apps/settle/.env

# 4. Build all packages
pnpm build

# 5. Run all checks
pnpm lint
pnpm typecheck
pnpm test
```

---

## Monorepo structure

```
zena/
├── apps/
│   ├── node/        @zena/node     — member node API + sync agent
│   ├── hub/         @zena/hub      — Next.js web app (Zena Hub)
│   ├── field/       @zena/field    — Expo mobile app (drivers + yards)
│   └── settle/      @zena/settle   — payments service (Zena Settle)
├── packages/
│   ├── contracts/   @zena/contracts — Solidity ABIs + TypeScript types
│   ├── sdk/         @zena/sdk       — shared domain types + chain clients
│   ├── ui/          @zena/ui        — React component library
│   └── connectors/  @zena/connectors — TMS / ERP / telematics adapters
├── infra/
│   ├── devnet/      — Hyperledger Besu local devnet (Phase 1)
│   └── docker/      — Docker Compose for member node deploy kit (Phase 1)
├── docs/
│   ├── blueprint.md        — full architecture and product spec
│   ├── design-token.json  — colour, typography, spacing tokens
│   └── ADR/                — Architecture Decision Records
└── .github/workflows/ci.yml
```

---

## Common tasks

| Command                        | What it does                                  |
| ------------------------------ | --------------------------------------------- |
| `pnpm install`                 | Install all dependencies across the workspace |
| `pnpm build`                   | Build all packages (via Turborepo)            |
| `pnpm lint`                    | ESLint across all TypeScript source files     |
| `pnpm typecheck`               | `tsc --noEmit` across all packages            |
| `pnpm test`                    | Vitest across all packages                    |
| `pnpm format`                  | Prettier format all source files              |
| `pnpm --filter @zena/node dev` | Start member node in watch mode               |

---

## Security notes

- **Never commit real private keys, payment credentials, or personal data.** `.env.example` files contain placeholders only.
- Nothing personally identifiable or commercially sensitive goes on-chain in plaintext. Only IDs, hashes, and signatures.
- Payment code uses sandbox credentials only. See `apps/settle/.env.example`.
- Smart contracts require an independent audit before any real payment flows.

---

## Contributing

1. Create a branch: `git checkout -b feat/your-feature`
2. Write code and tests (rule 10: every change ships with tests)
3. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing
4. Open a pull request against `main` with a [Conventional Commits](https://www.conventionalcommits.org/) title

The pre-commit hook runs lint-staged automatically. If it blocks your commit, fix the reported issues first.

---

## Build phases

| Phase | Timeline    | Focus                                                                        |
| ----- | ----------- | ---------------------------------------------------------------------------- |
| 0     | Weeks 1–4   | Recruit founding members, governance charter, legal                          |
| 1     | Months 1–4  | Testnet, node software, event registry, driver app, EPCIS mapping            |
| 2     | Months 5–8  | Dual-signed handovers, POD, document attestation, dashboards, TMS connectors |
| 3     | Months 9–12 | Settlement contracts, payment partner, public anchoring, corridor go-live    |
| 4     | Month 13+   | Open membership, validator onboarding, capacity marketplace                  |
