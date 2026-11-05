# Zena: Decentralised Logistics Network Blueprint

Nov 2, 2026 · @Ifunanyachukwu

## Analysis: the verdict

**Zena** is a decentralised, blockchain-structured network that logistics companies (carriers, freight forwarders, 3PLs, warehouses, ports) run together as shared infrastructure. It is worth building **only if members co-own it and it removes costs they already carry**. A logistics blockchain owned by one company will repeat history.

**Why decentralised is the right call here**

- Logistics is a chain of competitors and subcontractors who each keep their own records and distrust each other's.
- Most disputes are between companies, not inside one: proof of delivery, handover damage, late payment, invoice mismatches.
- A neutral shared record with member-run nodes means no single company controls the data, the rules or the pricing.

**What the pitch oversells (be honest with investors and members)**

- **"Can't be tampered" only covers data after it is written.** A driver can still sign a false delivery. You need signed events, dual-party confirmation and trusted data capture, not just a ledger.
- **Big-name adoption is a warning.** Maersk and IBM's TradeLens shut down in 2023, largely because rival carriers would not join a platform one company owned. Zena's answer is shared governance from day one.
- **Fully public chains don't fit.** Rates, customers and routes are commercially sensitive. Zena needs permissioned membership and private data, with public anchoring only for audit.
- **"Lots of funding" is uneven.** Money follows measurable savings (days sales outstanding, claims, admin hours), not slogans.

**The wedge I'd pick (assumption, swap it if wrong)**

**Inter-company handover proof and automated settlement** between forwarders, hauliers and warehouses on one corridor. It targets the sharpest pain (carriers waiting long for payment, disputes over proof of delivery), needs only 5 to 10 founding companies, and creates network effects as each member brings its subcontractors.

| Layer                                         | Blockchain needed?   | Why                                             |
| --------------------------------------------- | -------------------- | ----------------------------------------------- |
| Dashboards, alerts, reporting                 | No                   | Ordinary apps on each member's own data         |
| Shared shipment and handover events           | Yes                  | One neutral record, signed by both parties      |
| Document integrity (POD, bills, certificates) | Yes                  | Tamper-evident fingerprints, files stay private |
| Settlement and conditional payment            | Yes, with bank rails | Auto-release when handover and POD are verified |
| Identity and permissions between companies    | Yes                  | Verifiable credentials, no central login owner  |
| Telematics and scan data capture              | No (but critical)    | Input quality decides trust                     |

**Revenue model**

- Annual membership per company, tiered by shipment volume.
- Small per-transaction fee on settled shipments.
- Fee on payments released through the settlement layer.
- Premium: hosted node, analytics, and data feeds for insurers and banks.

**Top risks and mitigations**

| Risk                       | Why it bites                                        | Mitigation                                                                       |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Cold start                 | Value needs several companies on the same lanes     | Recruit a founding consortium before building; pilot one corridor                |
| Governance fights          | Competitors co-owning rules                         | Neutral legal entity, written charter, one-member-one-vote at launch             |
| Antitrust and data sharing | Competitors exchanging commercial data              | Share events and proofs, not rates or customer lists; get competition-law advice |
| Bad input data             | Chain can't detect lies                             | Dual signatures, geo-stamped captures, telematics attestations                   |
| Legacy integration         | TMS and ERP systems are fragmented                  | Ship connectors and an open standard (GS1 EPCIS events) from day one             |
| Regulation                 | Payments and data protection (NDPA 2023, CBN rules) | Use a licensed payments partner; keep personal data off-chain                    |
| Cost and complexity        | Running nodes is hard for small firms               | Offer a hosted node and a one-click deploy kit                                   |

## Brand: Zena

**Zena** is short, two syllables, easy to say in English, French, Portuguese and Swahili-speaking markets, and the Z gives it a strong, ownable mark. It names a network, not a feature, which suits a shared system that many companies co-own.

- **Tagline:** One record. Every carrier.
- **Alternate taglines:** The shared ledger for moving freight. / Move together, settle faster.
- **Product family:** **Zena Network** (the decentralised ledger), **Zena Node** (the member-run node software), **Zena Hub** (web and mobile apps), **Zena Settle** (automated payments), **Zena Connect** (TMS, ERP and telematics integrations).
- **Voice:** calm, precise, cooperative. Speak as "we, the network", not "our platform". Plain words: "handover", "proof of delivery", "settled". Avoid hype words like "revolutionary" and avoid crypto jargon in product UI.
- **Logo direction:** a geometric Z drawn as a route line with three node dots (origin, handover, destination). Mark alone: the node-Z in green on a midnight-blue rounded square. Wordmark in lowercase _zena_.

| Name         | Meaning                            | Verdict                |
| ------------ | ---------------------------------- | ---------------------- |
| **Zena**     | Short, pan-regional network name   | Your choice, locked in |
| Zena Network | Descriptor for legal and press use | Use as the formal name |

