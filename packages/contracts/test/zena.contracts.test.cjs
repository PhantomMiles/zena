const { expect } = require('chai')
const h = require('./helpers.cjs')
const { ethers, loadFixture, id, State } = h
const { mine } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

describe('ShipmentAgreement', () => {
  it('compiles and proposes + activates a shipment', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Active)
    expect((await ctx.agreement.getShipment(sid)).custodianMemberId).to.equal(ctx.members.shipper.id)
  })

  describe('handover authorization (Codex #2)', () => {
    it('lets shipper -> carrier open the chain of custody', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await expect(h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)).to.emit(ctx.agreement, 'HandoverConfirmed')
      expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.InTransit)
      expect((await ctx.agreement.getShipment(sid)).custodianMemberId).to.equal(ctx.members.carrier.id)
    })

    it('rejects two unrelated active members fabricating custody', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await expect(h.doHandover(ctx, sid, ctx.members.outsider, ctx.members.hub)).to.be.revertedWithCustomError(
        ctx.agreement,
        'NotCurrentCustodian',
      )
    })

    it('rejects a first hop that does not reach the contracted carrier', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await expect(h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.hub)).to.be.revertedWithCustomError(
        ctx.agreement,
        'FirstHandoverMustReachCarrier',
      )
    })

    it('rejects giving custody to yourself', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await expect(h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.shipper)).to.be.revertedWithCustomError(
        ctx.agreement,
        'InvalidHandoverParties',
      )
    })

    it('only the current custodian can hand over, and nonces are sequential', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
      // shipper no longer holds custody
      await expect(h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.hub)).to.be.revertedWithCustomError(
        ctx.agreement,
        'NotCurrentCustodian',
      )
      // stale nonce
      await expect(
        h.doHandover(ctx, sid, ctx.members.carrier, ctx.members.hub, { nonce: 0n }),
      ).to.be.revertedWithCustomError(ctx.agreement, 'InvalidHandoverNonce')
      await h.doHandover(ctx, sid, ctx.members.carrier, ctx.members.hub)
      expect(await ctx.agreement.handoverNonces(sid)).to.equal(2n)
    })

    it('rejects a replayed handover', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      const { auth, sigFrom, sigTo } = await h.signHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
      await ctx.agreement.confirmHandover(auth, sigFrom, sigTo)
      await expect(ctx.agreement.confirmHandover(auth, sigFrom, sigTo)).to.be.revertedWithCustomError(
        ctx.agreement,
        'HandoverAlreadyExecuted',
      )
    })

    it('rejects a forged receiving signature', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      const { auth, sigFrom } = await h.signHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
      const forged = await ctx.members.outsider.signer.signTypedData(
        await ctx.domain('ZenaShipmentAgreement', ctx.agreement),
        h.HANDOVER_TYPES,
        auth,
      )
      await expect(ctx.agreement.confirmHandover(auth, sigFrom, forged)).to.be.revertedWithCustomError(
        ctx.agreement,
        'UnauthorizedSigner',
      )
    })
  })

  describe('delivery attestation (Codex #3)', () => {
    it('rejects delivery with no handovers (Active -> Delivered shortcut)', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await expect(h.deliver(ctx, sid, ctx.members.outsider)).to.be.revertedWithCustomError(
        ctx.agreement,
        'InvalidStateTransition',
      )
    })

    it('rejects an unrelated active member attesting delivery', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
      await expect(h.deliver(ctx, sid, ctx.members.outsider)).to.be.revertedWithCustomError(
        ctx.agreement,
        'NotFinalReceiver',
      )
    })

    it('accepts delivery attested by the member who actually holds custody', async () => {
      const ctx = await loadFixture(h.deployFixture)
      const sid = await h.activeShipment(ctx)
      await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
      await h.doHandover(ctx, sid, ctx.members.carrier, ctx.members.hub)
      await h.deliver(ctx, sid, ctx.members.hub)
      expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Delivered)
    })
  })
})

