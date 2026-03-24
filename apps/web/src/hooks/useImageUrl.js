import { useState, useEffect } from 'react';
import { getImageUrl } from '../lib/storage';

/**
 * Fetches a Firebase Storage download URL for a given storage path.
 * Returns { url, loading, error }.
 */
export const useImageUrl = (storagePath) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getImageUrl(storagePath)
      .then((downloadUrl) => {
        if (!cancelled) {
          setUrl(downloadUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load image:', err);
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return { url, loading, error };
};
