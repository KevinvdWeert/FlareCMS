import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  Filter,
  Grid3X3,
  List,
  Pencil,
  Tag,
  Trash,
} from 'lucide-react';
import { resolveMediaUrl, uploadImageToServer } from '../../lib/storage';
import { callRegisterMediaAsset, callListMediaAssets, callDeleteMediaAsset } from '../../lib/functions';
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
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastId, setLastId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [sortMode, setSortMode] = useState('newest');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [deletingId, setDeletingId] = useState('');
  const [replacing, setReplacing] = useState(false);
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const loadAssets = async ({ reset = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await callListMediaAssets({
        pageSize: 20,
        startAfterId: reset ? null : lastId,
      });
      const { assets: newAssets = [], hasMore: more = false } = result.data || {};
      setAssets((prev) => (reset ? newAssets : [...prev, ...newAssets]));
      setHasMore(more);
      if (reset) {
        setLastId(null);
        setSelectedIds([]);
      }
      if (newAssets.length > 0) {
        setLastId(newAssets[newAssets.length - 1].id);
      }
      return reset ? newAssets : null;
    } catch (err) {
      console.error('Failed to load media assets:', err);
      setError('Failed to load media assets. ' + (err?.message || ''));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected && assets.length > 0) {
      setSelected(assets[0]);
      return;
    }
    if (selected && !assets.some((a) => a.id === selected.id)) {
      setSelected(assets[0] || null);
    }
  }, [assets, selected]);

  const handleFileUpload = async (file) => {
    setUploadError('');
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadImageToServer(file);
      const storagePath = String(uploaded.path || '').replace(/^\//, '');

      await callRegisterMediaAsset({
        storagePath,
        fileName: uploaded.fileName || file.name,
        mimeType: uploaded.mimeType || file.type || 'image/jpeg',
        sizeBytes: uploaded.sizeBytes || file.size || null,
      });

      await loadAssets({ reset: true });
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Delete "${asset.fileName}"? This cannot be undone.`)) return;
    setDeletingId(asset.id);
    setError('');
    try {
      await callDeleteMediaAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setSelectedIds((prev) => prev.filter((id) => id !== asset.id));
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

  const handleSelect = async (asset) => {
    setSelected(asset);
  };

  const handleReplaceSelected = async (file) => {
    if (!file || !selected) return;
    setReplacing(true);
    setError('');
    try {
      const uploaded = await uploadImageToServer(file);
      const storagePath = String(uploaded.path || '').replace(/^\//, '');
      const registered = await callRegisterMediaAsset({
        storagePath,
        fileName: uploaded.fileName || file.name,
        mimeType: uploaded.mimeType || file.type || 'image/jpeg',
        sizeBytes: uploaded.sizeBytes || file.size || null,
      });

      await callDeleteMediaAsset(selected.id);
      const refreshed = await loadAssets({ reset: true });
      const newId = registered?.data?.id;
      if (newId && Array.isArray(refreshed)) {
        const replacement = refreshed.find((asset) => asset.id === newId);
        if (replacement) {
          setSelected(replacement);
        }
      }
    } catch (err) {
      console.error('Replace file error:', err);
      setError(err?.message || 'Failed to replace file.');
    } finally {
      setReplacing(false);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = '';
      }
    }
  };

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const allVisibleSelected = assets.length > 0 && selectedIds.length === assets.length;

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(assets.map((a) => a.id));
      return;
    }
    setSelectedIds([]);
  };

  const sortedAssets = [...assets].sort((a, b) => {
    const aTime = parseFirestoreTimestamp(a.createdAt).getTime();
    const bTime = parseFirestoreTimestamp(b.createdAt).getTime();
    if (sortMode === 'oldest') {
      return aTime - bTime;
    }
    return bTime - aTime;
  });

  const selectedCount = selectedIds.length;

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected asset(s)? This cannot be undone.`)) return;
    setError('');
    try {
      await Promise.all(selectedIds.map((id) => callDeleteMediaAsset(id)));
      setAssets((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
      if (selected && selectedIds.includes(selected.id)) {
        setSelected(null);
      }
      setSelectedIds([]);
    } catch (err) {
      console.error('Batch delete error:', err);
      setError(err?.message || 'Failed to delete one or more assets.');
    }
  };

  return (
    <div className="admin-section media-screen">
      <section className="editorial-masthead media-replica-masthead">
        <div>
          <span className="editorial-kicker">Archive 2024</span>
          <h1>
            Media <span>Repository</span>
          </h1>
          <p>Browse, organize, and reuse your visual assets across editorial campaigns.</p>
        </div>
        <div className="media-masthead-actions">
          <div className="media-view-toggle">
            <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view">
              <Grid3X3 size={16} />
            </button>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="List view">
              <List size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="editorial-cards-grid">
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Total Assets</span>
          <strong>{loading ? '—' : assets.length}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Selected</span>
          <strong>{selectedCount}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">View Mode</span>
          <strong>{viewMode === 'grid' ? 'Grid' : 'List'}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Storage Health</span>
          <strong>{uploadError ? 'Warning' : 'Healthy'}</strong>
        </article>
      </section>

      <section className="media-toolbar">
        <div className="media-toolbar-left">
          <label className="media-select-all">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
            <span>Select All</span>
          </label>
          <small>{assets.length} Items Total</small>
        </div>
        <div className="media-toolbar-right">
          <button type="button" className="media-batch-btn" onClick={() => setSortMode((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}>
            <Filter size={14} />
            <span>Sort</span>
          </button>
          <button type="button" className="media-batch-btn" onClick={() => loadAssets({ reset: true })} disabled={loading}>
            <Download size={14} />
            <span>Batch Export</span>
          </button>
          <button type="button" className="media-batch-btn danger" onClick={handleDeleteSelected} disabled={selectedCount === 0}>
            <Trash size={14} />
            <span>Delete</span>
          </button>
          <label className="media-upload-btn" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <CloudUpload size={15} />
            <span>{uploading ? 'Uploading...' : 'Upload Asset'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </section>

      {(error || uploadError) && (
        <div className="admin-editor-error">{error || uploadError}</div>
      )}

      <section className="media-layout">
        <div className="media-main-column">
          <div className={viewMode === 'grid' ? 'media-grid' : 'media-grid media-grid-list'}>
            {loading && assets.length === 0 ? (
              <p className="admin-muted-text">Loading assets…</p>
            ) : assets.length === 0 ? (
              <p className="admin-muted-text">No assets yet. Upload your first image.</p>
            ) : (
              sortedAssets.map((asset) => {
                const assetUrl = resolveMediaUrl(asset.path || asset.storagePath);
                const isActive = selected?.id === asset.id;
                const isChecked = selectedIds.includes(asset.id);
                return (
                  <article
                    key={asset.id}
                    className={`media-tile ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleSelect(asset)}
                  >
                    <div className="media-tile-frame">
                      {assetUrl ? (
                        <img src={assetUrl} alt={asset.fileName} />
                      ) : (
                        <span>{(asset.fileName || 'A').charAt(0).toUpperCase()}</span>
                      )}

                      <div className="media-tile-overlay">
                        <p>{asset.fileName}</p>
                        <small>
                          {formatBytes(asset.sizeBytes)}
                          {asset.mimeType ? ` • ${MIME_LABELS[asset.mimeType] || asset.mimeType}` : ''}
                        </small>
                      </div>

                      <label className="media-tile-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleSelect(asset.id, e.target.checked)}
                        />
                        <span>{isChecked ? <Check size={11} /> : null}</span>
                      </label>

                      {isActive && (
                        <div className="media-tile-selected">
                          <Check size={11} />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}

            {!loading && (
              <article className="media-tile media-tile-add">
                <label className="media-tile-add-label" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  <CloudUpload size={26} />
                  <p>Add Asset</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </article>
            )}
          </div>
        </div>

        <aside className="admin-surface media-side-panel">
          <div className="media-side-panel-head">
            <h3>Asset Details</h3>
            <button type="button" className="media-side-edit" aria-label="Edit asset metadata" disabled={!selected}>
              <Pencil size={14} />
            </button>
          </div>
          {selected ? (
            <>
              {resolveMediaUrl(selected.path || selected.storagePath) ? (
                <div className="media-side-preview" style={{ overflow: 'hidden' }}>
                  <img src={resolveMediaUrl(selected.path || selected.storagePath)} alt={selected.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div className="media-side-preview">
                  <span>{(selected.fileName || 'A').charAt(0).toUpperCase()}</span>
                </div>
              )}
              <h4>{selected.fileName}</h4>
              <p className="media-side-meta">
                Modified {selected.createdAt
                  ? parseFirestoreTimestamp(selected.createdAt).toLocaleDateString()
                  : '—'}
              </p>
              <div className="media-side-specs">
                <div>
                  <span>Dimensions</span>
                  <b>{selected.dimensions?.width && selected.dimensions?.height ? `${selected.dimensions.width} x ${selected.dimensions.height} px` : '—'}</b>
                </div>
                <div>
                  <span>File Type</span>
                  <b>{MIME_LABELS[selected.mimeType] || selected.mimeType || '—'}</b>
                </div>
                <div>
                  <span>Size</span>
                  <b>{formatBytes(selected.sizeBytes)}</b>
                </div>
                <div>
                  <span>Usage</span>
                  <b>{(selected.usedInPages || []).length > 0 ? `${(selected.usedInPages || []).length} pages` : 'Not attached'}</b>
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
                    <button type="button" className="media-tag-add">+ Add Tag</button>
                  </div>
                </div>
              )}
              <div className="media-side-actions">
                <button
                  type="button"
                  className="admin-button-secondary"
                  onClick={() => navigator.clipboard.writeText(selected.path || selected.storagePath || '')}
                >
                  Open Editor
                </button>
                <label className="admin-button-primary media-replace-btn" style={{ cursor: replacing ? 'not-allowed' : 'pointer' }}>
                  {replacing ? 'Replacing…' : 'Replace File'}
                  <input
                    ref={replaceInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleReplaceSelected(e.target.files?.[0])}
                    disabled={replacing || deletingId === selected.id}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <button
                type="button"
                className="media-delete-link"
                disabled={deletingId === selected.id}
                onClick={() => handleDelete(selected)}
              >
                {deletingId === selected.id ? 'Deleting…' : 'Delete Asset'}
              </button>
            </>
          ) : (
            <p className="admin-muted-text">Select an asset to see details.</p>
          )}
        </aside>
      </section>

      <footer className="media-footer">
        <div className="media-footer-pages">
          <button type="button">Previous</button>
          <div>
            <button type="button" className="is-active">01</button>
            <button type="button">02</button>
            <button type="button">03</button>
            <span>...</span>
            <button type="button">12</button>
          </div>
          <button type="button" onClick={() => hasMore && loadAssets()} disabled={!hasMore || loading}>Next</button>
        </div>
        <div className="media-footer-density">
          <span>Show</span>
          <select defaultValue="24 per page">
            <option>24 per page</option>
            <option>48 per page</option>
            <option>96 per page</option>
          </select>
        </div>
      </footer>
    </div>
  );
};
