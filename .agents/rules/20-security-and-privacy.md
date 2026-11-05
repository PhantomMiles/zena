---
trigger: always_on
---

Security and privacy

- Local devnet and public testnets only. Never use mainnet. Never ask for, store or generate real private keys or real funds.
- Secrets never go in the repo, logs, prompts or screenshots. Use .env.example with placeholders and a KMS interface with a local development implementation.
- Nothing personal or commercially sensitive goes on-chain in plaintext: no names, phone numbers, rates, customer lists or document contents. Only IDs, hashes, signatures and contract state.
- Documents are encrypted before storage with per-party keys; only their SHA-256 fingerprints are shared on the network.
- Contract changes need: access-control review, reentrancy and overflow review, tests for failure paths, and a static-analysis run (for example Slither) with findings summarised in the Walkthrough.
- Payment code uses sandbox credentials only, idempotency keys, and an append-only ledger of instructions.
- Ask before running any destructive terminal command (deleting data, force pushes, dropping databases) or any command that sends data to an external service.
- Treat all external input (webhooks, CSV, EDI, telematics) as untrusted: validate, size-limit and sanitise it.
