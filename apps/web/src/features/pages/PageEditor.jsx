import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, createPage, updatePage } from '../../lib/firestore';
import { uploadFeaturedImage } from '../../lib/storage';
import { useAuth } from '../auth/useAuth';
import { BlockEditor } from '../blocks/BlockEditor';
import { ArrowLeft, Save } from 'lucide-react';
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
  }, [title, id]);

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // If it's a new page without ID, we can't upload yet (we need an ID).
    // In a real app we might create a draft document first or use a temp ID.
    // For simplicity, we require saving the draft first if it's new.
    if (!id) {
      alert('Please save the page as draft first before uploading an image.');
      return;
    }
    
    try {
      setSaving(true);
      const imageData = await uploadFeaturedImage(id, file);
      setFeaturedImage(imageData);
      setSaving(false);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    
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
        alert('Page updated successfully!');
      } else {
        const newId = await createPage(pageData, user.uid);
        navigate(`/admin/pages/${newId}`, { replace: true });
        alert('Page created successfully!');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="admin-editor-shell">
      <div className="admin-editor-topbar">
        <button onClick={() => navigate('/admin/pages')} className="admin-editor-back" type="button">
          <ArrowLeft size={18} />
          <span>Back to Pages</span>
        </button>
        <button
          onClick={handleSave} 
          disabled={saving}
          className="admin-button-primary"
          type="button"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Page'}</span>
        </button>
      </div>

      {error && <div className="admin-editor-error">{error}</div>}

      <section className="admin-surface admin-editor-card">
        <h2>Page Details</h2>
        <div className="admin-editor-grid">
          
          <label className="admin-editor-field admin-editor-field-full">
            <strong>Title</strong>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="admin-editor-input" />
          </label>

          <label className="admin-editor-field">
            <strong>Slug</strong>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="admin-editor-input" />
          </label>

          <label className="admin-editor-field">
            <strong>Status</strong>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-editor-input">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <div className="admin-editor-upload admin-editor-field-full">
            <strong>Featured Image</strong>
            {featuredImage && (
              <div className="admin-editor-current-image">
                <p>Current: {featuredImage.alt}</p>
                <button onClick={() => setFeaturedImage(null)} className="admin-editor-remove" type="button">Remove</button>
              </div>
            )}
            <div className="admin-editor-upload-input-wrap">
              <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={saving} />
              {!id && <p className="admin-editor-hint-danger">Save page first to upload image.</p>}
            </div>
          </div>

        </div>
      </section>

      <section className="admin-surface admin-editor-card">
        <h2>Content Blocks</h2>
        <p className="admin-muted-text" style={{ marginBottom: '14px' }}>Add and arrange blocks to build the page content.</p>
        <BlockEditor blocks={blocks} setBlocks={setBlocks} pageId={id} />
      </section>

    </div>
  );
};
