import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, createPage, updatePage } from '../../lib/firestore';
import { uploadFeaturedImage } from '../../lib/storage';
import { useAuth } from '../auth/AuthContext';
import { BlockEditor } from '../blocks/BlockEditor';
import { ArrowLeft, Save } from 'lucide-react';

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
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/admin/pages')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
          <ArrowLeft size={18} /> Back to Pages
        </button>
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{ background: '#0ea5e9', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Save size={18} /> {saving ? 'Saving...' : 'Save Page'}
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h2>Page Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <strong>Title</strong>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <strong>Slug</strong>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <strong>Status</strong>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
            <strong>Featured Image</strong>
            {featuredImage && (
              <div style={{ margin: '10px 0' }}>
                <p style={{ fontSize: '14px', color: '#64748b' }}>Current: {featuredImage.alt}</p>
                <button onClick={() => setFeaturedImage(null)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
              </div>
            )}
            <div style={{ marginTop: '10px' }}>
              <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={saving} />
              {!id && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '5px' }}>Save page first to upload image.</p>}
            </div>
          </div>

        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2>Content Blocks</h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Add and arrange blocks to build the page content.</p>
        <BlockEditor blocks={blocks} setBlocks={setBlocks} pageId={id} />
      </div>

    </div>
  );
};
