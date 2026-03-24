import React, { useEffect, useState } from 'react';
import { getPages } from '../../lib/firestore';
import { Link } from 'react-router-dom';

export const PublicHome = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchPublishedPages = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await Promise.race([
          getPages(true),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading pages.')), 5000)
          )
        ]); // onlyPublished = true
        setPages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load published pages:', error);
        setPages([]);
        setLoadError('Loading content is taking too long. Please refresh to retry.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublishedPages();
  }, []);

  if (loading) {
    return (
      <div className="site-layout loading-state">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="site-layout">
      <header className="site-header">
        <div className="header-content">
          <Link to="/" className="site-logo">FlareCMS</Link>
        </div>
      </header>
      
      <main className="public-home-main">
        <div className="hero-section">
          <h1>Welcome to FlareCMS</h1>
          <p>A beautiful, lightning-fast content management system built with React & Firebase.</p>
        </div>

        {loadError && (
          <div className="empty-state" style={{ marginBottom: '20px' }}>
            <p>{loadError}</p>
          </div>
        )}
        
        <div className="page-grid">
          {pages.length > 0 ? (
            pages.map((page) => (
              <Link to={`/${page.slug}`} key={page.id} className="page-card">
                {page.featuredImage ? (
                  <div className="card-image">
                    <RenderedCardImage storagePath={page.featuredImage.storagePath} alt={page.featuredImage.alt} />
                  </div>
                ) : (
                  <div className="card-image placeholder-image">
                    <span className="placeholder-icon">📄</span>
                  </div>
                )}
                <div className="card-content">
                  <h3>{page.title}</h3>
                  <p className="slug-text">/{page.slug}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <p>No published pages yet. Check back soon!</p>
            </div>
          )}
        </div>
      </main>
      
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} FlareCMS. Built with passion.</p>
      </footer>
    </div>
  );
};

// Helper for card images to avoid breaking the layout while loading
import { getImageUrl } from '../../lib/storage';
const RenderedCardImage = ({ storagePath, alt }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    getImageUrl(storagePath).then(setUrl).catch(console.error);
  }, [storagePath]);

  if (!url) return <div className="card-image loading-image"></div>;
  return <img src={url} alt={alt} />;
};
