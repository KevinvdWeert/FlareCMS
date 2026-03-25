import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, createPage, updatePage, isSlugTaken } from '../../lib/firestore';
import { uploadImageToServer } from '../../lib/storage';
import { callRegisterMediaAsset } from '../../lib/functions';
import { useAuth } from '../auth/useAuth';
import { BlockEditor } from '../blocks/BlockEditor';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { validateSlug, validateTitle } from '../../lib/validation';

export const PageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('draft');
  const [featuredImagePath, setFeaturedImagePath] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [blocks, setBlocks] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchPage = async () => {
        setLoading(true);
        const page = await getPageById(id);
        if (page) {
          setTitle(page.title || '');
          setSlug(page.slug || '');
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
      status,
      featuredImagePath: featuredImagePath || null,
      featuredImage: featuredImagePath
        ? { storagePath: featuredImagePath, alt: featuredImageAlt || '' }
        : null,
      blocks
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

          <label className="admin-editor-field">
            <strong>Slug</strong>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="admin-editor-input" />
          </label>

          <div className="admin-editor-upload admin-editor-field-full">
            <strong>Cover Image</strong>
            {featuredImagePath && (
              <div className="admin-editor-current-image">
                <img
                  src={featuredImagePath}
                  alt="Cover"
                  style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }}
                />
                <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{featuredImagePath}</p>
                <button onClick={() => setFeaturedImagePath('')} className="admin-editor-remove" type="button">Remove</button>
              </div>
            )}
            <div className="admin-editor-upload-input-wrap">
              <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={saving || uploadingCover} />
              <p className="admin-muted-text" style={{ marginTop: '8px' }}>
                {uploadingCover ? 'Uploading cover image...' : (featuredImagePath ? `Saved path: /${featuredImagePath}` : 'No cover image uploaded yet.')}
              </p>
              <input
                type="text"
                value={featuredImageAlt || ''}
                onChange={(e) => setFeaturedImageAlt(e.target.value)}
                placeholder="Cover image alt text"
                className="admin-editor-input"
                style={{ marginTop: '8px' }}
              />
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};
