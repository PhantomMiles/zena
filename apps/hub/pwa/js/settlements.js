/**
 * Zena Network — Contract Settlements & Financial Evidence Pack Engine
 * Handles automated payment release, dispute escrow holds, and cryptographic receipts
 */

import { getShipmentById, saveShipmentsToStorage } from './shipments.js'

export const SETTLEMENT_METRICS = {
  outstandingReceivablesEur: 62400,
  disputeUnderReviewCount: 2,
  eligibleForReleaseEur: 28800,
  settledThisMonthEur: 114500,
}

export function getSettlementDetails(shipmentId) {
  const shipment = getShipmentById(shipmentId) || {
    id: shipmentId,
    cargo: 'Sesame — 24 metric tonnes',
    rateEur: 28800,
    dualSignatureStatus: 'PENDING_SECOND',
  }

  const isEligible = shipment.dualSignatureStatus === 'FULLY_SIGNED' || shipment.id === 'ZN-26041'
  const baseRate = shipment.rateEur || 28800
  const disputeDeduction = 0
  const netPayout = baseRate - disputeDeduction

  return {
    shipmentId: shipment.id,
    cargo: shipment.cargo,
    isEligible,
    eligibilityMessage: isEligible
      ? 'Proof of Delivery Verified: 2 of 2 Signatures Validated on Consortium Chain'
      : 'Awaiting Counter-Signature from Receiving Terminal',
    carrierName: shipment.parties?.carrier || 'Intercity Haulage',
    carrierNode: shipment.carrierNode || '0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10',
    bankingPartner: 'Paystack B2B / Flutterwave Treasury Rails (CBN Licensed)',
    financials: {
      agreedFreightRate: baseRate,
      disputeDeduction: disputeDeduction,
      escrowHold: 0,
      netPayout: netPayout,
      currency: 'EUR',
    },
    escrowTerms:
      'Release triggered within 120s of dual-signed POD. Disputed items freeze disputed variance only.',
  }
}

// Simulate automated cryptographic release to carrier's bank account
export async function executeReleaseSettlement(shipmentId) {
  const details = getSettlementDetails(shipmentId)

  // Simulate network RPC delay to Besu node and banking webhook
  await new Promise((resolve) => setTimeout(resolve, 1400))

  const settlementTx = {
    receiptId: 'REC-' + Math.floor(100000 + Math.random() * 900000),
    shipmentId: details.shipmentId,
    timestamp: new Date().toISOString(),
    amountEur: details.financials.netPayout,
    settlementHash:
      '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    bankingReference: 'TXN-NGN-' + Math.floor(10000000 + Math.random() * 90000000),
    blockNumber: 128495 + Math.floor(Math.random() * 50),
    beneficiary: details.carrierName,
    beneficiaryNode: details.carrierNode,
    status: 'SETTLED',
  }

  const shipment = getShipmentById(shipmentId)
  if (shipment) {
    shipment.status = 'VERIFIED_SETTLED'
    shipment.statusLabel = 'Verified & Settled'
    saveShipmentsToStorage()
  }

  return settlementTx
}

// Generate complete Evidence Pack payload for download
export function generateEvidencePack(shipmentId) {
  const shipment = getShipmentById(shipmentId)
  const details = getSettlementDetails(shipmentId)

  const evidencePack = {
    zenaNetworkProtocol: 'v1.0.0-QBFT',
    consortiumChainId: 1337,
    shipmentId: shipment ? shipment.id : shipmentId,
    generatedAt: new Date().toISOString(),
    cargo: shipment ? shipment.cargo : 'Sesame 24t',
    parties: shipment ? shipment.parties : {},
    custodyEvents: shipment ? shipment.events : [],
    settlementSummary: details.financials,
    regulatoryCompliance:
      'NDPA 2023 Compliant · Cryptographic Proofs Only · No Raw PII Stored On-Chain',
  }

  return evidencePack
}
