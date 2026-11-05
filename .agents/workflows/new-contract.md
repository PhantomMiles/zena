---
description:
---

Write the specification first: purpose, roles, state, events, failure cases, invariants.

Implement with the smallest possible surface area. Use role-based access control and explicit custom errors.

Write unit tests for success and failure paths, plus fuzz or invariant tests for the stated invariants.

Run the full test suite, a gas report and static analysis (for example Slither). Summarise findings.

Export the ABI and TypeScript types to packages/sdk and list every consumer that needs updating.

In the Walkthrough, explain each function in plain language: what it does and why it is designed that way.
