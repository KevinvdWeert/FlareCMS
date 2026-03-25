import React, { useEffect, useState, useRef } from 'react';
import { CloudUpload, Grid3X3, List, Tag, Trash, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { validateImageFile, uploadImageToServer } from '../../lib/storage';
import { createImageRecord, getImagesPaginated, deleteImageRecord } from '../../lib/firestore';
import { parseFirestoreTimestamp } from '../../lib/firestore';

const MIME_LABELS = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
};

const formatBytes = (bytes) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const MediaManager = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [deletingId, setDeletingId] = useState('');
  const fileInputRef = useRef(null);

  const loadAssets = async ({ reset = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await getImagesPaginated({
        pageSize: 20,
        cursor: reset ? null : cursor,
      });
      setAssets((prev) => (reset ? result.items : [...prev, ...result.items]));
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load media assets:', err);
      setError('Failed to load media assets. ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    try {
      validateImageFile(file);
    } catch (err) {
      setUploadError(err.message);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImageToServer(file);
      await createImageRecord({
        path: result.path,
        fileName: result.fileName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        ownerId: user.uid,
      });
      await loadAssets({ reset: true });
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err?.message || 'Upload failed. Make sure the upload server is running (`npm run server:dev`).');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Delete "${asset.fileName}"? This cannot be undone.`)) return;
    setDeletingId(asset.id);
    setError('');
    try {
      await deleteImageRecord(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      if (selected?.id === asset.id) {
        setSelected(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err?.message || 'Failed to delete asset.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="admin-section media-screen">
      <section className="editorial-masthead">
        <div>
          <span className="editorial-kicker">Archive 2024</span>
          <h1>
            Media <span>Repository</span>
          </h1>
          <p>Browse, organize, and reuse your visual assets across editorial campaigns.</p>
        </div>
        <div className="editorial-masthead-card">
          <CloudUpload size={28} />
          <strong>{assets.length}</strong>
          <span>Loaded assets</span>
        </div>
      </section>

      <section className="media-toolbar admin-surface">
        <div className="media-toolbar-left">
          <small>{assets.length} asset{assets.length !== 1 ? 's' : ''} loaded</small>
        </div>
        <div className="media-toolbar-right">
          <button type="button" className="admin-button-secondary" onClick={() => loadAssets({ reset: true })} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <label className="admin-button-primary" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <CloudUpload size={15} />
            <span>{uploading ? 'Uploading…' : 'Upload'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          <div className="media-view-toggle">
            <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view">
              <Grid3X3 size={15} />
            </button>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="List view">
              <List size={15} />
            </button>
          </div>
        </div>
      </section>

      {(error || uploadError) && (
        <div className="admin-editor-error">{error || uploadError}</div>
      )}

      <section className="media-layout">
        <div className={viewMode === 'grid' ? 'media-grid' : 'media-list'}>
          {loading && assets.length === 0 ? (
            <p className="admin-muted-text">Loading assets…</p>
          ) : assets.length === 0 ? (
            <p className="admin-muted-text">No assets yet. Upload your first image.</p>
          ) : (
            assets.map((asset) => (
              <article
                key={asset.id}
                className={`admin-surface media-card ${selected?.id === asset.id ? 'is-active' : ''}`}
                onClick={() => setSelected(asset)}
                style={{ cursor: 'pointer' }}
              >
                <div className="media-card-art">
                  {asset.path ? (
                    <img src={asset.path} alt={asset.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{(asset.fileName || 'A').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="media-card-meta">
                  <p title={asset.fileName}>{asset.fileName}</p>
                  <small>
                    {formatBytes(asset.sizeBytes)}
                    {asset.mimeType ? ` • ${MIME_LABELS[asset.mimeType] || asset.mimeType}` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="admin-icon-action delete"
                  aria-label="Delete asset"
                  disabled={deletingId === asset.id}
                  onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                  style={{ marginLeft: 'auto', flexShrink: 0 }}
                >
                  <Trash size={14} />
                </button>
              </article>
            ))
          )}

          {!loading && (
            <article className="admin-surface media-card media-card-add">
              <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'contents' }}>
                <div className="media-card-art">
                  <CloudUpload size={20} />
                </div>
                <div className="media-card-meta">
                  <p>Add Asset</p>
                  <small>Upload from desktop</small>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </article>
          )}
        </div>

        {hasMore && (
          <div className="admin-pagination-row">
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => loadAssets()}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        <aside className="admin-surface media-side-panel">
          <h3>Asset Details</h3>
          {selected ? (
            <>
              {selected.path ? (
                <div className="media-side-preview" style={{ overflow: 'hidden' }}>
                  <img src={selected.path} alt={selected.fileName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div className="media-side-preview">
                  <span>{(selected.fileName || 'A').charAt(0).toUpperCase()}</span>
                </div>
              )}
              <h4>{selected.fileName}</h4>
              <p className="media-side-meta">
                Uploaded {selected.createdAt
                  ? parseFirestoreTimestamp(selected.createdAt).toLocaleDateString()
                  : '—'}
              </p>
              <div className="media-side-specs">
                <div>
                  <span>Size</span>
                  <b>{formatBytes(selected.sizeBytes)}</b>
                </div>
                <div>
                  <span>Type</span>
                  <b>{MIME_LABELS[selected.mimeType] || selected.mimeType || '—'}</b>
                </div>
                <div>
                  <span>Path</span>
                  <b style={{ wordBreak: 'break-all', fontSize: '11px' }}>{selected.path || '—'}</b>
                </div>
                <div>
                  <span>Used in</span>
                  <b>{(selected.usedInPages || []).length} page{(selected.usedInPages || []).length !== 1 ? 's' : ''}</b>
                </div>
              </div>
              {(selected.tags || []).length > 0 && (
                <div className="media-side-tags">
                  <p>
                    <Tag size={13} />
                    <span>Tags</span>
                  </p>
                  <div>
                    {selected.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="media-side-actions">
                <button
                  type="button"
                  className="admin-button-primary"
                  disabled={deletingId === selected.id}
                  onClick={() => handleDelete(selected)}
                >
                  {deletingId === selected.id ? 'Deleting…' : 'Delete Asset'}
                </button>
              </div>
            </>
          ) : (
            <p className="admin-muted-text">Select an asset to see details.</p>
          )}
        </aside>
      </section>
    </div>
  );
};
