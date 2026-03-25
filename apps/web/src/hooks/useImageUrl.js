import { useState, useEffect } from 'react';

/**
 * Resolves an image path or URL to a displayable `src` value.
 *
 * Resolution rules (in priority order):
 * 1. Relative web paths (starting with `/`) → returned as-is so the browser
 *    fetches them directly (proxied to the upload server in dev, served by the
 *    web server / CDN in production).
 * 2. Absolute HTTP/HTTPS URLs → returned as-is.
 * 3. Anything else (legacy Firebase Storage `gs://` paths or old plain
 *    `storagePath` strings like `pages/…`) → returns null with an error so the
 *    component can show a graceful fallback instead of crashing.
 *
 * Returns `{ url, loading, error }`.
 */
export const useImageUrl = (imagePath) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imagePath) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    const raw = String(imagePath).trim();
    if (!raw) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Relative web path — use directly
    if (raw.startsWith('/')) {
      setUrl(raw);
      setLoading(false);
      setError(null);
      return;
    }

    // Absolute HTTP/HTTPS URL — use directly
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      setUrl(raw);
      setLoading(false);
      setError(null);
      return;
    }

    // Server-relative path without leading slash (e.g. images/uuid.jpg).
    // Normalize to /images/uuid.jpg.
    if (
      !raw.startsWith('gs://') &&
      !raw.startsWith('data:') &&
      (/^[a-z0-9_\-/]+\.[a-z0-9]+$/i.test(raw) || raw.includes('/'))
    ) {
      setUrl(`/${raw.replace(/^\/+/, '')}`);
      setLoading(false);
      setError(null);
      return;
    }

    // Legacy Firebase Storage path (gs://… or old storagePath like `pages/…`)
    // Cannot be resolved without the Storage SDK; show a graceful fallback.
    console.warn('[useImageUrl] Legacy storage path cannot be resolved:', raw);
    setUrl(null);
    setLoading(false);
    setError(new Error('Legacy storage path — image not available.'));
  }, [imagePath]);

  return { url, loading, error };
};