**Before you commit:** "Zena" is a common word and name, so expect existing businesses with it. Run a trademark search (NG IPO, EUIPO, USPTO) in your target classes (software, logistics, financial services), and check domains and handles. If "zena.com" is gone, "zena.network" or "getzena.com" with the descriptor "Zena Network" is a normal workaround. I can't verify availability from here.

## System architecture plan

Zena is a hybrid network: member-run nodes keep private data, a permissioned consortium chain holds shared events and settlement logic, and a public layer 2 chain anchors state for neutral audit.

&#91;embedded content: Zena system architecture · 4 layers\]

Each logistics company runs its own node. Nodes publish signed events and fingerprints to the shared network, and the network triggers payments and anchors its state publicly.

**Chain choice**

| Option                                           | Fit for logistics companies                                                  | Verdict         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | --------------- |
| Single-company chain                             | One owner controls rules and data; rivals won't join (the TradeLens failure) | No              |
| Public chain only                                | Exposes commercial data, variable fees, limited privacy                      | Anchor only     |
| Permissioned consortium chain, member validators | Privacy, fast finality, shared governance                                    | Core            |
| Hybrid: consortium chain + public L2 anchor      | Private operations with publicly verifiable audit trail                      | **Recommended** |

**Recommended stack** (a small full-stack team can ship this)

| Layer            | Choice                                                                               | Why                                                            |
| ---------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Consortium chain | Hyperledger Besu (EVM) with QBFT consensus; Hyperledger Fabric is the alternative    | Member validators, instant finality, Solidity tooling          |
| Smart contracts  | Event registry, handover (dual-sign), settlement, governance and membership          | Four small contract groups cover the product                   |
| Identity         | W3C DIDs and verifiable credentials issued after KYB                                 | No central login owner; each member controls its keys          |
| Event standard   | GS1 EPCIS 2.0 event model, mapped to Zena events                                     | Interoperates with existing supply-chain systems               |
| Member node      | TypeScript services, PostgreSQL, Docker and Kubernetes deploy kit                    | One-click deploy for IT teams                                  |
| Private data     | Encrypted off-chain store with per-party keys, shared peer-to-peer by the sync agent | Files and rates never leave the parties involved               |
| Apps             | Next.js web (Zena Hub), Expo / React Native driver and yard app, offline-first       | Patchy signal is normal on road corridors                      |
| Integrations     | REST, webhooks, EDI connectors to TMS, ERP, WMS; MQTT for telematics                 | Adoption depends on plugging into what members already use     |
| Payments         | Licensed bank and PSP APIs (Paystack, Flutterwave, bank rails)                       | Fiat first; stablecoins only after legal review                |
| Public anchor    | Periodic state root on Polygon or Base                                               | Cheap, neutral proof that the network history wasn't rewritten |

**How a shipment moves across companies**

1. A shipper tenders a load to a forwarder; the forwarder's TMS connector creates a shipment in its Zena node.
2. The forwarder subcontracts a carrier; rate, SLA and proof-of-delivery rules are agreed and recorded as a contract between the two nodes.
3. At pickup, the driver app captures a signed event (time, location, photos); the carrier node publishes it.
4. Every handover (carrier to warehouse, warehouse to port) needs **both parties' signatures**, creating a dual-signed custody record.
5. At delivery, the receiver signs the proof of delivery; the settlement logic checks contract terms.
6. If terms are met, the settlement contract issues a payout instruction through the licensed payments partner; disputes freeze only the disputed amount.
7. The network state root is anchored publicly; insurers, banks and customers can verify history without seeing private data.

**Decentralisation and governance**

- Validators are member companies, rotated by an on-chain vote; no company holds more than a set share of validators.
- A neutral legal entity (cooperative or non-profit) owns the protocol IP and the membership agreement.
- One member, one vote at launch for upgrades and fees; weighted voting can come later if members want it.
- Rules for what may be shared (events and proofs, never rates or customer lists) are written into the charter for competition-law safety.

**Security and compliance**

- No personal or commercial data in plaintext on-chain; fingerprints and pseudonymous IDs only (NDPA 2023, GDPR-friendly).
- KYB onboarding before any company joins; keys held in a KMS or HSM, with a hosted-node option for small firms.
- Independent audit of all smart contracts before mainnet and before any real payment flows.
- Payments through a licensed partner; get legal advice on CBN rules before holding or moving client funds.

**Build phases** (my estimates for a team of 3 to 5)

1. **Phase 0, weeks 1 to 4:** recruit 5 to 10 founding member companies, draft the governance charter, take legal advice on competition and data rules.
2. **Phase 1, months 1 to 4:** private testnet with 3 founder validators, node software, event registry, driver app, EPCIS mapping.
3. **Phase 2, months 5 to 8:** dual-signed handovers, proof of delivery, document attestation, dashboards, first TMS connectors.
4. **Phase 3, months 9 to 12:** settlement contracts with a licensed payments partner, public anchoring, contract audit, go-live on one corridor.
5. **Phase 4, month 13 onward:** open membership, validator onboarding, capacity marketplace, insurer and bank data feeds.

## Figma UI/UX prompt pack

