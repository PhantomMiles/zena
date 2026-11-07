/**
 * Zena Network — Local Database & Offline Queue Engine
 * Uses IndexedDB ('zena_offline_queue') with LocalStorage state persistence fallback
 */

const DB_NAME = 'zena_offline_queue'
const DB_VERSION = 1
const STORE_NAME = 'handovers'

let dbInstance = null

// Initialize IndexedDB
export async function initDB() {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    // If running in an environment without IndexedDB, resolve with null
    if (!window.indexedDB) {
      console.warn('[Zena DB] IndexedDB not available, using localStorage fallback')
      resolve(null)
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      console.log('[Zena DB] IndexedDB initialized successfully')
      resolve(dbInstance)
    }

    request.onerror = (event) => {
      console.error('[Zena DB] Failed to open IndexedDB:', event.target.error)
      resolve(null)
    }
  })
}

// Enqueue Handover record when offline or pending ledger sync
export async function enqueueHandover(handover) {
  const item = {
    id: handover.id || 'HO-' + Date.now().toString(36).toUpperCase(),
    shipmentId: handover.shipmentId || 'ZN-26041',
    cargo: handover.cargo || 'General Cargo',
    handoverType: handover.handoverType || 'INTERCHANGE_TRANSFER',
    parties: {
      giver: handover.giver || 'Astraea Logistics (Ops)',
      receiver: handover.receiver || 'Intercity Haulage (Driver)',
    },
    location: handover.location || { lat: 6.4541, lng: 3.3947, name: 'Apapa Port Terminal, Lagos' },
    conditionNotes:
      handover.conditionNotes || 'Intact container seals verified. Dual signatures present.',
    photoDataUrl: handover.photoDataUrl || null,
    signatureGiver: handover.signatureGiver || 'SIG_GIVER_0x7c98b2..',
    signatureReceiver: handover.signatureReceiver || 'SIG_RECV_0x12fa91..',
    timestamp: Date.now(),
    synced: false,
  }

  const db = await initDB()
  if (db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(item)
      request.onsuccess = () => resolve(item)
      request.onerror = () => reject(request.error)
    })
  } else {
    // LocalStorage fallback
    const queue = getLocalStorageQueue()
    queue.push(item)
    localStorage.setItem('zena_handovers_queue', JSON.stringify(queue))
    return item
  }
}

// Retrieve all queued (unsynced) handovers
export async function getQueuedHandovers() {
  const db = await initDB()
  if (db) {
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => {
        const items = request.result || []
        resolve(items.filter((i) => !i.synced))
      }
      request.onerror = () => resolve([])
    })
  } else {
    const queue = getLocalStorageQueue()
    return queue.filter((i) => !i.synced)
  }
}

// Mark single item as synced
export async function markAsSynced(id) {
  const db = await initDB()
  if (db) {
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        if (getReq.result) {
          const item = getReq.result
          item.synced = true
          item.syncedAt = Date.now()
          store.put(item)
        }
        resolve(true)
      }
      getReq.onerror = () => resolve(false)
    })
  } else {
    const queue = getLocalStorageQueue()
    const updated = queue.map((item) =>
      item.id === id ? { ...item, synced: true, syncedAt: Date.now() } : item,
    )
    localStorage.setItem('zena_handovers_queue', JSON.stringify(updated))
    return true
  }
}

// Clear all queued or synced
export async function clearAllQueue() {
  const db = await initDB()
  if (db) {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
  }
  localStorage.removeItem('zena_handovers_queue')
}

function getLocalStorageQueue() {
  try {
    return JSON.parse(localStorage.getItem('zena_handovers_queue') || '[]')
  } catch {
    return []
  }
}
