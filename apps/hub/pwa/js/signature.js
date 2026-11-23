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

/**
 * DEMO MODE: this PWA is a front-end prototype. It holds no node private key and sends nothing to
 * a Besu node. `computeLocalDigest` produces a SHA-256 integrity digest of the payload so the UI
 * can show a fingerprint. It is NOT a signature: it is not secp256k1/ECDSA, is not bound to any
 * key, and cannot be verified by the contracts. Real signing must use the EIP-712 typed data
 * defined in packages/contracts (via the SDK + a wallet/node signer) and be submitted on-chain.
 */
export const DEMO_MODE = true

export async function computeLocalDigest(payloadString) {
  const data = new TextEncoder().encode(payloadString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return {
    algorithm: 'SHA-256 (local integrity digest, not a signature)',
    digest: '0x' + hex,
    signed: false,
    onChain: false,
    timestamp: new Date().toISOString(),
  }
}
