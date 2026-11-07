/**
 * Zena Network — Shipment Engine & Four-Step Assignment Wizard
 * Manages shipments, states (Default, Loading, Error 500, Offline, Empty), and custody timelines
 */

// Initial mock dataset matching wireframe section 05 & 06
const INITIAL_SHIPMENTS = [
  {
    id: 'ZN-26041',
    cargo: 'Sesame — 24 metric tonnes',
    quantity: '24 metric tonnes',
    category: 'Agricultural Export',
    status: 'IN_TRANSIT',
    statusLabel: 'In transit',
    movement: 'Kano Highway Hub → Apapa Port Terminal',
    route: 'Kano → Lagos / Apapa (North Sea Quay)',
    parties: {
      shipper: 'Amira Logistics (Kano)',
      carrier: 'Intercity Haulage (Musa D.)',
      consignee: 'North Sea Terminals (Apapa)',
    },
    carrierNode: '0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10',
    rateEur: 28800,
    dualSignatureStatus: 'PENDING_SECOND',
    dualSignatureLabel: '1 of 2 Valid (Sealed)',
    nextStep: 'Escort & Yard Sign-off pending',
    lastEventTime: '22 hrs ago',
    hash: '0x7f48bc2910fa8827361a99cfd8e1236502ba14789d6e42cb1a8f9024c084e1b8',
    events: [
      {
        id: 'EVT-01',
        title: 'Contract Agreement & Escrow Committed',
        location: 'Kano Operations Node',
        timestamp: '2026-11-05 08:30:00 WAT',
        giverSigned: true,
        receiverSigned: true,
        giverName: 'Amira Logistics',
        receiverName: 'Intercity Haulage',
        hash: '0xa11c9...8821',
      },
      {
        id: 'EVT-02',
        title: 'Origin Pickup & Container Seal Verified',
        location: 'Kano Highway Hub (GPS 12.0022° N, 8.5920° E)',
        timestamp: '2026-11-05 11:15:22 WAT',
        giverSigned: true,
        receiverSigned: true,
        giverName: 'Amira Warehouse Manager',
        receiverName: 'Driver Musa (Intercity)',
        hash: '0xb22d8...3341',
      },
      {
        id: 'EVT-03',
        title: 'Mid-Corridor Yard Interchange',
        location: 'Lagos North Transit Yard',
        timestamp: '2026-11-06 01:45:10 WAT',
        giverSigned: true,
        receiverSigned: false, // Pending counter-signature
        giverName: 'Driver Musa (Intercity)',
        receiverName: 'Awaiting Lagos Yard Marshall',
        hash: '0xc33e7...9910',
      },
    ],
  },
  {
    id: 'ZN-28042',
    cargo: 'Ginger — 12 metric tonnes',
    quantity: '12 metric tonnes',
    category: 'Spice / Perishable',
    status: 'AWAITING_ACCEPTANCE',
    statusLabel: 'Awaiting acceptance',
    movement: 'Kaduna Central → Port Harcourt Hub',
    route: 'Kaduna → Port Harcourt',
    parties: {
      shipper: 'Astraea Logistics',
      carrier: 'Trans-Niger Fleet',
      consignee: 'Onne Multipurpose Terminal',
    },
    carrierNode: '0x992B1182cfE429184A0918cfD20901e194A071E1',
    rateEur: 14200,
    dualSignatureStatus: 'NONE',
    dualSignatureLabel: '0 of 2 Signed',
    nextStep: 'Carrier subcontract review',
    lastEventTime: '1 day ago',
    hash: '0x88ea3091c01e91288cfa991bce09912816912384a701928014acb1e921e10283',
    events: [
      {
        id: 'EVT-01',
        title: 'Draft Consignment Registered',
        location: 'Kaduna Operations',
        timestamp: '2026-11-04 14:20:00 WAT',
        giverSigned: true,
        receiverSigned: false,
        giverName: 'Astraea Logistics',
        receiverName: 'Trans-Niger Fleet',
        hash: '0xd44f1...0011',
      },
    ],
  },
  {
    id: 'ZN-31004',
    cargo: 'Cocoa Beans — 30 metric tonnes',
    quantity: '30 metric tonnes',
    category: 'Commodity Export',
    status: 'VERIFIED_SETTLED',
    statusLabel: 'Verified & Settled',
    movement: 'Ondo Agro-Park → Tin Can Island Port',
    route: 'Ondo → Lagos (Tin Can)',
    parties: {
      shipper: 'Astraea Logistics',
      carrier: 'Western Haulage Ltd',
      consignee: 'Tin Can Grain Silos',
    },
    carrierNode: '0x12FaC98302194883A09B291cfE11029177A19921',
    rateEur: 35000,
    dualSignatureStatus: 'FULLY_SIGNED',
    dualSignatureLabel: '2 of 2 Verified',
    nextStep: 'Complete · Payment disbursed',
    lastEventTime: '3 days ago',
    hash: '0x10fba9012384029419208a019b29019284091823901290381029481920819203',
    events: [
      {
        id: 'EVT-01',
        title: 'Contract Signed & Escrow Locked',
        location: 'Ondo Node',
        timestamp: '2026-11-02 09:00:00 WAT',
        giverSigned: true,
        receiverSigned: true,
        giverName: 'Astraea Logistics',
        receiverName: 'Western Haulage',
        hash: '0xee110...1122',
      },
      {
        id: 'EVT-02',
        title: 'Dispatched & Weighed at Origin',
        location: 'Ondo Weighbridge',
        timestamp: '2026-11-02 12:45:00 WAT',
        giverSigned: true,
        receiverSigned: true,
        giverName: 'Agro-Park Dispatcher',
        receiverName: 'Driver Western Haulage',
        hash: '0xff221...3344',
      },
      {
        id: 'EVT-03',
        title: 'Proof of Delivery Confirmed & Release Triggered',
        location: 'Tin Can Island Port Terminal',
        timestamp: '2026-11-03 16:30:00 WAT',
        giverSigned: true,
        receiverSigned: true,
        giverName: 'Driver Western Haulage',
        receiverName: 'Tin Can Port Marshall',
        hash: '0xaa998...5566',
      },
    ],
  },
]