Ten prompts, run in order. Prompts 1 to 6 build the research and structure (use **FigJam** for the diagrams), prompts 7 and 8 build the screens (use **Figma Design / Make**), and prompt 9 handles prototyping and handoff. Paste **Prompt 0 first in every new chat or file** so the model keeps brand context.

**Honest note:** the personas below are proto-personas built from the market logic, not interviews. Validate them with 5 to 10 real exporters and agents before you treat them as truth.

### Prompt 0: Master context (paste first, every time)

```text
You are a senior product designer. We are designing ZENA, a decentralised, blockchain-structured logistics network owned and run by logistics companies: carriers, freight forwarders, 3PLs, warehouses and ports. Tagline: "One record. Every carrier."

What it does: each company runs its own Zena Node and uses the Zena Hub apps. Shipments, subcontracts, handovers, proof of delivery and documents are recorded as signed events on a shared network, so competing companies see one truth with no central owner. Every handover needs both parties' signatures. When contract terms and proof of delivery are verified, payment can be settled automatically through licensed banking partners. Members vote on network rules. Users never see the words blockchain, wallet, token or gas; they see "Signed", "Handover confirmed", "Verified on network" and "Settled".

Users: operations directors at freight forwarders, haulage owners and dispatchers, drivers, warehouse and yard managers, finance and claims managers, IT and integration leads who run the company node, and network governance delegates.
Context: mobile-first and offline-first for drivers and yards, desktop-heavy for operations and finance, intermittent connectivity, English first with French later.
Tone: calm, precise, cooperative. Short sentences. No jargon.
Platforms: Zena Hub web app, driver and yard mobile app, public network explorer, governance portal, node admin console.
Accessibility: WCAG 2.2 AA, minimum 16px body text, 44px touch targets, never colour alone for status.
Always keep outputs organised in named frames, use auto layout, and name layers clearly.
```

### Prompt 1: Colour architecture and design system

Palette logic: **midnight blue** carries trust and structure, **green** carries verified and go, and one **accent chosen by Figma** carries in-transit and attention. If you want a default, mine is Signal Amber, listed in the prompt.

```text
Using the Zena context, create a design system foundation page in Figma with variables (not loose styles).

COLOUR ARCHITECTURE
Primary brand colours (required):
- Midnight Blue: 900 #071326, 800 #0B1F3A (main), 700 #14305A, 600 #1F4278, 100 #DCE6F5
- Verdant Green: 700 #0E7A47 (text-safe on white), 500 #1FB36B (main fill), 100 #D9F5E6, 50 #EEFBF4

Third colour: YOU choose one accent that harmonises with midnight blue and green. Requirements: warm enough to contrast both, passes AA for text at its dark step, role is "in transit, pending, attention". Give it a name, a 50/100/500/700 scale, and a one-line rationale. If unsure, use Signal Amber: 500 #F5A524, 700 #B36B00, 100 #FDEFD3.

Neutrals: 0 #FFFFFF, 50 #F5F7FA, 100 #E8ECF2, 300 #B7C0CE, 500 #6B7A90, 700 #2E3A4D, 900 #0B1F3A.
Semantic: success = Verdant 500, warning = accent, error #E5484D, info #4C8DFF.

RULES
- 60/30/10 usage: 60 percent neutrals, 30 percent midnight blue, 10 percent green and accent.
- White text only on Midnight 600 and darker or Verdant 700. Use Midnight 900 text on Verdant 500 and on the accent 500.
- Status chips: Verified (green), In transit (accent), Needs action (error), Draft (neutral). Always pair colour with an icon and label.
- Build light and dark themes as variable modes. Dark: background Midnight 900, surface 800, elevated 700.

TYPE AND SHAPE
- Space Grotesk for headings, Inter for UI text, JetBrains Mono for hashes and IDs.
- Scale: 12, 14, 16, 20, 24, 32, 44. Line height 1.4 for body.
- 8pt spacing grid. Radius 8 (inputs), 12 (cards), 16 (sheets). Soft elevation, no heavy shadows.

COMPONENTS TO BUILD (with variants and states)
Button (primary, secondary, ghost, destructive), input, select, file upload, status chip, shipment card, timeline step, handover card, signature badge ("Signed" with copy), data table, toast, modal, bottom nav, side nav, empty state, offline banner.

Output: colour variables page with contrast-ratio annotations, type page, and a component page.
```

### Prompt 2: User personas (FigJam)

