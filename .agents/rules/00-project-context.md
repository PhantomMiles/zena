---
trigger: always_on
---

Zena project context

Zena is a decentralised, blockchain-structured logistics network owned and run by logistics companies (carriers, freight forwarders, 3PLs, warehouses, ports). Tagline: One record. Every carrier.

Source of truth: docs/blueprint.md (architecture, personas, flows) and docs/design-tokens.json. Read them before planning any task. If the code and the blueprint disagree, stop and ask.

Architecture in brief:

- Each company runs a member node that keeps private data and signs events.
- A permissioned consortium chain (Hyperledger Besu, QBFT consensus, EVM) holds shared events, dual-signed handovers, settlement logic and governance.
- A public L2 testnet anchors Merkle roots of event batches for audit.
- Files and commercial data stay off-chain, encrypted, shared peer to peer between the parties involved.

Monorepo layout:

- apps/node (member node API and sync agent), apps/hub (Next.js web), apps/field (Expo driver and yard app), apps/settle (payments service)
- packages/contracts, packages/sdk, packages/ui, packages/connectors
- infra/devnet, infra/docker, docs/

Glossary: shipment, handover (dual-signed), event (EPCIS 2.0 style), member (company with a KYB credential), validator (member running consensus), settlement instruction.
