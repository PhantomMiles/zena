# QBFT Consensus & Fault Tolerance in Zena Network

This document details the consensus mechanics and Byzantine Fault Tolerance (BFT) properties of the Zena consortium blockchain.

---

## 1. Consensus Mechanism Overview

Zena runs **QBFT** (Quorum Byzantine Fault Tolerance) consensus on Hyperledger Besu.

QBFT is an EVM-compatible proof-of-authority / consortium consensus protocol with **immediate finality**:

- Blocks cannot be reorganized or orphaned once committed (zero forks).
- No proof-of-work mining or probabilistic confirmations.
- Blocks are proposed in round-robin fashion by designated member validator nodes.
- Configured with a deterministic **2-second block period**.

---

## 2. Mathematical Fault Tolerance ($N=4$)

For a network of $N$ validators, QBFT tolerates up to $F$ Byzantine (arbitrary, offline, malicious, or partition) failures according to:

$$F = \left\lfloor \frac{N - 1}{3} \right\rfloor$$

The minimum quorum of validator agreements $Q$ required to successfully propose, prepare, and commit a block is:

$$Q = 2F + 1$$

### For the Initial 4-Validator Devnet ($N = 4$):

$$F = \left\lfloor \frac{4 - 1}{3} \right\rfloor = \left\lfloor \frac{3}{3} \right\rfloor = 1$$

$$Q = 2(1) + 1 = 3 \text{ validators}$$

- **Total Validators ($N$)**: 4 (`validator1`, `validator2`, `validator3`, `validator4`)
- **Maximum Faulty Nodes Tolerated ($F$)**: 1
- **Quorum Required ($Q$)**: 3

---

## 3. Operational Scenarios & Observed Behavior

| Scenario                                               | Active Validators | Meets Quorum ($Q \ge 3$)? | Chain State                 | Block Production                      |
| ------------------------------------------------------ | ----------------- | ------------------------- | --------------------------- | ------------------------------------- |
| **All Active**                                         | 4 / 4             | Yes ($4 \ge 3$)           | **Normal Operation**        | Block height advances every 2 seconds |
| **1 Node Down** (`validator4` stopped)                 | 3 / 4             | Yes ($3 \ge 3$)           | **Degraded / Resilient**    | **Continues without interruption**    |
| **2 Nodes Down** (`validator3` + `validator4` stopped) | 2 / 4             | No ($2 < 3$)              | **Consensus Halted (Safe)** | **Safely stops block production**     |
| **Recovery** (`validator3` restarted)                  | 3 / 4             | Yes ($3 \ge 3$)           | **Recovered**               | **Resumes immediately**               |

### Why Halting When 2 Nodes Fail is a Feature, Not a Defect

In decentralized logistics and financial settlement:

- **Safety is strictly prioritized over liveness.**
- If 2 out of 4 nodes could commit blocks, a network partition (2 nodes on each side) could allow both sides to produce conflicting blocks, resulting in double-spending, split custody states, and conflicting proof-of-delivery records.
- Because QBFT requires $Q = 3$, neither side can commit blocks in a 2-2 partition. The network halts safely with zero state divergence until quorum is restored.

---

## 4. Verification Commands

To verify this behavior locally:

```bash
# 1. Start all 4 validators + 1 RPC node
pnpm devnet:up

# Check health (blocks incrementing every 2s)
pnpm devnet:health

# 2. Stop 1 validator (fault-tolerant state)
docker compose -f infra/devnet/docker-compose.yml stop validator4

# Check health (blocks continue incrementing!)
pnpm devnet:health

# 3. Stop 2nd validator (quorum lost: 2/4 active)
docker compose -f infra/devnet/docker-compose.yml stop validator3

# Check health (block production safely halted)
pnpm devnet:health

# 4. Restore quorum (restart validator3)
docker compose -f infra/devnet/docker-compose.yml start validator3

# Check health (block production resumes smoothly)
pnpm devnet:health
```