describe('EventRegistry (Codex #4)', () => {
  async function sign(ctx, signer, nonce, extra = {}) {
    const msg = {
      shipmentId: id('S1'),
      eventType: id('ObjectEvent'),
      payloadHash: id('payload'),
      nonce,
      expiry: await h.futureExpiry(),
      ...extra,
    }
    const sig = await signer.signTypedData(await ctx.domain('ZenaEventRegistry', ctx.events), h.EVENT_TYPES, msg)
    return { msg, sig }
  }
  const publish = (ctx, who, m, sig) =>
    ctx.events.connect(who).publishEvent(m.shipmentId, m.eventType, m.payloadHash, m.nonce, m.expiry, sig)

  it('accepts a relayed signature exactly once and consumes the SIGNER nonce', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const { msg, sig } = await sign(ctx, ctx.members.carrier.signer, 0n)
    await expect(publish(ctx, ctx.relay, msg, sig)).to.emit(ctx.events, 'EventPublished')
    expect(await ctx.events.memberNonces(ctx.members.carrier.signer.address)).to.equal(1n)
    expect(await ctx.events.memberNonces(ctx.relay.address)).to.equal(0n)
  })

  it('rejects the relayer replaying the same signature', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const { msg, sig } = await sign(ctx, ctx.members.carrier.signer, 0n)
    await publish(ctx, ctx.relay, msg, sig)
    await expect(publish(ctx, ctx.relay, msg, sig)).to.be.revertedWithCustomError(ctx.events, 'InvalidNonce')
    await expect(publish(ctx, ctx.stranger, msg, sig)).to.be.revertedWithCustomError(ctx.events, 'InvalidNonce')
  })

  it('rejects a signer that is not an active member', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const { msg, sig } = await sign(ctx, ctx.stranger, 0n)
    await expect(publish(ctx, ctx.relay, msg, sig)).to.be.revertedWithCustomError(ctx.events, 'SignerNotActive')
  })

  it('still supports direct unsigned submission by a member node', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const m = { shipmentId: id('S1'), eventType: id('E'), payloadHash: id('P'), nonce: 0n, expiry: await h.futureExpiry() }
    await expect(publish(ctx, ctx.members.carrier.signer, m, '0x')).to.emit(ctx.events, 'EventPublished')
  })
})