let shipmentsData = loadShipmentsFromStorage()
let currentSimulationState = 'DEFAULT' // 'DEFAULT', 'LOADING', 'ERROR', 'OFFLINE', 'EMPTY'

function loadShipmentsFromStorage() {
  try {
    const saved = localStorage.getItem('zena_shipments_data')
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.warn('Could not read shipments from localStorage:', e)
  }
  return [...INITIAL_SHIPMENTS]
}

export function saveShipmentsToStorage() {
  try {
    localStorage.setItem('zena_shipments_data', JSON.stringify(shipmentsData))
  } catch (e) {
    console.warn('Could not save shipments to localStorage:', e)
  }
}

export function getShipments() {
  return shipmentsData
}

export function getShipmentById(id) {
  return shipmentsData.find((s) => s.id === id) || null
}

export function setSimulationState(state) {
  currentSimulationState = state
}

export function getSimulationState() {
  return currentSimulationState
}

// Compute SHA-256 for shipment object
export async function computeShipmentHash(shipmentObj) {
  const jsonStr = JSON.stringify(shipmentObj)
  const encoder = new TextEncoder()
  const data = encoder.encode(jsonStr)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Add newly created shipment from Wizard
export async function createNewShipment(formValues) {
  const newId = 'ZN-' + Math.floor(10000 + Math.random() * 90000)
  const hash = await computeShipmentHash(formValues)

  const newShipment = {
    id: newId,
    cargo: formValues.cargo + ' — ' + formValues.quantity,
    quantity: formValues.quantity,
    category: formValues.category || 'General Freight',
    status: 'IN_TRANSIT',
    statusLabel: 'In transit',
    movement: formValues.origin + ' → ' + formValues.destination,
    route: formValues.origin + ' → ' + formValues.destination,
    parties: {
      shipper: formValues.sender || 'Astraea Logistics',
      carrier: formValues.carrierName || 'Intercity Haulage',
      consignee: formValues.receiver || 'North Sea Terminal',
    },
    carrierNode: formValues.carrierNode || '0x4d5C26b5E3c52A855A94f273C1fC1A5b661d9D10',
    rateEur: parseFloat(formValues.rateEur) || 20000,
    dualSignatureStatus: 'PENDING_SECOND',
    dualSignatureLabel: '1 of 2 Valid',
    nextStep: 'Carrier pickup confirmation',
    lastEventTime: 'Just now',
    hash: hash,
    events: [
      {
        id: 'EVT-01',
        title: 'Consignment Contract Initialized & Signed',
        location: formValues.origin + ' Operations',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' WAT',
        giverSigned: true,
        receiverSigned: false,
        giverName: formValues.sender || 'Astraea Logistics',
        receiverName: formValues.carrierName || 'Pending Carrier',
        hash: hash.slice(0, 10) + '...commit',
      },
    ],
  }

  shipmentsData.unshift(newShipment)
  saveShipmentsToStorage()
  return newShipment
}

// Attach a new counter-signature to an event
export function attachEventSignature(shipmentId, eventId, signerName, signatureHex) {
  const shipment = getShipmentById(shipmentId)
  if (!shipment) return false

  const event = shipment.events.find((e) => e.id === eventId)
  if (event) {
    event.receiverSigned = true
    event.receiverName = signerName
    event.signatureHex = signatureHex
    event.signedAt = new Date().toISOString()

    // Check if all events completed
    const allSigned = shipment.events.every((e) => e.giverSigned && e.receiverSigned)
    if (allSigned) {
      shipment.dualSignatureStatus = 'FULLY_SIGNED'
      shipment.dualSignatureLabel = '2 of 2 Verified'
      shipment.nextStep = 'Ready for Automated Settlement'
    }
    saveShipmentsToStorage()
    return true
  }
  return false
}
