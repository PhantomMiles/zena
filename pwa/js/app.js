/**
 * Zena Network — Application Controller & UI Coordinator (ES6 Modular Architecture)
 */

import { initDB, enqueueHandover, getQueuedHandovers, markAsSynced } from './db.js'
import { startCamera, stopCamera, captureFrame } from './camera.js'
import { SignaturePad, computeLocalDigest } from './signature.js'
import {
  getShipments,
  getShipmentById,
  setSimulationState,
  getSimulationState,
  createNewShipment,
  attachEventSignature,
} from './shipments.js'
import {
  getSettlementDetails,
  executeReleaseSettlement,
  generateEvidencePack,
  SETTLEMENT_METRICS,
} from './settlements.js'
import { startBlockTicker, getValidators, getProposals, castProposalVote } from './node-gov.js'

// Application State
const state = {
  currentView: 'dashboard',
  isOnline: navigator.onLine,
  offlineTimeMinutes: 14,
  activeCompany: 'Astraea Logistics',
  activeNode: 'node-astraea-01 (0xFE3B...Bd73)',
  selectedShipmentId: 'ZN-26041',
  filterStatus: 'ALL',
  searchQuery: '',
  wizardStep: 1,
  wizardData: {},
  signaturePad: null,
  activeSigningEventId: null,
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Zena App] Initializing UI Engine')

  // Initialize DB
  await initDB()

  // Register Service Worker if supported and running under http/https
  if (
    'serviceWorker' in navigator &&
    (window.location.protocol.startsWith('http') || window.location.hostname === 'localhost')
  ) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('[Zena App] ServiceWorker registered with scope:', reg.scope)
        // Listen for background sync messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SYNC_TRIGGERED') {
            syncOfflineQueue()
          }
        })
      })
      .catch((err) => {
        console.warn('[Zena App] ServiceWorker registration skipped:', err)
      })
  }

  // Setup DOM Listeners & Components
  setupNavigation()
  setupNetworkMonitoring()
  setupSimulationControls()
  setupWizardModal()
  setupSignatureModal()
  setupScanView()
  setupSettlementView()
  setupNodeAndGovernanceView()

  // Initialize Lucide icons if loaded
  if (window.lucide) {
    window.lucide.createIcons()
  }

  // Start QBFT block ticker
  startBlockTicker((blockInfo) => {
    const el = document.getElementById('qbftBlockTicker')
    if (el) {
      el.textContent = `Block #${blockInfo.blockNumber}`
    }
  })

  // Render initial view
  renderCurrentView()
  updateOfflineQueueBadge()
})

// ==========================================================================
// NAVIGATION & VIEW ROUTING
// ==========================================================================
function setupNavigation() {
  // Desktop Nav Items
  const navItems = document.querySelectorAll('.nav-item[data-view]')
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view')
      navigateToView(targetView)
    })
  })

  // Mobile Bottom Nav Tabs
  const mobileTabs = document.querySelectorAll('.mobile-nav-tab[data-view]')
  mobileTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view')
      navigateToView(targetView)
    })
  })

  // Member Company Dropdown Switcher
  const companySelect = document.getElementById('companySelector')
  if (companySelect) {
    companySelect.addEventListener('change', (e) => {
      state.activeCompany = e.target.value
      showToast(`Switched active node context to: ${state.activeCompany}`, 'info')
      renderCurrentView()
    })
  }

  // Quick "+ Create Shipment" Button in top bar
  const quickCreateBtn = document.getElementById('topCreateShipmentBtn')
  if (quickCreateBtn) {
    quickCreateBtn.addEventListener('click', () => openCreateShipmentModal())
  }
}

export function navigateToView(viewName) {
  // Stop camera if leaving scanner
  if (state.currentView === 'scan' && viewName !== 'scan') {
    stopCamera()
  }

  state.currentView = viewName

  // Update desktop active state
  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName)
  })

  // Update mobile active state
  document.querySelectorAll('.mobile-nav-tab[data-view]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName)
  })

  // Toggle View Panels
  document.querySelectorAll('.view-panel').forEach((panel) => {
    panel.classList.remove('active')
  })

  const activePanel = document.getElementById(`view-${viewName}`)
  if (activePanel) {
    activePanel.classList.add('active')
  }

  // Update Topbar View Title
  const titleEl = document.getElementById('topViewTitle')
  const subEl = document.getElementById('topViewSubtitle')
  if (titleEl && subEl) {
    switch (viewName) {
      case 'dashboard':
        titleEl.textContent = 'Operations Dashboard'
        subEl.textContent = `${state.activeCompany} — Node Active`
        break
      case 'shipments':
        titleEl.textContent = 'Shipments & Custody'
        subEl.textContent = 'Search, filters and multi-party sign-offs'
        break
      case 'scan':
        titleEl.textContent = 'Field Scan & Handover'
        subEl.textContent = 'Offline-first camera scan & dual-signatures'
        break
      case 'queue':
        titleEl.textContent = 'Offline Handover Queue'
        subEl.textContent = 'Local IndexedDB store pending node sync'
        break
      case 'settlements':
        titleEl.textContent = 'Contract Settlements & Vault'
        subEl.textContent = 'Conditional fund release & audit packs'
        break
      case 'node':
        titleEl.textContent = 'Besu QBFT Node Admin'
        subEl.textContent = 'Consortium health, peers and cryptographic keys'
        break
      case 'governance':
        titleEl.textContent = 'Network Governance Portal'
        subEl.textContent = 'Consortium member voting and protocol proposals'
        break
      default:
        titleEl.textContent = 'Zena Network'
    }
  }

  renderCurrentView()

  // If scan view, initialize camera
  if (viewName === 'scan') {
    const video = document.getElementById('scannerVideo')
    startCamera(video)
  }

  // Re-run icons
  if (window.lucide) {
    window.lucide.createIcons()
  }
}