describe('Dispute state machine (Codex #5)', () => {
  it('cannot dispute a Proposed or Active shipment', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await expect(
      ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 1000n, id('ev')),
    ).to.be.revertedWithCustomError(ctx.agreement, 'DisputeNotAllowedInState')
  })

  it('only the two parties may raise a dispute', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await expect(
      ctx.ledger.connect(ctx.members.outsider.signer).raiseDispute(sid, 1000n, id('ev')),
    ).to.be.revertedWithCustomError(ctx.ledger, 'UnauthorizedSigner')
  })

  it('a dispute in transit blocks handovers and cannot be settled/paid without delivery', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 50000n, id('lost?'))
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Disputed)
    await expect(h.doHandover(ctx, sid, ctx.members.carrier, ctx.members.hub)).to.be.revertedWithCustomError(
      ctx.agreement,
      'InvalidStateTransition',
    )
    // A mediator cannot pay out an undelivered shipment...
    await expect(
      ctx.ledger.connect(ctx.admin).resolveDisputeByMediation(sid, 100000n, id('ref')),
    ).to.be.revertedWithCustomError(ctx.ledger, 'PreDeliveryDisputeCannotPay')
    // ...and ordinary settlement is closed while disputed.
    await expect(ctx.ledger.triggerSettlement(sid, id('ref'))).to.be.revertedWithCustomError(
      ctx.ledger,
      'ShipmentNotDelivered',
    )
  })

  it('a zero-payout resolution resumes the in-transit shipment, which can then be delivered and settled', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 50000n, id('delay'))
    await ctx.ledger.connect(ctx.admin).resolveDisputeByMediation(sid, 0n, id('resume'))
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.InTransit)
    expect(await ctx.ledger.settledShipments(sid)).to.equal(false)

    await h.doHandover(ctx, sid, ctx.members.carrier, ctx.members.hub)
    await h.deliver(ctx, sid, ctx.members.hub)
    await expect(ctx.ledger.triggerSettlement(sid, id('ref'))).to.emit(ctx.ledger, 'SettlementInstructionEmitted')
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Settled)
  })

  it('a post-delivery dispute can be settled by mediation', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await h.deliver(ctx, sid, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 30000n, id('damage'))
    await expect(ctx.ledger.connect(ctx.admin).resolveDisputeByMediation(sid, 70000n, id('ref')))
      .to.emit(ctx.ledger, 'SettlementInstructionEmitted')
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Settled)
    await expect(ctx.ledger.triggerSettlement(sid, id('again'))).to.be.revertedWithCustomError(ctx.ledger, 'AlreadySettled')
  })

  it('a post-delivery dispute can be settled by dual-signed agreement', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await h.deliver(ctx, sid, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.carrier.signer).raiseDispute(sid, 30000n, id('short-pay'))
    const msg = {
      shipmentId: sid,
      agreedPayoutMinorUnits: 90000n,
      referenceHash: id('ref'),
      nonce: await ctx.ledger.disputeNonces(sid),
      expiry: await h.futureExpiry(),
    }
    const d = await ctx.domain('ZenaSettlementLedger', ctx.ledger)
    const sigS = await ctx.members.shipper.signer.signTypedData(d, h.RESOLUTION_TYPES, msg)
    const sigC = await ctx.members.carrier.signer.signTypedData(d, h.RESOLUTION_TYPES, msg)
    await expect(
      ctx.ledger.resolveDisputeByAgreement(sid, msg.agreedPayoutMinorUnits, msg.referenceHash, msg.expiry, sigS, sigC),
    ).to.emit(ctx.ledger, 'SettlementInstructionEmitted')
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Settled)
  })

  it('a single-party signature cannot resolve a dispute by agreement', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await h.deliver(ctx, sid, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.carrier.signer).raiseDispute(sid, 30000n, id('x'))
    const msg = {
      shipmentId: sid, agreedPayoutMinorUnits: 100000n, referenceHash: id('r'),
      nonce: await ctx.ledger.disputeNonces(sid), expiry: await h.futureExpiry(),
    }
    const d = await ctx.domain('ZenaSettlementLedger', ctx.ledger)
    const sigC = await ctx.members.carrier.signer.signTypedData(d, h.RESOLUTION_TYPES, msg)
    await expect(
      ctx.ledger.resolveDisputeByAgreement(sid, msg.agreedPayoutMinorUnits, msg.referenceHash, msg.expiry, sigC, sigC),
    ).to.be.revertedWithCustomError(ctx.ledger, 'UnauthorizedSigner')
  })

  it('settlement without delivery is impossible', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await expect(ctx.ledger.triggerSettlement(sid, id('ref'))).to.be.revertedWithCustomError(ctx.ledger, 'ShipmentNotDelivered')
  })
})

describe('Signed nonces and review follow-ups', () => {
  it('a proof of delivery signed with any nonce works regardless of signing order, once', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    const { msg, sig } = await h.signPod(ctx, sid, ctx.members.carrier, { nonce: 99n })
    await ctx.agreement.confirmDelivery(sid, msg.receiverMemberId, msg.podDocumentHash, msg.nonce, msg.expiry, sig)
    expect((await ctx.agreement.getShipment(sid)).state).to.equal(State.Delivered)
    expect(await ctx.agreement.nonceUsed(ctx.members.carrier.id, 99n)).to.equal(true)
  })

  it('a used activation nonce cannot be reused', async () => {
    const ctx = await loadFixture(h.deployFixture)
    await h.activeShipment(ctx, 'A') // consumes carrier nonce 7
    const sid = id('shipment:B')
    const terms = id('terms:B')
    await ctx.agreement
      .connect(ctx.members.shipper.signer)
      .proposeShipment(sid, ctx.members.carrier.id, terms, 5000n, ethers.hexlify(ethers.toUtf8Bytes('NGN')))
    const expiry = await h.futureExpiry()
    const sig = await ctx.members.carrier.signer.signTypedData(
      await ctx.domain('ZenaShipmentAgreement', ctx.agreement),
      { ActivateShipment: [
        { name: 'shipmentId', type: 'bytes32' }, { name: 'termsHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' }, { name: 'expiry', type: 'uint256' } ] },
      { shipmentId: sid, termsHash: terms, nonce: 7n, expiry },
    )
    await expect(ctx.agreement.activateShipment(sid, 7n, expiry, sig)).to.be.revertedWithCustomError(
      ctx.agreement,
      'NonceAlreadyUsed',
    )
  })

  it('a suspended member cannot raise a dispute', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await ctx.registry.connect(ctx.admin).setMemberStatus(ctx.members.shipper.id, 2)
    await expect(
      ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 1000n, id('ev')),
    ).to.be.revertedWithCustomError(ctx.ledger, 'UnauthorizedSigner')
  })
})

