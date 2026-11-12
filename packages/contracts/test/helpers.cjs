const { ethers } = require('hardhat')
const { loadFixture, time } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

const id = (s) => ethers.id(s)
const ZERO = ethers.ZeroHash

async function deployFixture() {
  const [admin, shipper, carrier, relay, hub, outsider, stranger] = await ethers.getSigners()

  const registry = await (await ethers.getContractFactory('MembershipRegistry')).deploy(admin.address)
  const agreement = await (await ethers.getContractFactory('ShipmentAgreement')).deploy(await registry.getAddress())
  const ledger = await (
    await ethers.getContractFactory('SettlementLedger')
  ).deploy(await registry.getAddress(), await agreement.getAddress(), admin.address)
  const events = await (await ethers.getContractFactory('EventRegistry')).deploy(await registry.getAddress())
  await agreement.connect(admin).setSettlementLedger(await ledger.getAddress())

  const members = {
    shipper: { id: id('m:shipper'), signer: shipper },
    carrier: { id: id('m:carrier'), signer: carrier },
    hub: { id: id('m:hub'), signer: hub },
    outsider: { id: id('m:outsider'), signer: outsider },
  }
  for (const [name, m] of Object.entries(members)) {
    await registry.connect(admin).registerMember(m.id, `did:zena:ng:${name}`, m.signer.address, id(`kyb:${name}`))
  }

  const chainId = (await ethers.provider.getNetwork()).chainId
  const domain = async (name, c) => ({ name, version: '1', chainId, verifyingContract: await c.getAddress() })
  return { admin, relay, stranger, registry, agreement, ledger, events, members, domain }
}

const HANDOVER_TYPES = {
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
const POD_TYPES = {
  ProofOfDelivery: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'receiverMemberId', type: 'bytes32' },
    { name: 'podDocumentHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}
const ACTIVATE_TYPES = {
  ActivateShipment: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'termsHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}
const EVENT_TYPES = {
  PublishEvent: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'eventType', type: 'bytes32' },
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}
const RESOLUTION_TYPES = {
  DisputeResolution: [
    { name: 'shipmentId', type: 'bytes32' },
    { name: 'agreedPayoutMinorUnits', type: 'uint256' },
    { name: 'referenceHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}

async function futureExpiry() {
  return (await time.latest()) + 3600
}

/** Propose + activate a shipment: shipper -> carrier, 100_000 minor units. */
async function activeShipment(ctx, name = 'S1') {
  const { agreement, members, domain } = ctx
  const shipmentId = id(`shipment:${name}`)
  const termsHash = id(`terms:${name}`)
  await agreement
    .connect(members.shipper.signer)
    .proposeShipment(shipmentId, members.carrier.id, termsHash, 100000n, ethers.hexlify(ethers.toUtf8Bytes('NGN')))
  const expiry = await futureExpiry()
  const nonce = await agreement.memberNonces(members.carrier.id)
  const sig = await members.carrier.signer.signTypedData(
    await domain('ZenaShipmentAgreement', agreement),
    ACTIVATE_TYPES,
    { shipmentId, termsHash, nonce, expiry },
  )
  await agreement.activateShipment(shipmentId, expiry, sig)
  return shipmentId
}

async function signHandover(ctx, shipmentId, from, to, overrides = {}) {
  const { agreement, domain } = ctx
  const auth = {
    shipmentId,
    handoverId: id(`h:${Math.random()}`),
    givingMemberId: from.id,
    receivingMemberId: to.id,
    conditionNotesHash: id('notes'),
    nonce: await agreement.handoverNonces(shipmentId),
    expiry: await futureExpiry(),
    ...overrides,
  }
  const d = await domain('ZenaShipmentAgreement', agreement)
  const sigFrom = await from.signer.signTypedData(d, HANDOVER_TYPES, auth)
  const sigTo = await to.signer.signTypedData(d, HANDOVER_TYPES, auth)
  return { auth, sigFrom, sigTo }
}

async function doHandover(ctx, shipmentId, from, to, overrides) {
  const { auth, sigFrom, sigTo } = await signHandover(ctx, shipmentId, from, to, overrides)
  return ctx.agreement.confirmHandover(auth, sigFrom, sigTo)
}

async function signPod(ctx, shipmentId, receiver, overrides = {}) {
  const { agreement, domain } = ctx
  const msg = {
    shipmentId,
    receiverMemberId: receiver.id,
    podDocumentHash: id('pod'),
    nonce: await agreement.memberNonces(receiver.id),
    expiry: await futureExpiry(),
    ...overrides,
  }
  const sig = await receiver.signer.signTypedData(await domain('ZenaShipmentAgreement', agreement), POD_TYPES, msg)
  return { msg, sig }
}

async function deliver(ctx, shipmentId, receiver) {
  const { msg, sig } = await signPod(ctx, shipmentId, receiver)
  return ctx.agreement.confirmDelivery(shipmentId, msg.receiverMemberId, msg.podDocumentHash, msg.expiry, sig)
}

const State = { Proposed: 0, Active: 1, InTransit: 2, Delivered: 3, Settled: 4, Disputed: 5 }

module.exports = {
  ethers, loadFixture, time, id, ZERO, deployFixture, activeShipment, signHandover, doHandover,
  signPod, deliver, futureExpiry, State, EVENT_TYPES, RESOLUTION_TYPES, POD_TYPES, HANDOVER_TYPES,
}
