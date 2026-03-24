import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, createPage, updatePage, isSlugTaken } from '../../lib/firestore';
import { uploadFeaturedImage, validateImageFile } from '../../lib/storage';
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
  const [featuredImage, setFeaturedImage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      const fetchPage = async () => {
        setLoading(true);
        const page = await getPageById(id);
        if (page) {
          setTitle(page.title || '');
          setSlug(page.slug || '');
          setStatus(page.status || 'draft');
          setFeaturedImage(page.featuredImage || null);
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

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // If it's a new page without ID, we can't upload yet (we need an ID).
    // In a real app we might create a draft document first or use a temp ID.
    // For simplicity, we require saving the draft first if it's new.
    if (!id) {
      setError('Please save the page as draft first before uploading an image.');
      return;
    }

    try {
      validateImageFile(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    try {
      setSaving(true);
      const imageData = await uploadFeaturedImage(id, file);
      setFeaturedImage(imageData);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Upload failed.');
    } finally {
      setSaving(false);
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
      featuredImage,
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
            <BlockEditor blocks={blocks} setBlocks={setBlocks} pageId={id} />
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
            {featuredImage && (
              <div className="admin-editor-current-image">
                <p>{featuredImage.alt || featuredImage.storagePath}</p>
                <button onClick={() => setFeaturedImage(null)} className="admin-editor-remove" type="button">Remove</button>
              </div>
            )}
            <div className="admin-editor-upload-input-wrap">
              <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={saving} />
              {!id && <p className="admin-editor-hint-danger">Save page first to upload image.</p>}
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};
