# ADR-0001 — Monorepo with pnpm workspaces and Turborepo

| Field        | Value                     |
| ------------ | ------------------------- |
| **Status**   | Accepted                  |
| **Date**     | 2026-11-05                |
| **Author**   | @Ifunanyachukwu           |
| **Deciders** | Node agent + project lead |

---

## Context

Zena ships multiple interdependent artefacts:

- **Four apps**: `node` (member node API), `hub` (web), `field` (mobile), `settle` (payments)
- **Four packages**: `contracts` (Solidity ABIs + TS types), `sdk` (shared types), `ui` (component library), `connectors` (TMS/ERP adapters)

These packages share TypeScript types, ESLint config, test runner config, and design tokens. They must be versioned and tested together so that an ABI change in `contracts` is immediately visible as a type error in `sdk`, `node`, and `hub`.

We needed a repository strategy before writing any application code.

---

## Decision

Use a **single pnpm workspace monorepo** with **Turborepo** as the task runner.

### Why pnpm workspaces

- Symlinks workspace packages without duplicating `node_modules`
- `workspace:*` protocol for internal dependencies gives exact version pinning within the repo
- `--frozen-lockfile` in CI prevents lockfile drift
- Significantly faster installs than npm or Yarn v1 for large dependency graphs

### Why Turborepo

- Incremental, parallel task execution: only rebuilds packages whose inputs changed
- Remote cache support (opt-in via `TURBO_TOKEN` CI secret) — saves CI minutes as the repo grows
- Pipeline declaratively expresses the `build → test → lint` dependency graph so tasks never run in the wrong order
- `turbo.json` is the single place to add a new task; all packages inherit it automatically

### Why not alternatives

| Alternative     | Reason rejected                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- |
| Nx              | Heavier config; team preference for simpler `turbo.json`                                     |
| Lerna           | Largely superseded by pnpm workspaces + Turborepo                                            |
| Multiple repos  | Cross-package type safety would be lost; ABI changes could silently break consuming packages |
| Yarn workspaces | pnpm is faster and has better `workspace:` protocol semantics                                |

---

## Consequences

- **Good**: single `pnpm install` from root boots the full dev environment; `pnpm lint / typecheck / test` run across all packages in one command
- **Good**: ABI or SDK type changes surface immediately as build errors in every consuming package
- **Good**: Turborepo's cache means CI stays fast as the monorepo grows
- **Neutral**: developers need pnpm ≥ 9 and Node ≥ 22 (documented in root README and CI)
- **Watch**: Expo (React Native) may require special `metro.config.js` handling for monorepo symlinks — addressed when `apps/field` is bootstrapped in Phase 1

---

## Related

- `pnpm-workspace.yaml` — workspace glob declarations
- `turbo.json` — Turborepo pipeline definition
- `tsconfig.base.json` — shared strict TypeScript config
- `docs/blueprint.md` §"Recommended stack" — technology choices for all layers
