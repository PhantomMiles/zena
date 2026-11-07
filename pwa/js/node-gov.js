/**
 * Zena Network — Besu QBFT Node Admin & Governance Engine
 * Simulates 2-second QBFT block production, validator health, and on-chain voting
 */

let currentBlockHeight = 128492
let blockTickerInterval = null

const VALIDATORS = [
  {
    id: 'validator1',
    name: 'Astraea Logistics Node',
    address: '0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73',
    rpcPort: 8541,
    status: 'ONLINE',
    blockCommits: 32140,
  },
  {
    id: 'validator2',
    name: 'Intercity Haulage Node',
    address: '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
    rpcPort: 8542,
    status: 'ONLINE',
    blockCommits: 32138,
  },
  {
    id: 'validator3',
    name: 'North Sea Terminals Node',
    address: '0x821aEa9a577a9b44299B9c15c88cf3087F3b5544',
    rpcPort: 8543,
    status: 'ONLINE',
    blockCommits: 32142,
  },
  {
    id: 'validator4',
    name: 'Amira Freight Node',
    address: '0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2',
    rpcPort: 8544,
    status: 'ONLINE',
    blockCommits: 32135,
  },
]

const PROPOSALS = [
  {
    id: 14,
    title: 'Proposal #14: Standardize Cross-Border Handover Verification Protocols',
    category: 'Protocol Standard',
    proposer: 'Astraea Logistics (Ada N.)',
    description:
      'Require dual-signature GPS coordinate tolerance within 150m of port perimeter for automated clearance.',
    votesYes: 3,
    votesNo: 1,
    totalEligible: 4,
    quorumNeeded: 3,
    status: 'ACTIVE_VOTING',
    myVote: null,
  },
  {
    id: 15,
    title: 'Proposal #15: Shorten Settlement Escrow Hold Window to 24h',
    category: 'Financial Policy',
    proposer: 'Intercity Haulage (Musa D.)',
    description:
      'Reduce the automated escrow dispute window from 72 hours down to 24 hours post dual-signed POD.',
    votesYes: 2,
    votesNo: 1,
    totalEligible: 4,
    quorumNeeded: 3,
    status: 'ACTIVE_VOTING',
    myVote: 'YES',
  },
  {
    id: 16,
    title: 'Proposal #16: Admit Candidate Validator 5 (Kaduna Inland Port)',
    category: 'Consensus Membership',
    proposer: 'North Sea Terminals',
    description:
      'Execute qbft_proposeValidatorVote(0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10, true) to expand consensus set to N=5.',
    votesYes: 3,
    votesNo: 0,
    totalEligible: 4,
    quorumNeeded: 3,
    status: 'PASSED',
    myVote: 'YES',
  },
]

export function startBlockTicker(callback) {
  if (blockTickerInterval) clearInterval(blockTickerInterval)

  blockTickerInterval = setInterval(() => {
    currentBlockHeight++
    if (callback) {
      callback({
        blockNumber: currentBlockHeight,
        blockTimeSec: 2.0,
        consensus: 'QBFT Quorum BFT',
        activeValidators: 4,
        faultTolerance: 'F=1 (Tolerates 1 faulty node, Quorum Q=3)',
      })
    }
  }, 2000) // 2s deterministic block period as specified in docs/consensus/fault-tolerance.md
}

export function stopBlockTicker() {
  if (blockTickerInterval) {
    clearInterval(blockTickerInterval)
    blockTickerInterval = null
  }
}

export function getValidators() {
  return VALIDATORS
}

export function getProposals() {
  return PROPOSALS
}

export function castProposalVote(proposalId, voteType) {
  const proposal = PROPOSALS.find((p) => p.id === proposalId)
  if (!proposal) return null

  if (proposal.myVote === voteType) return proposal // already voted this

  // If changing vote
  if (proposal.myVote === 'YES' && voteType === 'NO') {
    proposal.votesYes--
    proposal.votesNo++
  } else if (proposal.myVote === 'NO' && voteType === 'YES') {
    proposal.votesNo--
    proposal.votesYes++
  } else {
    if (voteType === 'YES') proposal.votesYes++
    if (voteType === 'NO') proposal.votesNo++
  }

  proposal.myVote = voteType
  return proposal
}
