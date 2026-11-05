# Adding a Validator & Voting in Zena QBFT

This guide explains how member companies join as validators on the Zena consortium chain and how existing validators cast on-chain votes to admit or remove members.

---

## 1. Governance & Voting Model

In the Zena network:

- Validators represent verified member companies that have completed KYB (Know Your Business).
- Adding or removing a validator is governed on-chain via the QBFT consensus voting protocol.
- A vote requires a **simple majority ($> 50\%$)** of the current active validator set.
- For $N = 4$ validators, admitting a new validator requires at least **3 affirmative votes** ($\lfloor 4 / 2 \rfloor + 1 = 3$).

---

## 2. Step-by-Step: Adding a 5th Validator (`validator5`)

### Step 1: Generate the Candidate Node Key and Enode

Generate a keypair for the candidate validator node (or obtain it from the member company's secure node setup):

```bash
# Using Node / ethers
node -e '
  const { SigningKey, computeAddress } = require("ethers");
  const key = new SigningKey("0x" + Buffer.from("zena-devnet-seed-validator5").toString("hex").padEnd(64, "0"));
  console.log("Address:", computeAddress(key.publicKey));
  console.log("Private Key:", key.privateKey.slice(2));
  console.log("Enode Pub:", key.publicKey.slice(4));
'
```

Example Candidate Address:
`0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10`

### Step 2: Propose the Validator Vote from Current Validators

Each active validator casts an on-chain vote using the `qbft_proposeValidatorVote` JSON-RPC method:

- Method: `qbft_proposeValidatorVote`
- Arguments:
  1. `address`: Ethereum address of the candidate (string)
  2. `auth`: `true` to add as validator, `false` to remove (boolean)

#### Cast Vote from Validator 1 (Port 8541):

```bash
curl -X POST http://localhost:8541 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "qbft_proposeValidatorVote",
    "params": ["0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10", true],
    "id": 1
  }'
```

#### Cast Vote from Validator 2 (Port 8542):

```bash
curl -X POST http://localhost:8542 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "qbft_proposeValidatorVote",
    "params": ["0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10", true],
    "id": 2
  }'
```

#### Cast Vote from Validator 3 (Port 8543) - Securing Majority (3 of 4):

```bash
curl -X POST http://localhost:8543 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "qbft_proposeValidatorVote",
    "params": ["0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10", true],
    "id": 3
  }'
```

Once the 3rd validator votes, the majority threshold is satisfied. The candidate is admitted to the active validator set as soon as the vote is included in a newly committed block header!

### Step 3: Verify the New Validator Set

Query the read-only RPC gateway (`http://localhost:8545`):

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "qbft_getValidatorsByBlockNumber",
    "params": ["latest"],
    "id": 1
  }'
```

The response will return an array of 5 validator addresses, confirming the candidate has joined the active consensus committee.

---

## 3. Impact on Fault Tolerance ($N = 5$)

With 5 active validators:

$$F = \left\lfloor \frac{5 - 1}{3} \right\rfloor = \left\lfloor \frac{4}{3} \right\rfloor = 1$$

$$Q = 2(1) + 1 = 3 \text{ validators}$$

- **Tolerated Failures ($F$)**: 1 (remains 1 until $N=7$, where $F=2$)
- **Quorum ($Q$)**: Still requires 3 agreements, but now has 5 total nodes (providing extra resilience against single-node maintenance).

---

## 4. Removing a Validator

To remove a validator (e.g. decommissioned node or membership revocation):

```bash
curl -X POST http://localhost:8541 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "qbft_proposeValidatorVote",
    "params": ["0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10", false],
    "id": 1
  }'
```

When a majority of the remaining validators vote `false`, the validator is removed from the active set.
