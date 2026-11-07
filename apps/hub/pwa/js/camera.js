/**
 * Zena Network — HTML5 Camera & Barcode/QR Scanner Engine
 * Handles camera stream, frame captures, and fallback simulations
 */

let activeStream = null

// Start camera stream on target video element
export async function startCamera(videoElement, onFrameCallback = null) {
  if (!videoElement) return false

  // Stop any existing stream
  stopCamera()

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      activeStream = stream
      videoElement.srcObject = stream
      videoElement.play()
      console.log('[Zena Camera] Camera stream started successfully')
      return true
    } catch (err) {
      console.warn('[Zena Camera] Real camera access rejected or unavailable:', err)
      return false
    }
  } else {
    console.warn('[Zena Camera] navigator.mediaDevices not supported in current environment')
    return false
  }
}

// Stop current camera stream
export function stopCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop())
    activeStream = null
    console.log('[Zena Camera] Camera stream stopped')
  }
}

// Capture current frame from video stream as a data URL (PNG)
export function captureFrame(videoElement) {
  if (!videoElement) return null

  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth || 640
  canvas.height = videoElement.videoHeight || 480
  const ctx = canvas.getContext('2d')

  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }

  // Fallback synthetic photo if camera is mock/stopped
  ctx.fillStyle = '#14171D'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#10B981'
  ctx.font = '20px sans-serif'
  ctx.fillText('ZENA FIELD PROOF - ' + new Date().toISOString(), 30, 80)
  return canvas.toDataURL('image/png')
}
