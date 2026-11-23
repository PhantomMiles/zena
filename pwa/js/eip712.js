/**
 * Zena Network — real EIP-712 typed-data signing for the PWA.
 *
 * The domains and type definitions below mirror packages/contracts (see test/helpers.cjs), so a
 * signature produced here is verifiable by ShipmentAgreement.confirmHandover on-chain.
 * Signing uses the injected wallet (`window.ethereum`, EIP-1193) with `eth_signTypedData_v4`;
 * the PWA never holds a private key itself.
 *
 * Contract addresses are deployment-specific: set them once with
 *   localStorage.setItem('zena.contracts', JSON.stringify({ chainId: 1337, shipmentAgreement: '0x...' }))
 * Without them (or without a wallet) callers fall back to the unsigned demo digest.
 */

export const HANDOVER_TYPES = {
  HandoverAuthorization: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'handoverId', type: 'bytes32' },
    { name: 'givingMemberId', type: 'bytes32' },
    { name: 'receivingMemberId', type: 'bytes32' },
    { name: 'conditionNotesHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}

export const POD_TYPES = {
  ProofOfDelivery: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'receiverMemberId', type: 'bytes32' },
    { name: 'podDocumentHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}

const DOMAIN_NAME = 'ZenaShipmentAgreement'
const DOMAIN_VERSION = '1'

/** Off-chain ids (shipment/member/document strings) are mapped to bytes32 with SHA-256. */
export async function toBytes32(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)))
  return (
    '0x' +
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

export function getContractConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('zena.contracts') || 'null')
    if (
      cfg &&
      /^0x[0-9a-fA-F]{40}$/.test(cfg.shipmentAgreement || '') &&
      Number.isInteger(cfg.chainId)
    )
      return cfg
  } catch {
    /* storage unavailable or malformed: treat as not configured */
  }
  return null
}

export function canSignOnChain() {
  return typeof window !== 'undefined' && !!window.ethereum && !!getContractConfig()
}

export function buildTypedData(primaryType, types, message, cfg) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...types,
    },
    primaryType,
    domain: {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: cfg.chainId,
      verifyingContract: cfg.shipmentAgreement,
    },
    message,
  }
}

/** Ask the wallet to sign. Returns { signer, signature, typedData }; throws if refused/unavailable. */
export async function signTypedDataWithWallet(typedData) {
  if (!window.ethereum) throw new Error('No wallet found (window.ethereum)')
  const [signer] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const signature = await window.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [signer, JSON.stringify(typedData)],
  })
  return { signer, signature, typedData }
}

/**
 * Sign one side of a handover. Both the giver and the receiver must sign the SAME message
 * (same handoverId, nonce, expiry); pass `handoverId` back in for the second signer.
 * `nonce` must equal ShipmentAgreement.handoverNonces(shipmentId) at submission time.
 */
export async function signHandover({
  shipmentRef,
  giverRef,
  receiverRef,
  notes = '',
  nonce,
  handoverId,
  expiry,
}) {
  const cfg = getContractConfig()
  if (!cfg) throw new Error('Contract addresses not configured (localStorage "zena.contracts")')
  const message = {
    shipmentId: await toBytes32(shipmentRef),
    handoverId: handoverId || (await toBytes32(`handover:${shipmentRef}:${nonce}:${Date.now()}`)),
    givingMemberId: await toBytes32(giverRef),
    receivingMemberId: await toBytes32(receiverRef),
    conditionNotesHash: await toBytes32(notes),
    nonce: String(nonce),
    expiry: String(expiry || Math.floor(Date.now() / 1000) + 3600),
  }
  return {
    ...(await signTypedDataWithWallet(
      buildTypedData('HandoverAuthorization', HANDOVER_TYPES, message, cfg),
    )),
    message,
  }
}

export async function signProofOfDelivery({
  shipmentRef,
  receiverRef,
  podDocument = '',
  nonce,
  expiry,
}) {
  const cfg = getContractConfig()
  if (!cfg) throw new Error('Contract addresses not configured (localStorage "zena.contracts")')
  const message = {
    shipmentId: await toBytes32(shipmentRef),
    receiverMemberId: await toBytes32(receiverRef),
    podDocumentHash: await toBytes32(podDocument),
    nonce: String(nonce),
    expiry: String(expiry || Math.floor(Date.now() / 1000) + 3600),
  }
  return {
    ...(await signTypedDataWithWallet(buildTypedData('ProofOfDelivery', POD_TYPES, message, cfg))),
    message,
  }
}