function renderCurrentView() {
  switch (state.currentView) {
    case 'dashboard':
      renderDashboardView()
      break
    case 'shipments':
      renderShipmentsView()
      break
    case 'queue':
      renderQueueView()
      break
    case 'settlements':
      renderSettlementView()
      break
    case 'node':
      renderNodeAdminView()
      break
    case 'governance':
      renderGovernanceView()
      break
  }
}

// ==========================================================================
// NETWORK STATUS & OFFLINE ENGINE
// ==========================================================================
function setupNetworkMonitoring() {
  const offlineBanner = document.getElementById('offlineBanner')
  const toggleBtn = document.getElementById('networkToggleBtn')
  const dotIndicator = document.getElementById('nodeStatusDot')
  const dotText = document.getElementById('nodeStatusText')

  function updateNetworkUI() {
    if (state.isOnline) {
      if (offlineBanner) offlineBanner.classList.add('hidden')
      if (toggleBtn) {
        toggleBtn.classList.remove('offline-mode')
        toggleBtn.innerHTML = `<span class="status-dot"></span><span>Online / Synced</span>`
      }
      if (dotIndicator) dotIndicator.classList.remove('offline')
      if (dotText) dotText.textContent = 'QBFT 4/4 Connected'
    } else {
      if (offlineBanner) {
        offlineBanner.classList.remove('hidden')
        document.getElementById('offlineMinutesText').textContent =
          `${state.offlineTimeMinutes} min ago`
      }
      if (toggleBtn) {
        toggleBtn.classList.add('offline-mode')
        toggleBtn.innerHTML = `<span class="status-dot offline"></span><span>Offline Mode</span>`
      }
      if (dotIndicator) dotIndicator.classList.add('offline')
      if (dotText) dotText.textContent = 'Offline (Local Node)'
    }
  }

  // Browser online/offline event hooks
  window.addEventListener('online', () => {
    state.isOnline = true
    updateNetworkUI()
    showToast('Network connection re-established. Syncing queued items...', 'success')
    syncOfflineQueue()
  })

  window.addEventListener('offline', () => {
    state.isOnline = false
    updateNetworkUI()
    showToast('Network connection lost. Switched to offline-first cache mode.', 'warning')
  })

  // Interactive toggle button for user testing in browser
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.isOnline = !state.isOnline
      updateNetworkUI()
      if (state.isOnline) {
        showToast('Toggled to Online Mode. Live updates enabled.', 'success')
        syncOfflineQueue()
      } else {
        showToast('Toggled to Offline Mode. Field handovers will queue locally.', 'warning')
      }
      renderCurrentView()
    })
  }

  // Force sync button on offline banner
  const bannerSyncBtn = document.getElementById('bannerSyncBtn')
  if (bannerSyncBtn) {
    bannerSyncBtn.addEventListener('click', () => {
      syncOfflineQueue()
    })
  }

  updateNetworkUI()
}

export async function updateOfflineQueueBadge() {
  const items = await getQueuedHandovers()
  const count = items.length
  const badges = document.querySelectorAll('.offline-queue-count')
  badges.forEach((b) => {
    b.textContent = count
    b.style.display = count > 0 ? 'inline-flex' : 'none'
  })
}

export async function syncOfflineQueue() {
  const items = await getQueuedHandovers()
  if (items.length === 0) {
    showToast('Offline queue is clean. Zero items pending sync.', 'info')
    return
  }

  showToast(
    `Demo: marking ${items.length} queued handover(s) as synced (no network call is made).`,
    'info',
  )

  for (const item of items) {
    await new Promise((r) => setTimeout(r, 600)) // DEMO: simulated delay, no ledger call
    await markAsSynced(item.id)
  }

  await updateOfflineQueueBadge()
  showToast('Demo: queue cleared locally. Nothing was submitted to Besu.', 'info')
  renderCurrentView()
}