describe('MembershipRegistry / Governance extras', () => {
  it('setMemberStatus(None) is rejected (would orphan the signer mapping)', async () => {
    const ctx = await loadFixture(h.deployFixture)
    await expect(ctx.registry.connect(ctx.admin).setMemberStatus(ctx.members.carrier.id, 0)).to.be.revertedWithCustomError(
      ctx.registry,
      'InvalidStatus',
    )
  })

  it('Governance deploys, accepts a proposal, and exposes it via getProposal', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const gov = await (await ethers.getContractFactory('Governance')).deploy(await ctx.registry.getAddress(), 0, 5, 0, 50, 51)
    await gov.connect(ctx.members.carrier.signer).propose(ctx.stranger.address, '0x', id('d'))
    const p = await gov.getProposal(1)
    expect(p.proposerMemberId).to.equal(ctx.members.carrier.id)
    expect(p.totalVotersAtCreation).to.equal(4n)
  })
})

describe('Governance hardening (review item J)', () => {
  async function govFixture() {
    const ctx = await h.deployFixture()
    const gov = await (await ethers.getContractFactory('Governance')).deploy(await ctx.registry.getAddress(), 0, 20, 0, 50, 51)
    return { ...ctx, gov }
  }

  it('rejects self-targeting and zero-address proposals', async () => {
    const ctx = await loadFixture(govFixture)
    const s = ctx.members.carrier.signer
    await expect(ctx.gov.connect(s).propose(await ctx.gov.getAddress(), '0x', id('x'))).to.be.revertedWithCustomError(ctx.gov, 'InvalidTarget')
    await expect(ctx.gov.connect(s).propose(ethers.ZeroAddress, '0x', id('x'))).to.be.revertedWithCustomError(ctx.gov, 'InvalidTarget')
  })

  it('a member registered after the proposal cannot vote on it', async () => {
    const ctx = await loadFixture(govFixture)
    await ctx.gov.connect(ctx.members.carrier.signer).propose(ctx.registry.target, '0x', id('x'))
    const late = ethers.Wallet.createRandom().connect(ethers.provider)
    await ctx.registry.connect(ctx.admin).registerMember(id('m:late'), 'did:zena:ng:late', late.address, id('kyb:late'))
    await ctx.admin.sendTransaction({ to: late.address, value: ethers.parseEther('1') })
    await expect(ctx.gov.connect(late).castVote(1, true)).to.be.revertedWithCustomError(ctx.gov, 'NotEligibleToVote')
    await ctx.gov.connect(ctx.members.shipper.signer).castVote(1, true) // original members still can
  })

  it('total votes can never exceed the electorate counted at creation', async () => {
    const ctx = await loadFixture(govFixture)
    // 4 active members at creation -> reactivate-after-suspend games cannot add a 5th vote
    await ctx.registry.connect(ctx.admin).setMemberStatus(ctx.members.outsider.id, 2) // Suspended
    await ctx.gov.connect(ctx.members.carrier.signer).propose(ctx.registry.target, '0x', id('x'))
    expect((await ctx.gov.getProposal(1)).totalVotersAtCreation).to.equal(3n)
    await ctx.registry.connect(ctx.admin).setMemberStatus(ctx.members.outsider.id, 1) // Active again
    await ctx.gov.connect(ctx.members.carrier.signer).castVote(1, true)
    await ctx.gov.connect(ctx.members.shipper.signer).castVote(1, true)
    await ctx.gov.connect(ctx.members.hub.signer).castVote(1, true)
    await expect(ctx.gov.connect(ctx.members.outsider.signer).castVote(1, false)).to.be.revertedWithCustomError(ctx.gov, 'VoteCapReached')
  })

  it('only the proposer can cancel, and a canceled proposal cannot be voted on or executed', async () => {
    const ctx = await loadFixture(govFixture)
    await ctx.gov.connect(ctx.members.carrier.signer).propose(ctx.registry.target, '0x', id('x'))
    await expect(ctx.gov.connect(ctx.members.shipper.signer).cancel(1)).to.be.revertedWithCustomError(ctx.gov, 'NotProposer')
    await expect(ctx.gov.connect(ctx.members.carrier.signer).cancel(1)).to.emit(ctx.gov, 'ProposalCanceled')
    expect(await ctx.gov.state(1)).to.equal(6n)
    await expect(ctx.gov.connect(ctx.members.shipper.signer).castVote(1, true)).to.be.revertedWithCustomError(ctx.gov, 'InvalidProposalState')
    await expect(ctx.gov.connect(ctx.members.carrier.signer).cancel(1)).to.be.revertedWithCustomError(ctx.gov, 'ProposalNotCancelable')
  })

  it('refuses to execute a call against an address with no code', async () => {
    const ctx = await loadFixture(govFixture)
    await ctx.gov.connect(ctx.members.carrier.signer).propose(ctx.stranger.address, '0x', id('x'))
    for (const m of ['carrier', 'shipper', 'hub']) await ctx.gov.connect(ctx.members[m].signer).castVote(1, true)
    await mine(25)
    await ctx.gov.queue(1)
    await expect(ctx.gov.execute(1)).to.be.revertedWithCustomError(ctx.gov, 'InvalidTarget')
  })
})

