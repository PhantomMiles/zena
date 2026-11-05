---
trigger: always_on
---

Engineering standards

- TypeScript in strict mode everywhere. pnpm workspaces with Turborepo. Node LTS.
- Every task starts with an Implementation Plan. Do not write code before the plan is approved.
- Every change ships with tests. Contracts need unit tests plus fuzz or invariant tests. Services need unit and integration tests. UI needs component tests and one browser check.
- Explain what you build: add a short README or doc comment per module saying what it does and why it is designed that way. In the Walkthrough, explain any non-obvious code.
- Small, reviewable commits using Conventional Commits. One task, one branch.
- No new dependency without a one-line justification in the plan. Prefer well-maintained libraries.
- Public interfaces (contract ABIs, SDK types, REST OpenAPI) are the contract between agents. Never change one without listing every affected package in the plan.
- Prefer boring, readable code over clever code. No dead code, no TODOs without an issue note.