// ==========================================================================
// MODULE 1: DASHBOARD VIEW
// ==========================================================================
function renderDashboardView() {
  const shipments = getShipments()
  const activeCount = shipments.filter((s) => s.status === 'IN_TRANSIT').length
  const pendingCount = shipments.filter((s) => s.dualSignatureStatus !== 'FULLY_SIGNED').length

  const activeCountEl = document.getElementById('dashActiveShipments')
  const pendingCountEl = document.getElementById('dashPendingHandovers')
  const unsettledValueEl = document.getElementById('dashUnsettledValue')

  if (activeCountEl) activeCountEl.textContent = activeCount
  if (pendingCountEl) pendingCountEl.textContent = pendingCount
  if (unsettledValueEl)
    unsettledValueEl.textContent = `€${SETTLEMENT_METRICS.eligibleForReleaseEur.toLocaleString()}`

  // Render Actionable Tasks
  const taskListEl = document.getElementById('dashActionTaskList')
  if (taskListEl) {
    const actionRequired = shipments.filter((s) => s.dualSignatureStatus !== 'FULLY_SIGNED')
    if (actionRequired.length === 0) {
      taskListEl.innerHTML = `<div class="empty-state-box">All custody handovers signed and verified.</div>`
    } else {
      taskListEl.innerHTML = actionRequired
        .map(
          (s) => `
        <div class="task-item">
          <div class="task-left">
            <span class="task-code">${s.id} · ${s.cargo.split('—')[0]}</span>
            <span class="task-desc">${s.nextStep}</span>
            <span class="task-meta">${s.movement} · ${s.lastEventTime}</span>
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.zenaApp.openShipmentDetail('${s.id}')">
            View / Sign
          </button>
        </div>
      `,
        )
        .join('')
    }
  }

  // Dashboard Create Shipment CTA
  const dashCreateBtn = document.getElementById('dashCreateShipmentBtn')
  if (dashCreateBtn) {
    dashCreateBtn.onclick = () => openCreateShipmentModal()
  }
}

// ==========================================================================
// MODULE 2: SHIPMENTS & FILTER ENGINE (SECTION 05)
// ==========================================================================
function setupSimulationControls() {
  const buttons = document.querySelectorAll('.state-btn[data-state]')
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      const targetState = btn.getAttribute('data-state')
      setSimulationState(targetState)
      renderShipmentsView()
    })
  })

  // Filter tabs
  const tabPills = document.querySelectorAll('.tab-pill[data-filter]')
  tabPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      tabPills.forEach((p) => p.classList.remove('active'))
      pill.classList.add('active')
      state.filterStatus = pill.getAttribute('data-filter')
      renderShipmentsView()
    })
  })

  // Search input
  const searchInput = document.getElementById('shipmentSearchInput')
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase()
      renderShipmentsView()
    })
  }
}

