/**
 * Zero-dependency static HTTP server for Zena Network PWA Engine
 * Runs on Node.js built-in modules ('http', 'fs', 'path')
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

const server = http.createServer((req, res) => {
  // CORS & PWA Service-Worker allowed headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Service-Worker-Allowed', '/')

  let reqPath = req.url.split('?')[0]
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html'
  }

  const filePath = path.join(__dirname, reqPath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback for SPA routing if needed
        fs.readFile(path.join(__dirname, 'index.html'), (spaErr, spaContent) => {
          if (spaErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('404 Not Found')
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(spaContent)
          }
        })
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Server Error: ${err.code}`)
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    }
  })
})

server.listen(PORT, () => {
  console.log(`\n======================================================`)
  console.log(`  ZENA NETWORK — SHARED LOGISTICS & SETTLEMENT ENGINE`)
  console.log(`  PWA running at: http://localhost:${PORT}`)
  console.log(`======================================================\n`)
})