```text
In FigJam, create five persona cards for Zena, each 1 frame with: photo placeholder, name, age, role, company type, location, tech comfort (1 to 5), goals (3), frustrations (3), a quote, and "what Zena must do for them" (2). Use the Zena palette. Add a header sticky: "Proto-personas, validate with interviews".

1) ADAEZE NWOSU, 36, Operations Director at a mid-size freight forwarder, Lagos (Apapa). Tech comfort 4.
Goals: win more shipper contracts, cut reconciliation time, pay subcontractors accurately and on time.
Frustrations: chasing carriers for status by phone and WhatsApp, disputes over proof of delivery, the same data re-keyed into three systems.
Quote: "Half my day is asking where the truck is and who signed for it."
Must do: one shared, signed record of every handover; automatic status without calls.

2) MUSA DANJUMA, 44, owner of a 40-truck haulage company, Kano. Tech comfort 2 to 3 (smartphone, WhatsApp).
Goals: get paid in days rather than months, win steady loads, prove every delivery.
Frustrations: delayed payments from forwarders, disputed delivery proofs, cash-flow gaps.
Quote: "I delivered. Why am I still waiting to be paid?"
Must do: instant, verifiable proof of delivery and fast, rules-based settlement; work offline and in simple language.

3) CHINEDU EZE, 39, warehouse and yard manager at a 3PL, Port Harcourt. Tech comfort 3.
Goals: smooth truck turnaround, accurate handovers, fewer damage claims.
Frustrations: paper gate passes, handover arguments with no evidence, trucks queuing because of paperwork.
Quote: "When cargo changes hands, nobody agrees what condition it was in."
Must do: a fast two-party handover with photos and signatures; clear queue visibility.

4) NGOZI ADEBAYO, 42, finance and claims manager at a forwarder, Lagos. Tech comfort 4.
Goals: reconcile invoices fast, settle disputes with evidence, lower days sales outstanding.
Frustrations: invoice mismatches, slow dispute resolution, insurers demanding proof she can't produce quickly.
Quote: "Every invoice dispute is an archaeology project."
Must do: tie every invoice line to signed events; export audit-ready evidence packs.

5) TOBI SALAMI, 31, IT and integration lead at a logistics group, Lagos. Tech comfort 5.
Goals: connect Zena to the TMS and ERP quickly, run the node reliably, keep company data private.
Frustrations: fragile integrations, unclear security responsibilities, tools that need constant babysitting.
Quote: "If it doesn't plug into what we already run, it won't survive."
Must do: a one-click node deploy kit, clear API docs, and a health dashboard that explains problems in plain language.
```

### Prompt 3: Empathy maps (FigJam)

```text
In FigJam, create one empathy map per persona (Adaeze, Musa, Chinedu, Ngozi, Tobi) using the quadrants SAYS, THINKS, DOES, FEELS plus PAINS and GAINS strips beneath. Use sticky notes, 3 to 4 per quadrant, colour-coded: green = positive, accent = mixed, red = negative. Put the persona name and photo placeholder at the centre.

ADAEZE (forwarder operations)
SAYS: "Where is the truck?" / "Send me the signed POD." / "We'll pay once it's reconciled."
THINKS: "If one subcontractor slips, the client blames me." / "I can't trust updates I can't verify."
DOES: calls drivers and dispatchers / re-keys statuses into the TMS / reconciles spreadsheets at month end.
FEELS: stretched / accountable for others' mistakes / wary of any tool that adds steps.
PAINS: status chasing, disputes, duplicate data entry.
GAINS: shared live record, fewer disputes, faster reconciliation.

MUSA (haulier owner)
SAYS: "The load was delivered Tuesday." / "Please pay me this week." / "My driver has the signed copy."
THINKS: "They may dispute this to delay payment." / "I can't fund fuel for another week."
DOES: sends POD photos on WhatsApp / visits the forwarder's office / borrows to cover fuel.
FEELS: anxious about cash / proud of reliability / distrustful of big partners.
PAINS: late payment, disputed proofs, no leverage.
GAINS: provable deliveries, fast settlement, a reputation that wins loads.

CHINEDU (warehouse and yard)
SAYS: "Gate pass please." / "The seal was already broken." / "Next truck, please move."
THINKS: "If I don't document this, I'm blamed." / "Paper is slowing the gate."
DOES: checks paperwork by hand / takes photos on his own phone / argues over damage.
FEELS: pressured by queues / exposed to blame / open to simple tools.
PAINS: handover disputes, gate congestion, lost paperwork.
GAINS: evidence on every handover, faster gate flow, clear responsibility.

NGOZI (finance and claims)
SAYS: "The invoice doesn't match the POD." / "Where's the damage evidence?" / "Insurer needs the file today."
THINKS: "Which version is true?" / "Every dispute delays cash."
DOES: matches invoices to documents by hand / emails partners for proof / builds claim packs from scratch.
FEELS: frustrated by rework / responsible for cash flow / careful about risk.
PAINS: mismatches, slow disputes, claim evidence gaps.
GAINS: invoices linked to signed events, automatic evidence packs, lower DSO.

TOBI (IT and integration)
SAYS: "What's the API rate limit?" / "Who owns the keys?" / "Does this support our TMS?"
THINKS: "If this breaks, I'm on call." / "Security will ask a hundred questions."
DOES: reads docs first / tests in a sandbox / builds middleware between systems.
FEELS: cautious / protective of company data / eager for clean tooling.
PAINS: brittle integrations, unclear ownership, heavy maintenance.
GAINS: reliable connectors, clear security model, node health visibility.
```