function renderShipmentsView() {
  const container = document.getElementById('shipmentListContainer')
  if (!container) return

  const simState = getSimulationState()

  // Handle Simulation States from Wireframe Section 05
  if (simState === 'LOADING') {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <p style="color: var(--text-muted); margin-bottom: 16px;">Loading shipments from consortium node...</p>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
    `
    return
  }

  if (simState === 'ERROR') {
    container.innerHTML = `
      <div class="error-state-card">
        <div class="error-state-icon">
          <i data-lucide="alert-triangle"></i>
        </div>
        <h3 class="error-title">Shipment list unavailable</h3>
        <p class="error-desc">
          Your search couldn't complete. We haven't connected or shipments list timed out. [ Request failed — URP 500 ].
          Check your connection and try again. Your current search and filters will be kept.
        </p>
        <div style="display: flex; gap: 12px; margin-top: 8px;">
          <button class="btn btn-secondary" onclick="window.zenaApp.retryShipmentsFetch()">Try again</button>
          <button class="btn btn-outline" onclick="window.zenaApp.showToast('Support ticket logged with node admin.', 'info')">Contact support</button>
        </div>
      </div>
    `
    if (window.lucide) window.lucide.createIcons()
    return
  }

  if (simState === 'EMPTY') {
    container.innerHTML = `
      <div class="panel-card empty-state-box">
        <i data-lucide="box" style="width: 40px; height: 40px; margin-bottom: 12px; color: var(--text-subtle);"></i>
        <h3>No shipments registered</h3>
        <p style="margin-top: 6px; font-size: 13px;">Create a new shipment consignment to initialize the custody chain.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="window.zenaApp.openCreateShipmentModal()">
          + Create Shipment
        </button>
      </div>
    `
    if (window.lucide) window.lucide.createIcons()
    return
  }

  // Filter Shipments
  let items = getShipments()

  if (state.filterStatus === 'IN_TRANSIT') {
    items = items.filter((s) => s.status === 'IN_TRANSIT')
  } else if (state.filterStatus === 'PENDING') {
    items = items.filter((s) => s.dualSignatureStatus !== 'FULLY_SIGNED')
  } else if (state.filterStatus === 'SETTLED') {
    items = items.filter((s) => s.status === 'VERIFIED_SETTLED')
  }

  if (state.searchQuery) {
    items = items.filter(
      (s) =>
        s.id.toLowerCase().includes(state.searchQuery) ||
        s.cargo.toLowerCase().includes(state.searchQuery) ||
        s.route.toLowerCase().includes(state.searchQuery) ||
        s.parties.carrier.toLowerCase().includes(state.searchQuery),
    )
  }

  const isOfflineSim = simState === 'OFFLINE' || !state.isOnline
  const offlineNoticeHtml = isOfflineSim
    ? `
    <div style="background: var(--accent-amber-bg); border: 1px solid var(--accent-amber-border); color: var(--accent-amber); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
      <span>⚠ Offline — saved 14 min ago. Live updates and registered sign-offs may have changed.</span>
      <button class="offline-banner-btn" onclick="window.zenaApp.syncOfflineQueue()">Sync now</button>
    </div>
  `
    : ''

  // Render Desktop Data Table
  const tableRowsHtml = items
    .map((s) => {
      let statusChipClass = 'chip-blue'
      if (s.dualSignatureStatus === 'FULLY_SIGNED') statusChipClass = 'chip-emerald'
      if (s.dualSignatureStatus === 'NONE') statusChipClass = 'chip-amber'

      return `
      <tr>
        <td><input type="checkbox"></td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span class="mono-id">${s.id}</span>
            <span style="font-size: 12px; color: var(--text-muted);">${s.cargo}</span>
          </div>
        </td>
        <td>
          <span class="chip ${statusChipClass}">${s.statusLabel}</span>
          <div style="font-size: 11px; color: var(--text-subtle); margin-top: 4px;">${s.dualSignatureLabel}</div>
        </td>
        <td>
          <div style="font-size: 12px;">${s.route}</div>
          <div style="font-size: 11px; color: var(--text-subtle);">${s.quantity}</div>
        </td>
        <td>
          <div style="font-size: 12px;">${s.nextStep}</div>
          <div style="font-size: 11px; color: var(--text-subtle);">${s.lastEventTime}</div>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-outline btn-sm" onclick="window.zenaApp.openShipmentDetail('${s.id}')">
            Timeline / Sign
          </button>
        </td>
      </tr>
    `
    })
    .join('')

  // Render Mobile Cards
  const mobileCardsHtml = items
    .map(
      (s) => `
    <div class="mobile-shipment-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="mono-id" style="font-size: 14px;">${s.id} · ${s.cargo.split('—')[0]}</span>
        <span class="chip ${s.dualSignatureStatus === 'FULLY_SIGNED' ? 'chip-emerald' : 'chip-amber'}">${s.statusLabel}</span>
      </div>
      <div style="font-size: 12px; color: var(--text-muted);">${s.route} · ${s.quantity}</div>
      <div style="font-size: 11px; color: var(--accent-blue);">${s.dualSignatureLabel} — ${s.nextStep}</div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="window.zenaApp.openShipmentDetail('${s.id}')">
          View Detail
        </button>
      </div>
    </div>
  `,
    )
    .join('')

  container.innerHTML = `
    ${offlineNoticeHtml}
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th width="30"></th>
            <th>Shipment / ID</th>
            <th>Movement & Sign-off</th>
            <th>Route / Quantity</th>
            <th>Next Step</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
    <div class="mobile-cards-list">
      ${mobileCardsHtml}
    </div>
  `

  if (window.lucide) window.lucide.createIcons()
}

// ==========================================================================
// MODULE 3: FOUR-STEP SHIPMENT CREATION WIZARD (SECTION 06)
// ==========================================================================
function setupWizardModal() {
  const modal = document.getElementById('createShipmentModal')
  const closeBtn = document.getElementById('closeWizardModalBtn')
  const cancelBtn = document.getElementById('cancelWizardBtn')
  const prevBtn = document.getElementById('wizardPrevBtn')
  const nextBtn = document.getElementById('wizardNextBtn')

  if (closeBtn) closeBtn.onclick = () => closeCreateShipmentModal()
  if (cancelBtn) cancelBtn.onclick = () => closeCreateShipmentModal()

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (state.wizardStep > 1) {
        setWizardStep(state.wizardStep - 1)
      }
    }
  }

  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (state.wizardStep < 4) {
        setWizardStep(state.wizardStep + 1)
      } else {
        // Step 4: Dispatch to Consortium Node
        await submitShipmentCreation()
      }
    }
  }
}

export function openCreateShipmentModal() {
  state.wizardStep = 1
  state.wizardData = {
    cargo: 'Sesame',
    quantity: '24 metric tonnes',
    category: 'Agricultural Export',
    origin: 'Kano Highway Hub',
    destination: 'Apapa Port Terminal, Lagos',
    sender: 'Amira Logistics (Kano)',
    receiver: 'North Sea Terminals (Apapa)',
    carrierName: 'Intercity Haulage',
    carrierNode: '0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10',
    rateEur: 28800,
    slaHours: 36,
    disputeTerms: 'Freeze disputed variance only upon claim upload',
  }

  setWizardStep(1)
  const modal = document.getElementById('createShipmentModal')
  if (modal) modal.classList.add('active')
}

export function closeCreateShipmentModal() {
  const modal = document.getElementById('createShipmentModal')
  if (modal) modal.classList.remove('active')
}

function setWizardStep(step) {
  state.wizardStep = step

  // Update Step Tabs
  document.querySelectorAll('.step-tab').forEach((tab, index) => {
    const stepNum = index + 1
    tab.classList.toggle('active', stepNum === step)
    tab.classList.toggle('completed', stepNum < step)
  })

  // Update Panes
  document.querySelectorAll('.wizard-step-pane').forEach((pane, index) => {
    pane.classList.toggle('active', index + 1 === step)
  })

  // Update Button text
  const prevBtn = document.getElementById('wizardPrevBtn')
  const nextBtn = document.getElementById('wizardNextBtn')
  if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible'
  if (nextBtn) {
    nextBtn.textContent = step === 4 ? 'Commit & Dispatch' : 'Continue'
    nextBtn.className = step === 4 ? 'btn btn-primary' : 'btn btn-blue'
  }

  // If Step 4: Generate JSON preview & Cryptographic Hash
  if (step === 4) {
    updateWizardReviewJson()
  }
}

async function updateWizardReviewJson() {
  const jsonPreviewEl = document.getElementById('wizardJsonPreview')
  const hashPreviewEl = document.getElementById('wizardHashPreview')

  const payload = {
    protocol: 'ZENA_EPCIS_2.0',
    consortiumNode: state.activeNode,
    consignment: {
      cargo: state.wizardData.cargo,
      quantity: state.wizardData.quantity,
      corridor: `${state.wizardData.origin} → ${state.wizardData.destination}`,
      sender: state.wizardData.sender,
      carrier: state.wizardData.carrierName,
      receiver: state.wizardData.receiver,
    },
    settlementContract: {
      currency: 'EUR',
      agreedRate: state.wizardData.rateEur,
      slaHours: state.wizardData.slaHours,
    },
    createdTimestamp: new Date().toISOString(),
  }

  if (jsonPreviewEl) {
    jsonPreviewEl.textContent = JSON.stringify(payload, null, 2)
  }

  if (hashPreviewEl) {
    const hash = await computeLocalDigest(JSON.stringify(payload))
    hashPreviewEl.textContent = hash.digest.slice(0, 36) + '... (SHA-256 digest, unsigned)'
  }
}

async function submitShipmentCreation() {
  const nextBtn = document.getElementById('wizardNextBtn')
  if (nextBtn) {
    nextBtn.disabled = true
    nextBtn.textContent = 'Broadcasting to Node...'
  }

  await new Promise((r) => setTimeout(r, 800)) // node latency simulation

  const newShipment = await createNewShipment(state.wizardData)
  closeCreateShipmentModal()
  showToast(`Shipment ${newShipment.id} saved locally (demo). Not yet submitted to Besu.`, 'info')

  if (nextBtn) nextBtn.disabled = false
  navigateToView('shipments')
}

// ==========================================================================
// MODULE 4: SHIPMENT DETAIL & DUAL-SIGNATURE TIMELINE (SECTION 07)
// ==========================================================================
export function openShipmentDetail(shipmentId) {
  const shipment = getShipmentById(shipmentId)
  if (!shipment) return

  state.selectedShipmentId = shipmentId
  const modal = document.getElementById('shipmentDetailModal')
  if (!modal) return

  // Header data
  document.getElementById('detailShipmentId').textContent = `${shipment.id} · ${shipment.cargo}`
  document.getElementById('detailShipmentHash').textContent = shipment.hash.slice(0, 24) + '...'

  // Left Meta Panel
  document.getElementById('detailMetaSender').textContent = shipment.parties.shipper
  document.getElementById('detailMetaCarrier').textContent = shipment.parties.carrier
  document.getElementById('detailMetaReceiver').textContent = shipment.parties.consignee
  document.getElementById('detailMetaRoute').textContent = shipment.route
  document.getElementById('detailMetaRate').textContent = `€${shipment.rateEur.toLocaleString()}`

  // Custody Timeline
  const timelineContainer = document.getElementById('detailCustodyTimeline')
  if (timelineContainer) {
    timelineContainer.innerHTML = shipment.events
      .map((evt, idx) => {
        const isDualSigned = evt.giverSigned && evt.receiverSigned
        return `
        <div class="timeline-event-card">
          <div class="timeline-node-dot ${isDualSigned ? 'completed' : 'pending'}"></div>
          <div class="timeline-header">
            <span class="timeline-title">${evt.id}: ${evt.title}</span>
            <span class="timeline-timestamp">${evt.timestamp}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted);">${evt.location}</p>

          <div class="parties-dual-sign-bar">
            <div class="sign-party">
              <span class="sign-status-icon ${evt.giverSigned ? 'signed' : 'waiting'}">
                ${evt.giverSigned ? '✓' : '•'}
              </span>
              <span>Giver: <strong>${evt.giverName}</strong> (${evt.giverSigned ? 'Signed' : 'Awaiting'})</span>
            </div>
            <div class="sign-party">
              <span class="sign-status-icon ${evt.receiverSigned ? 'signed' : 'waiting'}">
                ${evt.receiverSigned ? '✓' : '•'}
              </span>
              <span>Receiver: <strong>${evt.receiverName}</strong> (${evt.receiverSigned ? 'Signed' : 'Pending'})</span>
            </div>
            ${
              !evt.receiverSigned
                ? `
              <button class="btn btn-primary btn-sm" style="margin-left: auto;" onclick="window.zenaApp.openSignatureModal('${shipment.id}', '${evt.id}')">
                Sign Handover
              </button>
            `
                : ''
            }
          </div>
        </div>
      `
      })
      .join('')
  }

  modal.classList.add('active')
}

export function closeShipmentDetail() {
  const modal = document.getElementById('shipmentDetailModal')
  if (modal) modal.classList.remove('active')
}

// ==========================================================================
// DUAL-SIGNATURE MODAL (CANVAS SIGNATURE PAD)
// ==========================================================================
function setupSignatureModal() {
  const modal = document.getElementById('signaturePadModal')
  const canvas = document.getElementById('signaturePadCanvas')
  const clearBtn = document.getElementById('clearSigBtn')
  const submitBtn = document.getElementById('confirmSigBtn')
  const closeBtn = document.getElementById('closeSigModalBtn')

  if (canvas) {
    state.signaturePad = new SignaturePad(canvas)
  }

  if (clearBtn && state.signaturePad) {
    clearBtn.onclick = () => state.signaturePad.clear()
  }

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active')
  }

  if (submitBtn) {
    submitBtn.onclick = async () => {
      if (!state.signaturePad || !state.signaturePad.hasSignature) {
        showToast('Please provide a handwritten signature or use Cryptographic Sign.', 'warning')
        return
      }

      submitBtn.disabled = true
      submitBtn.textContent = 'Broadcasting Signature...'

      const cryptoSig = await computeLocalDigest(
        `HANDOVER:${state.selectedShipmentId}:${state.activeSigningEventId}`,
      )
      attachEventSignature(
        state.selectedShipmentId,
        state.activeSigningEventId,
        state.activeCompany,
        cryptoSig.digest,
      )

      submitBtn.disabled = false
      submitBtn.textContent = 'Confirm & Sign'
      modal.classList.remove('active')

      showToast(
        'Handwritten sign-off saved on this device (demo). Not signed on-chain or sent to Besu.',
        'info',
      )
      openShipmentDetail(state.selectedShipmentId)
      renderDashboardView()
    }
  }

  // Quick Cryptographic Node Key Signing Button
  const cryptoQuickBtn = document.getElementById('cryptoQuickSignBtn')
  if (cryptoQuickBtn) {
    cryptoQuickBtn.onclick = async () => {
      const cryptoSig = await computeLocalDigest(
        `NODE_KEY_DEMO:${state.selectedShipmentId}:${state.activeSigningEventId}`,
      )
      attachEventSignature(
        state.selectedShipmentId,
        state.activeSigningEventId,
        `${state.activeCompany} (demo node key)`,
        cryptoSig.digest,
      )
      modal.classList.remove('active')
      showToast(
        'Demo only: no node key is connected, so nothing was cryptographically signed.',
        'warning',
      )
      openShipmentDetail(state.selectedShipmentId)
      renderDashboardView()
    }
  }
}

export function openSignatureModal(shipmentId, eventId) {
  state.selectedShipmentId = shipmentId
  state.activeSigningEventId = eventId
  const modal = document.getElementById('signaturePadModal')
  if (modal) {
    modal.classList.add('active')
    if (state.signaturePad) {
      setTimeout(() => state.signaturePad.resize(), 100)
    }
  }
}

// ==========================================================================
// MODULE 5: FIELD SCAN & OFFLINE QUEUE (SECTION 09 & 10)
// ==========================================================================
function setupScanView() {
  const snapBtn = document.getElementById('snapPhotoBtn')
  const mockScanBtn = document.getElementById('mockScanQrBtn')
  const submitFieldBtn = document.getElementById('submitFieldHandoverBtn')

  if (snapBtn) {
    snapBtn.onclick = () => {
      const video = document.getElementById('scannerVideo')
      const photoUrl = captureFrame(video)
      const previewImg = document.getElementById('capturedPhotoPreview')
      if (previewImg && photoUrl) {
        previewImg.src = photoUrl
        previewImg.style.display = 'block'
        showToast('Proof photo captured from camera stream.', 'info')
      }
    }
  }

  if (mockScanBtn) {
    mockScanBtn.onclick = () => {
      document.getElementById('fieldShipmentCodeInput').value = 'ZN-26041'
      document.getElementById('fieldHandoverNoteInput').value =
        'Container seal intact. Weight verified at Apapa Port gate.'
      showToast('Scanned QR barcode: ZN-26041 (Sesame Export)', 'success')
    }
  }

  if (submitFieldBtn) {
    submitFieldBtn.onclick = async () => {
      const shipmentCode = document.getElementById('fieldShipmentCodeInput').value || 'ZN-26041'
      const notes = document.getElementById('fieldHandoverNoteInput').value || 'Inspection passed.'
      const photoUrl = document.getElementById('capturedPhotoPreview')?.src || null

      const record = {
        shipmentId: shipmentCode,
        conditionNotes: notes,
        photoDataUrl: photoUrl,
        giver: state.activeCompany,
        receiver: 'Intercity Haulage Driver',
      }

      if (!state.isOnline) {
        await enqueueHandover(record)
        updateOfflineQueueBadge()
        showToast('Device is OFFLINE. Handover saved to local IndexedDB queue.', 'warning')
      } else {
        await enqueueHandover(record)
        await syncOfflineQueue()
      }

      // Reset form
      document.getElementById('fieldShipmentCodeInput').value = ''
      document.getElementById('fieldHandoverNoteInput').value = ''
      const previewImg = document.getElementById('capturedPhotoPreview')
      if (previewImg) previewImg.style.display = 'none'

      navigateToView('queue')
    }
  }
}

async function renderQueueView() {
  const container = document.getElementById('offlineQueueList')
  if (!container) return

  const items = await getQueuedHandovers()
  if (items.length === 0) {
    container.innerHTML = `
      <div class="panel-card empty-state-box">
        <i data-lucide="check-circle-2" style="width: 40px; height: 40px; color: var(--accent-emerald); margin-bottom: 12px;"></i>
        <h3>Offline Queue is Empty</h3>
        <p style="font-size: 13px; margin-top: 6px;">All field scans and handovers have synchronized with the consortium ledger.</p>
      </div>
    `
    if (window.lucide) window.lucide.createIcons()
    return
  }

  container.innerHTML = items
    .map(
      (item) => `
    <div class="queue-item-card">
      <div>
        <div style="font-weight: 600; font-size: 14px;">${item.id} · ${item.shipmentId}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.conditionNotes}</div>
        <div style="font-size: 11px; color: var(--accent-amber); margin-top: 4px;">
          Saved ${Math.floor((Date.now() - item.timestamp) / 60000)} min ago · Pending Node Sync
        </div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="window.zenaApp.syncOfflineQueue()">
        Sync Now
      </button>
    </div>
  `,
    )
    .join('')
}

// ==========================================================================
// MODULE 6: SETTLEMENTS & EVIDENCE PACK (SECTION 11 & 13)
// ==========================================================================
function setupSettlementView() {
  const releaseBtn = document.getElementById('releaseSettlementBtn')
  const exportEvidenceBtn = document.getElementById('exportEvidencePackBtn')

  if (releaseBtn) {
    releaseBtn.onclick = async () => {
      releaseBtn.disabled = true
      releaseBtn.textContent = 'Triggering Bank Rails...'

      try {
        const receipt = await executeReleaseSettlement('ZN-26041')
        showSettlementReceiptModal(receipt)
        showToast('Settlement instruction executed successfully!', 'success')
      } catch (e) {
        showToast('Settlement failed: ' + e.message, 'error')
      } finally {
        releaseBtn.disabled = false
        releaseBtn.textContent = 'Release Settlement (€28,800)'
        renderSettlementView()
      }
    }
  }

  if (exportEvidenceBtn) {
    exportEvidenceBtn.onclick = () => {
      const pack = generateEvidencePack('ZN-26041')
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ZENA-EVIDENCE-PACK-ZN-26041.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Evidence Pack downloaded for insurer / audit review.', 'success')
    }
  }
}

function renderSettlementView() {
  const details = getSettlementDetails('ZN-26041')

  const bannerEl = document.getElementById('settlementEligibilityNotice')
  if (bannerEl) {
    bannerEl.textContent = details.eligibilityMessage
    bannerEl.className = details.isEligible ? 'chip chip-emerald' : 'chip chip-amber'
  }

  const rateEl = document.getElementById('settlementBaseRate')
  const payoutEl = document.getElementById('settlementNetPayout')
  if (rateEl) rateEl.textContent = `€${details.financials.agreedFreightRate.toLocaleString()}`
  if (payoutEl) payoutEl.textContent = `€${details.financials.netPayout.toLocaleString()}`
}

function showSettlementReceiptModal(receipt) {
  const modal = document.getElementById('settlementReceiptModal')
  if (!modal) return

  document.getElementById('receiptId').textContent = receipt.receiptId
  document.getElementById('receiptHash').textContent = receipt.settlementHash
  document.getElementById('receiptBankRef').textContent = receipt.bankingReference
  document.getElementById('receiptBlock').textContent = `#${receipt.blockNumber}`
  document.getElementById('receiptAmount').textContent =
    `€${receipt.amountEur.toLocaleString()} EUR`

  modal.classList.add('active')
}