describe('Mediation panel (review item K)', () => {
  const MED = ethers.id('MEDIATION_ROLE')
  async function disputed(ctx) {
    const sid = await h.activeShipment(ctx)
    await h.doHandover(ctx, sid, ctx.members.shipper, ctx.members.carrier)
    await h.deliver(ctx, sid, ctx.members.carrier)
    await ctx.ledger.connect(ctx.members.shipper.signer).raiseDispute(sid, 30000n, id('damage'))
    return sid
  }

  it('threshold must be between 1 and the number of mediators', async () => {
    const ctx = await loadFixture(h.deployFixture)
    await expect(ctx.ledger.connect(ctx.admin).setMediationThreshold(2)).to.be.revertedWithCustomError(ctx.ledger, 'InvalidThreshold')
    await expect(ctx.ledger.connect(ctx.admin).setMediationThreshold(0)).to.be.revertedWithCustomError(ctx.ledger, 'InvalidThreshold')
    await expect(ctx.ledger.connect(ctx.stranger).setMediationThreshold(1)).to.be.reverted
  })

  it('a 2-of-3 panel is required; one mediator (even the deployer) cannot decide alone', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const [, , , , , , , m2, m3] = await ethers.getSigners()
    await ctx.ledger.connect(ctx.admin).grantRole(MED, m2.address)
    await ctx.ledger.connect(ctx.admin).grantRole(MED, m3.address)
    await ctx.ledger.connect(ctx.admin).setMediationThreshold(2)
    expect(await ctx.ledger.mediatorCount()).to.equal(3n)

    const sid = await disputed(ctx)
    await ctx.ledger.connect(ctx.admin).resolveDisputeByMediation(sid, 70000n, id('ref'))
    expect(await ctx.ledger.settledShipments(sid)).to.equal(false)
    await expect(ctx.ledger.connect(ctx.admin).resolveDisputeByMediation(sid, 70000n, id('ref'))).to.be.revertedWithCustomError(
      ctx.ledger,
      'AlreadyApprovedMediation',
    )
    // a different outcome does not combine with the first one
    await ctx.ledger.connect(m2).resolveDisputeByMediation(sid, 10000n, id('other'))
    expect(await ctx.ledger.settledShipments(sid)).to.equal(false)
    // the matching second approval resolves it
    await expect(ctx.ledger.connect(m3).resolveDisputeByMediation(sid, 70000n, id('ref'))).to.emit(
      ctx.ledger,
      'SettlementInstructionEmitted',
    )
    expect(await ctx.ledger.settledShipments(sid)).to.equal(true)
  })

  it('mediators cannot be removed below the threshold, and non-mediators cannot vote', async () => {
    const ctx = await loadFixture(h.deployFixture)
    const [, , , , , , , m2] = await ethers.getSigners()
    await ctx.ledger.connect(ctx.admin).grantRole(MED, m2.address)
    await ctx.ledger.connect(ctx.admin).setMediationThreshold(2)
    await expect(ctx.ledger.connect(ctx.admin).revokeRole(MED, m2.address)).to.be.revertedWithCustomError(ctx.ledger, 'InvalidThreshold')
    const sid = await disputed(ctx)
    await expect(ctx.ledger.connect(ctx.stranger).resolveDisputeByMediation(sid, 1n, id('r'))).to.be.reverted
  })
})

