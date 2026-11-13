# Zena Network — Shared Logistics & Settlement PWA Engine

> **One record. Every carrier.**  
> Self-contained, responsive Progressive Web Application (PWA) with offline-first handover queue, camera QR scanning, dual-signature custody verification, automated banking settlement simulation, and Hyperledger Besu QBFT node management.

---

## Quick Start

### Option 1: Zero-Dependency Node.js Local Server (Recommended for PWA & Camera)

```bash
# From workspace root
node pwa/serve.js

# Or using pnpm
pnpm pwa
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome, Edge, Safari, or mobile browser.

### Option 2: Direct File Open

You can also directly double-click `pwa/index.html` in Windows Explorer. All core UI views, states, localStorage persistence, and signature pads function seamlessly. _(Note: Service Workers and live camera streams require `localhost` / `https` per browser security standards)._

---

## Architecture & Wireframe Implementation (Figma Sections 04 – 16)

| Module                               | Wireframe Section | Capabilities & Specifications                                                                                                                                                                                                                                                             |
| :----------------------------------- | :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Operations Dashboard**          | Section 04        | 4 KPI cards (Active Consignments, Pending Signatures, Unsettled Value, 100% QBFT sync), Actionable handover task list, Settlement liquidity preview, Quick Create CTA.                                                                                                                    |
| **2. Shipment List & Filter Engine** | Section 05        | Search by ID/cargo/carrier, filter tabs (`All`, `In-Transit`, `Pending Sign-off`, `Settled`), interactive **Wireframe State Switcher** (`Populated`, `Loading Skeleton`, `Error 500`, `Offline with Cache Timestamp`, `Empty State`). Responsive Data Table (Desktop) and Cards (Mobile). |
| **3. Four-Step Shipment Wizard**     | Section 06        | Step 1 (Cargo details), Step 2 (Carrier & SLA terms), Step 3 (Evidence rules), Step 4 (Cryptographic EPCIS 2.0 JSON preview with live SHA-256 hash generation).                                                                                                                           |
| **4. Custody Timeline & Dual-Sign**  | Section 07        | Multi-party custody chain with Giver/Receiver sign-off status, event timestamps, monospace IDs, and interactive **HTML5 Canvas Signature Pad** (demo only: the PWA currently produces an unsigned SHA-256 digest; real EIP-712 signing is not wired up yet).                              |
| **5. Field Scan & Offline Queue**    | Sections 09 & 10  | Camera stream (`getUserMedia`) with animated reticle, snapshot photo capture, mock QR scan, manual override, and **IndexedDB store (`zena_offline_queue`)** with auto-sync and manual "Force Sync".                                                                                       |
| **6. Contract Settlements & Vault**  | Sections 11 & 13  | Verified POD condition checks, financial breakdown (€28,800 freight rate, €0 dispute holds), automated banking release simulation, Cryptographic Receipt modal, and downloadable Evidence Pack.                                                                                           |
| **7. Node Admin & Governance**       | Sections 14 & 16  | Hyperledger Besu QBFT local node health, 2-second deterministic block ticker, 4 active validator nodes ($F=1, Q=3$), and Consortium Proposal Voting with live quorum bars.                                                                                                                |

---

## Design System Tokens

- **Backgrounds**: Dark `#0D0F12` (deep), `#14171D` (surface), `#1E222B` (elevated cards).
- **Borders**: `#2E3440` (subtle gray).
- **Text**: `#F8FAFC` (primary), `#94A3B8` (muted), `#64748B` (subtle).
- **Operational Accents**:
  - In-Transit / Active: Blue `#3B82F6`
  - Pending Sign-off: Amber `#F59E0B`
  - Verified / Settled: Emerald `#10B981`
  - Error / Dispute: Crimson `#EF4444`