export function closeReceiptModal() {
  const modal = document.getElementById('settlementReceiptModal')
  if (modal) modal.classList.remove('active')
}

// ==========================================================================
// MODULE 7: NODE ADMIN & GOVERNANCE CONSOLE (SECTION 14 & 16)
// ==========================================================================
function setupNodeAndGovernanceView() {
  // Handled in renderNodeAdminView & renderGovernanceView
}

function renderNodeAdminView() {
  const container = document.getElementById('nodeValidatorPeersList')
  if (!container) return

  const validators = getValidators()
  container.innerHTML = validators
    .map(
      (v) => `
    <div class="peer-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>${v.name}</strong>
        <span class="chip chip-emerald">Online</span>
      </div>
      <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); word-break: break-all;">
        ${v.address}
      </div>
      <div style="font-size: 11px; color: var(--text-subtle);">
        RPC Port: ${v.rpcPort} · Commits: ${v.blockCommits.toLocaleString()}
      </div>
    </div>
  `,
    )
    .join('')
}

function renderGovernanceView() {
  const container = document.getElementById('governanceProposalsList')
  if (!container) return

  const proposals = getProposals()
  container.innerHTML = proposals
    .map((p) => {
      const totalVotes = p.votesYes + p.votesNo
      const yesPercent = totalVotes > 0 ? (p.votesYes / totalVotes) * 100 : 0
      const noPercent = totalVotes > 0 ? (p.votesNo / totalVotes) * 100 : 0

      return `
      <div class="proposal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 15px; font-weight: 700;">${p.title}</h3>
          <span class="chip ${p.status === 'PASSED' ? 'chip-emerald' : 'chip-blue'}">${p.status}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">${p.description}</p>
        
        <div class="vote-progress-bar-wrap">
          <div class="vote-fill-yes" style="width: ${yesPercent}%;"></div>
          <div class="vote-fill-no" style="width: ${noPercent}%;"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
          <span>YES: <strong>${p.votesYes}</strong> (${yesPercent.toFixed(0)}%)</span>
          <span>NO: <strong>${p.votesNo}</strong> (${noPercent.toFixed(0)}%)</span>
          <span>Quorum Needed: <strong>${p.quorumNeeded} / ${p.totalEligible}</strong></span>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm ${p.myVote === 'YES' ? 'btn-primary' : ''}" onclick="window.zenaApp.voteProposal(${p.id}, 'YES')">
            Vote YES
          </button>
          <button class="btn btn-outline btn-sm ${p.myVote === 'NO' ? 'btn-danger' : ''}" onclick="window.zenaApp.voteProposal(${p.id}, 'NO')">
            Vote NO
          </button>
        </div>
      </div>
    `
    })
    .join('')
}

export function voteProposal(proposalId, voteType) {
  castProposalVote(proposalId, voteType)
  showToast(`Recorded ${voteType} vote on Proposal #${proposalId}`, 'success')
  renderGovernanceView()
}

// ==========================================================================
// TOAST NOTIFICATION UTILITY
// ==========================================================================
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer')
  if (!container) return

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.innerHTML = `<span>${message}</span>`
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(100%)'
    toast.style.transition = 'all 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, 3500)
}

export function retryShipmentsFetch() {
  setSimulationState('LOADING')
  renderShipmentsView()
  setTimeout(() => {
    setSimulationState('DEFAULT')
    renderShipmentsView()
    showToast('Consortium node reconnected. Shipments fetched.', 'success')
  }, 900)
}

// Global Hook for HTML Event Attributes
window.zenaApp = {
  navigateToView,
  openCreateShipmentModal,
  closeCreateShipmentModal,
  openShipmentDetail,
  closeShipmentDetail,
  openSignatureModal,
  closeReceiptModal,
  syncOfflineQueue,
  retryShipmentsFetch,
  voteProposal,
  showToast,
}
