import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, createPage, updatePage, isSlugTaken } from '../../lib/firestore';
import { uploadImageToServer } from '../../lib/storage';
import { callRegisterMediaAsset } from '../../lib/functions';
import { useAuth } from '../auth/useAuth';
import { useImageUrl } from '../../hooks/useImageUrl';
import { BlockEditor } from '../blocks/BlockEditor';
import { ArrowLeft, Save, Send, X, Plus } from 'lucide-react';
import { validateSlug, validateTitle } from '../../lib/validation';

export const PageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugPrefix, setSlugPrefix] = useState('/');
  const [status, setStatus] = useState('draft');
  const [featuredImagePath, setFeaturedImagePath] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [blocks, setBlocks] = useState([]);

  // SEO metadata
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Taxonomy / tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState('');

  // Scheduled publishing (UI only — scheduling not yet supported server-side)
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // Resolve featured image path to displayable URL
  const displayImagePath = featuredImagePath.startsWith('/') ? featuredImagePath : `/${featuredImagePath}`;
  const { url: displayImageUrl } = useImageUrl(displayImagePath);

  useEffect(() => {
    if (id) {
      const fetchPage = async () => {
        setLoading(true);
        const page = await getPageById(id);
        if (page) {
          setTitle(page.title || '');
          setSlug(page.slug || '');
          setSlugPrefix(page.slugPrefix || '/');
          setStatus(page.status || 'draft');
          // Support both new featuredImagePath string and legacy featuredImage object
          setFeaturedImagePath(
            page.featuredImagePath ||
            page.featuredImage?.storagePath ||
            page.featuredImage?.path ||
            ''
          );
          setFeaturedImageAlt(page.featuredImage?.alt || '');
          setBlocks(page.blocks || []);
          // SEO metadata (optional field — backward compatible)
          setMetaTitle(page.seoMetadata?.metaTitle || '');
          setMetaDescription(page.seoMetadata?.metaDescription || '');
          // Tags (optional field — backward compatible)
          setTags(Array.isArray(page.tags) ? page.tags : []);
          // Scheduled publish (optional field)
          if (page.scheduledPublishAt) {
            const d = page.scheduledPublishAt?.seconds
              ? new Date(page.scheduledPublishAt.seconds * 1000)
              : new Date(page.scheduledPublishAt);
            if (!isNaN(d.getTime())) {
              // Format as datetime-local input value
              const pad = (n) => String(n).padStart(2, '0');
              setScheduledPublishAt(
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
              );
            }
          }
        } else {
          setError('Page not found');
        }
        setLoading(false);
      };
      fetchPage();
    }
  }, [id]);

  // Auto-generate slug from title if slug is empty
  useEffect(() => {
    if (!id && title && !slug) {
      setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  }, [title, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFeaturedImagePathChange = (value) => {
    const path = String(value || '').trim();
    if (!path) {
      setFeaturedImagePath('');
      return;
    }
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    setFeaturedImagePath(normalizedPath);
    if (!featuredImageAlt) {
      setFeaturedImageAlt(normalizedPath.split('/').pop() || '');
    }
  };

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploadingCover(true);
    try {
      const uploaded = await uploadImageToServer(file);
      const normalizedPath = String(uploaded.path || '').replace(/^\//, '');

      // Ensure featured uploads are indexed in Media Manager.
      await callRegisterMediaAsset({
        storagePath: normalizedPath,
        fileName: uploaded.fileName || file.name,
        mimeType: uploaded.mimeType || file.type || 'image/jpeg',
        sizeBytes: uploaded.sizeBytes || file.size || null,
      });

      setFeaturedImagePath(normalizedPath);
      if (!featuredImageAlt) {
        setFeaturedImageAlt(uploaded.fileName || file.name || '');
      }
    } catch (err) {
      console.error('Cover upload failed:', err);
      setError(err?.message || 'Cover upload failed.');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    setTagError('');
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setTagError('Tag must be 50 characters or fewer.');
      return;
    }
    if (tags.includes(trimmed)) {
      setTagError('Tag already added.');
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const [saveSuccess, setSaveSuccess] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaveSuccess('');
    
    if (!title || !slug) {
      setError('Title and slug are required.');
      return;
    }
    if (!validateTitle(title)) {
      setError('Title must be at least 2 characters.');
      return;
    }
    if (!validateSlug(slug)) {
      setError('Slug must be lowercase letters, numbers, and hyphens only.');
      return;
    }

    setSaving(true);
    try {
      const taken = await isSlugTaken(slug, id || null);
      if (taken) {
        setError('This slug is already used by another page. Please choose a different slug.');
        setSaving(false);
        return;
      }
    } catch (err) {
      console.error('Slug validation error:', err);
    }

    const pageData = {
      title,
      slug,
      slugPrefix: slugPrefix || '/',
      status,
      featuredImagePath: featuredImagePath || null,
      featuredImage: featuredImagePath
        ? { storagePath: featuredImagePath, alt: featuredImageAlt || '' }
        : null,
      blocks,
      seoMetadata: {
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
      },
      tags,
      scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt) : null,
    };

    try {
      if (id) {
        await updatePage(id, pageData, user.uid);
        setSaveSuccess('Page updated successfully!');
      } else {
        const newId = await createPage(pageData, user.uid);
        navigate(`/admin/pages/${newId}`, { replace: true });
        setSaveSuccess('Page created successfully!');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  if (loading) return <p className="admin-muted-text">Loading editor...</p>;

  return (
    <div className="admin-editor-shell editorial-editor">
      <div className="admin-editor-topbar">
        <button onClick={() => navigate('/admin/pages')} className="admin-editor-back" type="button">
          <ArrowLeft size={18} />
          <span>ContentLibrary</span>
        </button>
        <div className="admin-editor-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="admin-button-secondary"
            type="button"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="admin-button-primary"
            type="button"
          >
            <Send size={16} />
            <span>{status === 'published' ? 'Update Story' : 'Publish Story'}</span>
          </button>
        </div>
      </div>

      {error && <div className="admin-editor-error">{error}</div>}
      {saveSuccess && <div className="admin-editor-success">{saveSuccess}</div>}

      <div className="admin-editor-workspace">
        <section className="admin-surface admin-editor-card admin-editor-main">
          <label className="admin-editor-field admin-editor-field-full">
            <span className="editorial-kicker">Feature Article</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="admin-editor-title-input"
              placeholder="Enter title..."
            />
          </label>

          <div className="admin-editor-blocks-wrap">
            <h2>Content Body</h2>
            <p className="admin-muted-text">Compose your article with modular content blocks.</p>
            <BlockEditor blocks={blocks} setBlocks={setBlocks} />
          </div>
        </section>

        <aside className="admin-surface admin-editor-card admin-editor-sidebar-panel">
          <h2>Status &amp; Visibility</h2>
          <label className="admin-editor-field">
            <strong>Status</strong>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-editor-input">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <div className="admin-editor-slug-row">
            <label className="admin-editor-field">
              <strong>Slug Prefix</strong>
              <input
                type="text"
                value={slugPrefix}
                onChange={(e) => setSlugPrefix(e.target.value || '/')}
                className="admin-editor-input admin-editor-slug-prefix"
                placeholder="/"
              />
            </label>
            <label className="admin-editor-field admin-editor-slug-field">
              <strong>Slug</strong>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="admin-editor-input" />
            </label>
          </div>
          <p className="admin-editor-slug-preview admin-muted-text">
            Path: <code>{(slugPrefix || '/') + slug}</code>
          </p>

          <div className="admin-editor-section-divider" />

          {/* Scheduled Publishing */}
          <h3 className="admin-editor-section-heading">Scheduled Publishing</h3>
          <label className="admin-editor-field">
            <strong>Publish At</strong>
            <input
              type="datetime-local"
              value={scheduledPublishAt}
              onChange={(e) => setScheduledPublishAt(e.target.value)}
              className="admin-editor-input"
              disabled
            />
          </label>
          <p className="admin-editor-coming-soon">
            <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>schedule</span>
            {' '}Scheduling coming soon
          </p>

          <div className="admin-editor-section-divider" />

          {/* SEO Optimization */}
          <div className="admin-editor-seo-header">
            <h3 className="admin-editor-section-heading">SEO Optimization</h3>
            <span className="admin-editor-seo-score">Score: 92</span>
          </div>

          <label className="admin-editor-field">
            <span className="admin-editor-field-label">Meta Title</span>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value.slice(0, 60))}
              placeholder="Enter meta title..."
              className="admin-editor-input"
              maxLength={60}
            />
            <span className={`admin-editor-char-count ${metaTitle.length > 55 ? 'admin-editor-char-warn' : ''}`}>
              {metaTitle.length} / 60 chars
            </span>
          </label>

          <label className="admin-editor-field">
            <span className="admin-editor-field-label">Meta Description</span>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
              placeholder="Enter meta description..."
              className="admin-editor-input admin-editor-textarea"
              maxLength={160}
              rows={3}
            />
            <span className={`admin-editor-char-count ${metaDescription.length > 150 ? 'admin-editor-char-warn' : ''}`}>
              {metaDescription.length} / 160 chars
            </span>
          </label>

          <div className="admin-editor-section-divider" />

          {/* Taxonomy / Tags */}
          <h3 className="admin-editor-section-heading">Taxonomy</h3>
          <div className="admin-editor-tags-wrap">
            {tags.map((tag) => (
              <span key={tag} className="admin-editor-tag-pill">
                {tag}
                <button
                  type="button"
                  className="admin-editor-tag-remove"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <div className="admin-editor-tag-input-row">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tag..."
                className="admin-editor-tag-input"
                maxLength={50}
              />
              <button
                type="button"
                className="admin-editor-tag-add-btn"
                onClick={handleAddTag}
                aria-label="Add tag"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          {tagError && <p className="admin-editor-tag-error">{tagError}</p>}

          <div className="admin-editor-section-divider" />

          <div className="admin-editor-cover-section">
            <h3 className="admin-editor-cover-heading">Cover Image</h3>
            
            {/* Cover Image Container */}
            <div 
              className={`admin-editor-cover-container ${featuredImagePath ? '' : 'admin-editor-cover-empty'}`}
              onClick={() => !featuredImagePath && document.getElementById('featured-image-input')?.click()}
            >
              {featuredImagePath && displayImageUrl ? (
                <>
                  <img
                    src={displayImageUrl}
                    alt={featuredImageAlt || 'Cover'}
                    className="admin-editor-cover-image"
                  />
                  <div className="admin-editor-cover-overlay">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('featured-image-input')?.click();
                      }}
                      className="admin-editor-cover-replace-btn"
                    >
                      Replace Asset
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-editor-cover-placeholder">
                  <p className="admin-muted-text">Click to upload cover image</p>
                  {uploadingCover && <p className="admin-editor-uploading-text">Uploading...</p>}
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              id="featured-image-input"
              type="file"
              accept="image/*"
              onChange={handleFeaturedImageUpload}
              disabled={saving || uploadingCover}
              style={{ display: 'none' }}
            />

            {/* Alt Text Input */}
            <label className="admin-editor-field" style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Alt Text
              </span>
              <input
                type="text"
                value={featuredImageAlt || ''}
                onChange={(e) => setFeaturedImageAlt(e.target.value)}
                placeholder="Describe the cover image"
                className="admin-editor-input"
              />
            </label>

            {/* Status Text */}
            {featuredImagePath && (
              <p className="admin-editor-cover-status">
                <strong>Saved:</strong> {featuredImagePath}
              </p>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
};
