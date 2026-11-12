const { expect } = require('chai')
const h = require('./helpers.cjs')
const { ethers, loadFixture, id, State } = h

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