### Prompt 4: User journey maps (FigJam)

```text
In FigJam, build user journey maps for Zena as horizontal swimlanes. Rows: STAGE, ACTIONS, TOUCHPOINTS, EMOTION CURVE (line from 1 sad to 5 happy), PAIN POINTS, OPPORTUNITIES. Use green for opportunities, red for pain points, accent for neutral moments.

JOURNEY A: ADAEZE, forwarder operations director
Stages: 1 Win contract, 2 Subcontract carriers, 3 Track handovers, 4 Verify delivery, 5 Settle and reconcile, 6 Review performance.
Key beats: confident but worried about subcontractor risk (mid) / agrees terms with a carrier on the network (rising) / sees live signed handovers with no calls (high) / delivery proof arrives signed by both sides (high) / invoice matches events and settles automatically (peak) / scorecards show which partners perform (high).
Opportunities: partner scorecards, automatic status alerts, one-click evidence pack, TMS sync.

JOURNEY B: MUSA, haulier owner
Stages: 1 Receive job, 2 Pick up, 3 Deliver and get signature, 4 Get paid, 5 Build reputation.
Key beats: unsure the forwarder will pay on time (low) / driver scans and signs at pickup, even offline (rising) / receiver signs on the phone (high) / payment is triggered once terms are met (peak) / verified track record wins better loads (high).
Opportunities: earnings tracker, simple language and voice prompts, WhatsApp-friendly share of delivery proof.

JOURNEY C: TOBI, IT and integration lead
Stages: 1 Evaluate and join, 2 Deploy node, 3 Connect TMS, 4 Go live, 5 Maintain.
Key beats: sceptical about security (low) / one-click deploy kit works (rising) / connector maps events cleanly (high) / first live shipment syncs (peak) / health dashboard explains issues in plain language (high).
Opportunities: sandbox network, sample payloads, upgrade notifications.

JOURNEY D: CHINEDU, warehouse and yard manager (condensed, 4 stages)
Truck arrives, Handover and inspection, Gate release, Dispute or close.
JOURNEY E: NGOZI, finance and claims (condensed, 4 stages)
Receive invoice, Match to events, Resolve dispute, Close and report.

For D and E, write plausible actions, emotions, pains and opportunities consistent with their persona cards.
```

### Prompt 5: User flows (FigJam, flowchart diagrams)

```text
In FigJam, draw five user flow diagrams for Zena using standard flowchart shapes: rounded rectangle = screen, diamond = decision, parallelogram = system action, rectangle with accent border = error or edge case. Label every arrow. Use midnight blue for screens, green for success endpoints, accent for waiting states, red for failures.

FLOW A: Join the network and deploy a node
Start > Apply to join (company details) > KYB review > Decision: approved? No > Request more documents > loop. Yes > Receive membership credential > Node setup wizard > Deploy node (one-click kit or hosted node) > System action: node syncs with network > Connect TMS or ERP > Test event > Go live > End.
Edge cases: sync fails > show plain-language fix; credential expired > renew flow.

FLOW B: Create a shipment and subcontract a carrier
Start > New shipment (origin, destination, cargo, dates) > Choose partner from member directory > Propose contract (rate, SLA, POD rules) > Decision: partner accepts? No > Counter-offer or cancel. Yes > System action: both parties sign contract > Shipment becomes Active > Notify driver app > End.

FLOW C: Dual-signed handover (offline-first)
Start > Driver opens job > Arrive at handover point > Capture photos and condition notes > Giving party signs > Receiving party signs > Decision: online? Yes > Submit > System action: publish signed event > Handover confirmed. No > Save locally, show "Queued" > Connection returns > Auto-sync > Handover confirmed.
Decision: do both signatures match the contract parties? No > flag "Needs action". Edge cases: receiver unavailable > time-boxed hold; damage reported > attach evidence and open a claim.

FLOW D: Proof of delivery to settlement
Start > Receiver signs POD > System action: check contract terms > Decision: terms met? Yes > Create settlement instruction > Payments partner pays carrier > Notify both parties > Reconciliation entry created > End. No > Hold disputed amount only > Notify both > Dispute flow: upload evidence > Counterparty responds > Decision: agreed? Yes > Release or adjust. No > Network mediation panel > Decision recorded > Settle.

FLOW E: Governance vote
Start > Member drafts proposal (rule change, fee, validator) > Discussion window > Decision: quorum reached? No > Extend or withdraw. Yes > Voting opens > Each member delegate votes > Decision: passes threshold? Yes > System action: schedule on-chain change > Notify all nodes > Upgrade applied > End. No > Archive with results.
```

### Prompt 6: Information architecture (FigJam, sitemap)

