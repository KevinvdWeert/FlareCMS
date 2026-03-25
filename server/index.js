/**
 * FlareCMS local upload server.
 *
 * Provides a lightweight REST API for image uploads and serves uploaded
 * images as static files.  This server is intentionally designed for
 * self-hosted / local-dev use and does NOT depend on Firebase Storage.
 *
 * Endpoints:
 *   POST /api/upload-image  – accept one image file, save to <root>/images/
 *   GET  /images/<file>     – serve uploaded images as static assets
 *
 * Start with:
 *   node server/index.js
 * or via the root npm scripts:
 *   npm run server:dev   (server only)
 *   npm run dev          (Vite + server together via concurrently)
 */

'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.UPLOAD_PORT || 3001;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// Project-root images directory (one level up from this file's directory)
const IMAGES_DIR = path.resolve(__dirname, '..', 'images');

// Create the images directory if it does not exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Multer storage – saves files to IMAGES_DIR with a uuid-based filename to
// prevent collisions and avoid exposing the original filename in the path.
// ---------------------------------------------------------------------------
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    // Sanitise extension: allow only [a-z0-9.] to block path-traversal tricks
    const rawExt = path.extname(file.originalname);
    const safeExt = rawExt.replace(/[^a-z0-9.]/gi, '').toLowerCase();
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error(
          `Invalid file type "${file.mimetype}". Allowed types: JPEG, PNG, GIF, WebP, SVG.`
        ), { status: 415 })
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Static image serving
// ---------------------------------------------------------------------------
app.use('/images', express.static(IMAGES_DIR));

// ---------------------------------------------------------------------------
// POST /api/upload-image
// ---------------------------------------------------------------------------
app.post('/api/upload-image', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
          : err.message || 'Upload failed.';
      return res.status(status).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with field "file".' });
    }

    // Block path traversal just in case (multer's diskStorage already uses our
    // sanitised filename, but validate the resolved path for defence-in-depth).
    const resolvedPath = path.resolve(IMAGES_DIR, req.file.filename);
    if (!resolvedPath.startsWith(IMAGES_DIR + path.sep) && resolvedPath !== IMAGES_DIR) {
      fs.unlinkSync(resolvedPath);
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const relativePath = `/images/${req.file.filename}`;

    return res.status(200).json({
      path: relativePath,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`[upload-server] Listening on http://localhost:${PORT}`);
  console.log(`[upload-server] Images served at  http://localhost:${PORT}/images/`);
  console.log(`[upload-server] Upload endpoint:  POST http://localhost:${PORT}/api/upload-image`);
  /* eslint-enable no-console */
});
