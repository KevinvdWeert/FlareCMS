import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { callListMediaAssets } from '../../lib/functions';
import { resolveMediaUrl } from '../../lib/storage';

/**
 * Modal that lets the user pick an existing media asset from the Media Library.
 * Calls `onSelect(asset)` when the user clicks an asset.
 * Calls `onClose()` when the user dismisses the modal.
 */
export const MediaPickerModal = ({ onSelect, onClose }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastId, setLastId] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const loadAssets = async ({ reset = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await callListMediaAssets({
        pageSize: 24,
        startAfterId: reset ? null : lastId,
      });
      const { assets: newAssets = [], hasMore: more = false } = result.data || {};
      setAssets((prev) => (reset ? newAssets : [...prev, ...newAssets]));
      setHasMore(more);
      if (reset) {
        setLastId(null);
      }
      if (newAssets.length > 0) {
        setLastId(newAssets[newAssets.length - 1].id);
      }
    } catch (err) {
      console.error('MediaPickerModal: failed to load assets', err);
      setError('Failed to load media assets. ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="media-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Select media"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="media-picker-modal">
        <div className="media-picker-header">
          <h3 className="media-picker-title">Media Library</h3>
          <button type="button" className="media-picker-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="admin-editor-error" style={{ margin: '0 0 12px' }}>{error}</div>}

        <div className="media-picker-grid">
          {loading && assets.length === 0 && (
            <p className="media-picker-empty">Loading media…</p>
          )}
          {!loading && assets.length === 0 && (
            <p className="media-picker-empty">No media assets found. Upload images to get started.</p>
          )}
          {assets.map((asset) => {
            const url = resolveMediaUrl(asset.storagePath);
            const label = asset.fileName || asset.storagePath?.split('/').pop() || 'Image';
            return (
              <button
                key={asset.id}
                type="button"
                className="media-picker-item"
                onClick={() => onSelect(asset)}
                title={label}
              >
                <div className="media-picker-thumb-wrap">
                  <img src={url} alt={label} className="media-picker-thumb" loading="lazy" />
                </div>
                <span className="media-picker-name">{label}</span>
              </button>
            );
          })}
        </div>

        {hasMore && (
          <div className="media-picker-footer">
            <button
              type="button"
              className="block-toolbar-btn"
              onClick={() => loadAssets()}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
