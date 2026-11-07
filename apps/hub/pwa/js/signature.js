/**
 * Zena Network — Digital Signature Engine
 * Canvas Touch/Mouse Drawing + Node Cryptographic Signing Simulation
 */

export class SignaturePad {
  constructor(canvasElement) {
    this.canvas = canvasElement
    this.ctx = canvasElement.getContext('2d')
    this.isDrawing = false
    this.hasSignature = false

    this.init()
  }

  init() {
    this.resize()
    this.ctx.lineWidth = 2.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.strokeStyle = '#10B981' // Verdant Emerald

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e))
    this.canvas.addEventListener('mousemove', (e) => this.draw(e))
    window.addEventListener('mouseup', () => this.stopDrawing())

    // Touch events for mobile/field tablets
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault()
        const touch = e.touches[0]
        this.startDrawing(touch)
      },
      { passive: false },
    )

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault()
        const touch = e.touches[0]
        this.draw(touch)
      },
      { passive: false },
    )

    this.canvas.addEventListener('touchend', () => this.stopDrawing())
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width || 400
    this.canvas.height = rect.height || 160
    this.clear()
  }

  getPos(event) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  startDrawing(event) {
    this.isDrawing = true
    this.hasSignature = true
    const pos = this.getPos(event)
    this.ctx.beginPath()
    this.ctx.moveTo(pos.x, pos.y)
  }

  draw(event) {
    if (!this.isDrawing) return
    const pos = this.getPos(event)
    this.ctx.lineTo(pos.x, pos.y)
    this.ctx.stroke()
  }

  stopDrawing() {
    this.isDrawing = false
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.hasSignature = false
  }

  toDataURL() {
    return this.canvas.toDataURL('image/png')
  }
}

// Generate cryptographic ECDSA simulation hash for signed payload
export async function generateCryptoSignature(nodeAddress, payloadString) {
  // Compute Web Crypto SHA-256 digest
  const encoder = new TextEncoder()
  const data = encoder.encode(nodeAddress + ':' + payloadString + ':' + Date.now())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return {
    algorithm: 'secp256k1-ECDSA-QBFT',
    signerNode: nodeAddress,
    signature: '0x' + hashHex + '1b',
    timestamp: new Date().toISOString(),
  }
}