describe('PWA EIP-712 signing (pwa/js/eip712.js)', () => {
  it('typed data built by the PWA verifies on-chain in confirmHandover', async () => {
    const pwa = await import('../../../pwa/js/eip712.js')
    const ctx = await loadFixture(h.deployFixture)
    // The PWA maps string ids to bytes32 with SHA-256; register matching members.
    const [, , , , , , , , , wShipper, wCarrier] = await ethers.getSigners()
    const ids = { shipper: await pwa.toBytes32('PWA Shipper'), carrier: await pwa.toBytes32('PWA Carrier') }
    await ctx.registry.connect(ctx.admin).registerMember(ids.shipper, 'did:zena:pwa:s', wShipper.address, id('kyb:ps'))
    await ctx.registry.connect(ctx.admin).registerMember(ids.carrier, 'did:zena:pwa:c', wCarrier.address, id('kyb:pc'))

    const shipmentId = await pwa.toBytes32('PWA-SHP-1')
    const termsHash = id('terms:pwa')
    await ctx.agreement
      .connect(wShipper)
      .proposeShipment(shipmentId, ids.carrier, termsHash, 1000n, ethers.hexlify(ethers.toUtf8Bytes('NGN')))
    const expiry = await h.futureExpiry()
    await ctx.agreement.activateShipment(
      shipmentId, 1n, expiry,
      await wCarrier.signTypedData(await ctx.domain('ZenaShipmentAgreement', ctx.agreement),
        { ActivateShipment: [
          { name: 'shipmentId', type: 'bytes32' }, { name: 'termsHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' }, { name: 'expiry', type: 'uint256' } ] },
        { shipmentId, termsHash, nonce: 1n, expiry }),
    )

    const cfg = { chainId: Number((await ethers.provider.getNetwork()).chainId), shipmentAgreement: await ctx.agreement.getAddress() }
    const message = {
      shipmentId,
      handoverId: await pwa.toBytes32('handover-1'),
      givingMemberId: ids.shipper,
      receivingMemberId: ids.carrier,
      conditionNotesHash: await pwa.toBytes32('sealed'),
      nonce: '0',
      expiry: String(expiry),
    }
    const td = pwa.buildTypedData('HandoverAuthorization', pwa.HANDOVER_TYPES, message, cfg)
    // Sign exactly what a wallet would receive from eth_signTypedData_v4.
    const { EIP712Domain, ...types } = td.types
    const sigG = await wShipper.signTypedData(td.domain, types, td.message)
    const sigR = await wCarrier.signTypedData(td.domain, types, td.message)
    await expect(ctx.agreement.confirmHandover(message, sigG, sigR)).to.emit(ctx.agreement, 'HandoverConfirmed')
  })
})