```text
In FigJam, draw the information architecture for Zena as a left-to-right sitemap tree, three levels deep. Colour by area: public = neutral, company app = midnight blue, mobile field app = green, governance and network operations = accent. Mark each node with a small icon for web, mobile or both, and add a red dot for "requires login".

PUBLIC
- Home (what Zena is, how it works, membership, trust)
- Network explorer (search a shipment ID, handover, or document fingerprint) > Verification result
- Join the network (eligibility, KYB application)
- Developers (API docs, sandbox, EPCIS mapping, node deploy guide)
- Governance transparency (public votes, charter, validator list)
- Sign in

COMPANY APP: ZENA HUB (web)
- Dashboard (active shipments, open handovers, disputes, settlements due)
- Shipments > List and filters > Shipment detail (overview, timeline, parties, documents, settlement) > Create shipment
- Partners and contracts > Member directory > Contract detail > Propose contract
- Handovers > Pending > Confirmed > Exceptions
- Settlement > Due and paid > Disputes > Evidence packs
- Documents (proof of delivery, bills, certificates)
- Analytics (on-time handovers, DSO, partner scorecards)
- Node and integrations > Node health > Connectors (TMS, ERP, telematics) > API keys
- Team and roles
- Settings (company, KYB, security, notifications, language)

FIELD APP (mobile, offline-first)
- Jobs > Job detail
- Handover (scan job code > capture > two signatures)
- Offline queue
- Earnings (for haulier drivers and owners)
- Profile and language

GOVERNANCE PORTAL
- Proposals > Draft > Discussion > Voting > Results
- Members and delegates
- Validators (rotation, performance)
- Fee and rule settings

NETWORK OPERATIONS CONSOLE (Zena stewards)
- Membership queue (KYB review)
- Dispute mediation panel
- Network health (blocks, validator status, anchoring)
- Audit log

Also produce a navigation model: primary nav per role, mobile bottom-nav (4 tabs max for the field app: Jobs, Handover, Queue, Profile), and global elements (language switch, notifications, network status pill, help).
```

### Prompt 7: Wireframes (Figma Design, low fidelity)

```text
Using the Zena context, personas and sitemap, create low-fidelity greyscale wireframes in Figma. Two frame sizes per screen where relevant: mobile 390 x 844 and desktop 1440 x 1024. Use boxes, placeholder text and real microcopy for buttons. Annotate each screen with its primary goal and primary action.

SCREENS
1 Public home and network explorer  2 Join the network (KYB application)  3 Node setup wizard  4 Hub dashboard  5 Shipments list  6 Shipment detail with two-party timeline  7 Create shipment and propose contract  8 Partners and contracts  9 Field handover (mobile only, two signatures)  10 Offline queue  11 Settlement and payments  12 Disputes and evidence pack  13 Integrations and node health  14 Governance proposals and voting  15 Network operations console.

RULES
- One primary action per screen. The state of a shipment and who must act next must be visible within 2 seconds.
- Every event shows both parties and their signature status (Signed, Awaiting, Needs action).
- Mobile: thumb-reachable actions at the bottom, no tables, use cards.
- Show empty, loading, error and offline states for screens 4, 5, 6 and 9.
```

### Prompt 8: High-fidelity UI

```text
Take the Zena wireframes and produce high-fidelity screens using ONLY the design system variables from the foundation page (colour, type, spacing, radius). Light theme first, then a dark variant of screens 4, 6, 9 and 14.

VISUAL DIRECTION
Calm, credible, enterprise-grade logistics software with a cooperative feel. Midnight blue app chrome, generous white space, green only for confirmed and primary actions, accent only for waiting, in-transit and attention. A subtle route-line motif (thin line with node dots) as a recurring graphic element; for the network, a small constellation of connected nodes. No stock-photo clutter; use simple vector illustrations for empty states.

KEY DETAILS
- Dashboard: four KPI cards (On-time handovers, Days sales outstanding, Open disputes, Settled this month), a live shipment table with party avatars, and a network status pill ("Network healthy, 12 validators").
- Shipment timeline: vertical stepper; each step shows time, place, and TWO signature avatars (giver and receiver) that fill green when both have signed; waiting state in accent; a monospace "event ID" chip in JetBrains Mono that copies on tap.
- Field handover (mobile): large step cards: photos, condition, giver signature, receiver signature, submit; always-visible offline banner with queue count.
- Settlement: timeline from POD to payout with clear "Held" amounts and one-tap evidence pack.
- Governance: proposal cards with a quorum progress bar and a clear Vote action.
- Microcopy: "Signed", "Awaiting receiver", "Handover confirmed", "Queued, will sync when you are online", "Settled". Never use blockchain, wallet, token or gas in the UI.
- Provide hover, focus, pressed and disabled states for all interactive components.
- Accessibility check: list any text/background pair under 4.5:1 and fix it.
```

### Prompt 9: Prototype and handoff

```text
Connect the Zena screens into clickable prototypes for FLOW A (join and deploy node), FLOW B (create shipment and subcontract), FLOW C (dual-signed offline handover), FLOW D (proof of delivery to settlement) and FLOW E (governance vote), exactly as drawn in the user flow diagrams. Use Smart Animate for the "Handover confirmed" moment (both signature avatars fill green, then the timeline step settles, 500ms ease-out) and for settlement status changes.

Then prepare developer handoff: name layers consistently (Screen/Section/Component/State), use auto layout everywhere, publish components and variables as a library, add Dev Mode annotations for spacing and behaviour, and export design tokens as JSON mapped to a Tailwind theme. Finish with a QA checklist: contrast, tap targets, empty/error/offline states, responsive breakpoints at 390, 768 and 1440, and focus order for keyboard users.
```

