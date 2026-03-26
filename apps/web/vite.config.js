import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const imagesDir = path.resolve(__dirname, '..', '..', 'images')

const serveLocalImagesPlugin = {
  name: 'serve-local-images',
  configureServer(server) {
    server.middlewares.use('/images', (req, res, next) => {
      try {
        const reqPath = decodeURIComponent((req.url || '/').split('?')[0])
        const relativePath = path.posix
          .normalize(reqPath)
          .replace(/^\/+/, '')

        // Reject traversal attempts before resolving to filesystem path.
        if (relativePath.includes('..')) {
          res.statusCode = 400
          res.end('Invalid image path')
          return
        }

        const filePath = path.resolve(imagesDir, relativePath)

        if (!filePath.startsWith(imagesDir + path.sep) && filePath !== imagesDir) {
          res.statusCode = 400
          res.end('Invalid image path')
          return
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next()
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const mime = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        }[ext] || 'application/octet-stream'

        res.setHeader('Content-Type', mime)
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      } catch (err) {
        next(err)
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), serveLocalImagesPlugin],
  server: {
    // Proxy upload API to the local upload server in dev.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics']
        }
      }
    }
  }
})
