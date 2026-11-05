# Zena Consortium Devnet (Hyperledger Besu QBFT)

Local permissioned consortium blockchain testbed for Zena Network.

---

## Architecture

- **Consensus**: QBFT (Quorum Byzantine Fault Tolerance)
- **Block Time**: 2 seconds deterministic
- **Chain ID**: `1337`
- **Topology**:
  - 4 Validator nodes (`validator1` .. `validator4`)
  - 1 Dedicated read-only RPC gateway node (`rpc-node`)
  - Internal private bridge network (`zena-devnet-network`)

---

## RPC Gateways & Endpoints

| Node            | Purpose                                               | HTTP Port               | WebSocket Port        |
| --------------- | ----------------------------------------------------- | ----------------------- | --------------------- |
| **RPC Gateway** | App services (`apps/node`, `apps/hub`, `apps/settle`) | `http://localhost:8545` | `ws://localhost:8546` |
| **Validator 1** | Internal validator voting                             | `http://localhost:8541` | N/A                   |
| **Validator 2** | Internal validator voting                             | `http://localhost:8542` | N/A                   |
| **Validator 3** | Internal validator voting                             | `http://localhost:8543` | N/A                   |
| **Validator 4** | Internal validator voting                             | `http://localhost:8544` | N/A                   |

---

## Funded Developer Accounts (10,000 ZENA each)

These accounts are pre-funded in `genesis.json` for local development only:

| Account             | Address                                      |
| ------------------- | -------------------------------------------- |
| **Developer 1**     | `0xB006b76DA7342E10F9c2e4760f638Eb0B6430d2c` |
| **Developer 2**     | `0xC4fae17776e84fd624DdAa23b23857310d3299c5` |
| **Developer 3**     | `0xe8D32babCda96482593ecE92E9418B3cC3D29Ddd` |
| **Developer 4**     | `0xC908Fa7C6dEb7a9b40e487678267E3400934847F` |
| **Developer 5**     | `0xFA84f2fcB7AEc4111Fc32D586165F47742729A1E` |
| **Default Hardhat** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Private keys are stored in `developer-accounts.json` (git-ignored).

---

## Commands

```bash
# Generate / refresh genesis and validator keys
pnpm devnet:generate

# Start devnet containers
pnpm devnet:up

# Check devnet health (block height, peers, active validators)
pnpm devnet:health

# Stop devnet containers
pnpm devnet:down

# Reset chain data and re-initialize clean genesis
pnpm devnet:reset
```

Cross-platform PowerShell (`.ps1`) and Bash (`.sh`) scripts are also available in `infra/devnet/scripts/`.

---

## Fault Tolerance & Validator Governance

- [Fault Tolerance Documentation (`docs/consensus/fault-tolerance.md`)](../../docs/consensus/fault-tolerance.md): Proof that 4 validators tolerate 1 failure, and safely halt on 2 failures ($N=4, F=1$).
- [Validator Lifecycle & Voting (`docs/consensus/validator-lifecycle.md`)](../../docs/consensus/validator-lifecycle.md): Step-by-step guide to admitting a 5th validator via on-chain vote (`qbft_proposeValidatorVote`).