## Pitch deck prompt packs

One shared 12-slide storyline, then a separate pack for **Figma Slides**, **Microsoft PowerPoint (Copilot)** and **Canva**. Each pack has three prompts: set up the brand, build the deck, polish it. The content block is identical across tools, so paste it where each pack says so.

**Rule for every deck:** the prompts use \[bracketed placeholders\] wherever a number needs a real source (market size, pricing, traction). Don't let any tool invent statistics. Fill them with sourced figures before you present.

### Shared deck content (paste into any tool)

```text
Build a 12-slide pitch deck for ZENA, tagline "One record. Every carrier." Zena is a decentralised, blockchain-structured logistics network owned and run by logistics companies. Audience: seed investors, logistics company founders (potential founding members), and trade-finance and insurance partners. Tone: calm, credible, plain language. One idea per slide, headline states the takeaway (max 10 words), max 3 supporting points per slide. Never use the words blockchain or crypto in headlines; explain it as "a shared, tamper-evident record run by the members".

1 TITLE. Zena: One record. Every carrier. The shared logistics network owned by logistics companies. [Presenter name, date]
2 PROBLEM. Freight moves through handovers between companies that do not share a record. Result: disputes over proof of delivery, slow payment to carriers, status chasing by phone and WhatsApp, repeated data entry. Stat placeholders: [days to pay carriers + source], [share of shipments with disputes + source], [admin cost per shipment + source].
3 WHY NOW. Shippers and insurers demand real-time, verifiable tracking [cite]. Phones and telematics now reach every truck and yard. Earlier single-owner platforms closed because rivals would not join; a member-owned network fixes that. Regional trade growth under AfCFTA [verify and cite].
4 SOLUTION. Zena Network: a decentralised ledger run by logistics companies. Every shipment event and handover is signed by the parties involved. Contracts and payments follow the record automatically.
5 HOW IT WORKS. Four steps: Agree the contract > Sign every handover (both sides) > Verify proof of delivery > Settle automatically.
6 PRODUCT. Show four screens: Zena Hub dashboard, two-party shipment timeline, field handover app with offline queue, settlement and evidence pack. Caption each in one line.
7 TRUST ARCHITECTURE. Each company runs its own node and keeps its data private. Member validators run the shared network. Only signed fingerprints are shared, and a public chain anchors the history for audit. No single owner; rules change by member vote. Cost per shipment: [figure].
8 MARKET. Wedge: freight forwarders, hauliers and 3PLs on [first corridor, for example Lagos to Abuja, Kano and Port Harcourt]. Then nationwide, then West Africa, then pan-African corridors under AfCFTA. Show TAM/SAM/SOM as [figures + sources].
9 BUSINESS MODEL. Four revenue lines: annual membership by shipment volume, fee on settled shipments, fee on payments through Zena Settle, premium hosted node and data feeds for insurers and banks. Unit economics: [membership price], [shipments per member per year], [target members].
10 ROADMAP AND TRACTION. Phase 1 testnet with founding validators (months 1 to 4), Phase 2 dual-signed handovers, proof of delivery and TMS connectors (months 5 to 8), Phase 3 settlement with a licensed payments partner, public anchoring and corridor go-live (months 9 to 12), Phase 4 open membership and capacity marketplace (month 13 on). Traction so far: [founding members signed, LOIs, pilots].
11 COMPETITION. Compare Zena with spreadsheets, WhatsApp and point-to-point EDI; single-vendor TMS and visibility platforms; and owner-controlled consortium platforms. Criteria: member-owned governance, one shared record across competitors, dual-signed handovers, automated settlement, offline field use, Africa corridor focus.
12 TEAM AND ASK. Founder and advisors [names, one line each; add logistics operator, legal and payments advisors]. Raising [amount] for 18 months to fund the network, founding-member onboarding, audit, compliance and licensing. Milestones this unlocks: [3 milestones]. Contact details.

Add concise speaker notes (60 to 90 words) to every slide.
```

### Pack 1: Figma Slides

**Prompt F1: set up**

```text
Create a new Figma Slides deck, 16:9 (1920 x 1080), titled "Zena Pitch". Use Figma variables for brand colour: Midnight Blue 800 #0B1F3A, Midnight 900 #071326, Midnight 600 #1F4278, Verdant Green 500 #1FB36B, Verdant 700 #0E7A47, Verdant 50 #EEFBF4, neutrals #FFFFFF, #F5F7FA, #6B7A90, and the accent from the Zena design system (default Signal Amber #F5A524). Fonts: Space Grotesk for headlines, Inter for body.

Build slide templates: Title (midnight background, route-line motif), Section divider, Headline + 3 points, Big stat, Image + text, Comparison table, Roadmap timeline, Closing. Rules: headline 56 to 64pt, body 28pt minimum, 120px margins, max 3 bullets, white text only on Midnight or Verdant 700, route-line motif (thin line with node dots) as a subtle recurring graphic.
```

**Prompt F2: build**

```text
Using the templates just created, build the deck from the content below. Choose the best template for each slide. Use native shapes for diagrams (the 4-step flow on slide 5, the layered architecture on slide 7, the roadmap on slide 10) and a table for slide 11. For slide 6, drop in the screens from my design file frames [name frames] or placeholder phone and laptop frames if unavailable. Keep [bracketed placeholders] visible in accent colour so they are impossible to miss.

[PASTE: Shared deck content]
```

**Prompt F3: polish**

```text
Review the whole deck for consistency. Fix: any text under 28pt, any contrast pair under 4.5:1, uneven margins, inconsistent icon style, headlines over 10 words, more than 3 bullets, and orphaned words on the last line. Align elements to the grid, keep one accent per slide, and add Smart Animate transitions (fade, 300ms) between slides. Then list every remaining [placeholder] so I can fill it.
```

### Pack 2: Microsoft PowerPoint (Copilot)

**Prompt P1: set up the theme** (do this manually or ask Copilot to guide you)

```text
Help me set up a custom PowerPoint theme for Zena. Colours: Dark 1 #0B1F3A, Light 1 #FFFFFF, Dark 2 #071326, Light 2 #F5F7FA, Accent 1 #1FB36B, Accent 2 #14305A, Accent 3 #F5A524, Accent 4 #4C8DFF, Accent 5 #0E7A47, Accent 6 #6B7A90. Fonts: headings Space Grotesk, body Inter. If those fonts are not installed, use Aptos Display and Aptos, and tell me how to embed fonts before sharing. Set 16:9. Create slide master layouts: Title, Section header, Title and content (max 3 bullets), Two content, Comparison, Picture with caption, Closing. Midnight blue title background, white text; light content slides with midnight headlines. Minimum body size 24pt.
```

**Prompt P2: build the deck in Copilot**

```text
Create a 12-slide presentation using my current theme and layouts. Use SmartArt or shapes for the process flow (slide 5), layered diagram (slide 7) and roadmap (slide 10), and a table for slide 11. Add alt text to every image and diagram. Put speaker notes on every slide. Leave all [bracketed placeholders] highlighted in yellow text so I can find them.

[PASTE: Shared deck content]
```

**Prompt P3: refine**

```text
Review this deck as a seed investor would. For each slide, tell me in one line: is the headline a takeaway, is the visual earning its place, what question will an investor ask. Then fix layout issues: text under 24pt, more than 3 bullets, misaligned objects, low-contrast text. Apply Morph transitions only between slides 4 and 5, and simple Fade elsewhere. Create a 6-slide short version for a 3-minute pitch (slides 1, 2, 4, 5, 9, 12) as a custom show. Finally, list all remaining placeholders and check Accessibility.
```

### Pack 3: Canva

**Prompt C1: brand kit**

```text
Set up a Canva Brand Kit named "Zena". Colours: Midnight Blue #0B1F3A, Deep Midnight #071326, Mid Blue #1F4278, Verdant Green #1FB36B, Dark Green #0E7A47, Mint #EEFBF4, Signal Amber #F5A524 (accent), Light Grey #F5F7FA, Slate #6B7A90. Fonts: Space Grotesk for headings and Inter for body if available in Canva's library, otherwise Montserrat for headings and DM Sans for body. Style: calm, credible enterprise logistics software with a cooperative feel, flat vector graphics, thin route lines with node dots, small constellation-of-nodes motif, no stock-photo clutter. Logo: lowercase wordmark "zena" beside a geometric Z drawn as a route line with three green node dots.
```

**Prompt C2: build with Magic Design / Magic Slides**

```text
Create a 16:9 presentation using the Zena Brand Kit. Style: modern, minimal, midnight blue and green with amber highlights. Use large headlines, lots of white space, simple icons and flat vector illustrations (container ship, truck, phone scanning a QR code, shield with check mark). Use charts or diagrams where the content describes a flow, comparison or timeline. Keep placeholders in [brackets] and highlight them in amber.

[PASTE: Shared deck content]
```

**Prompt C3: polish and present**

```text
Review the deck and fix: inconsistent fonts or colours, text smaller than 24pt, more than 3 bullets per slide, low-contrast text, uneven spacing. Replace any generic stock photos with flat vector illustrations in the brand palette. Add subtle Rise or Fade page animations, no flashy transitions. Make slide 5 an animated four-step flow. Add presenter notes to every slide. Prepare exports: PDF for sending, a share link in view-only mode, and a 6-slide short version (slides 1, 2, 4, 5, 9, 12).
```

**Which tool when:** use **Figma Slides** if you want the deck to share components with your product design, **PowerPoint** if investors or partners will edit it, and **Canva** for the fastest polished result with minimal setup.
