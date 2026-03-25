import React, { useEffect, useState } from 'react';
import { getPages, getGeneralSettings } from '../../lib/firestore';
import { Link } from 'react-router-dom';
import { useImageUrl } from '../../hooks/useImageUrl';

export const PublicHome = () => {
  const [pages, setPages] = useState([]);
  const [frontPage, setFrontPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchPublishedPages = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [data, settings] = await Promise.race([
          Promise.all([
            getPages(true),
            getGeneralSettings(),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading pages.')), 5000)
          )
        ]);
        const allPages = Array.isArray(data) ? data : [];
        const fpId = settings?.frontPageId ?? null;
        if (fpId) {
          const fp = allPages.find((p) => p.id === fpId) || null;
          setFrontPage(fp);
          setPages(allPages.filter((p) => p.id !== fpId));
        } else {
          setFrontPage(null);
          setPages(allPages);
        }
      } catch (error) {
        console.error('Failed to load published pages:', error);
        setPages([]);
        setFrontPage(null);
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
        {!frontPage && (
          <div className="hero-section">
            <h1>Welcome to FlareCMS</h1>
            <p>A beautiful, lightning-fast content management system built with React & Firebase.</p>
          </div>
        )}

        {frontPage && (
          <Link to={`/${frontPage.slug}`} className="front-page-hero">
            {frontPage.featuredImage ? (
              <div className="front-page-hero-image">
                <FrontPageHeroImage storagePath={frontPage.featuredImage.storagePath} alt={frontPage.featuredImage.alt} />
              </div>
            ) : (
              <div className="front-page-hero-image placeholder-image">
                <span className="placeholder-icon">📰</span>
              </div>
            )}
            <div className="front-page-hero-content">
              <span className="front-page-label">Featured</span>
              <h1>{frontPage.title}</h1>
              <p className="front-page-slug">/{frontPage.slug}</p>
            </div>
          </Link>
        )}

        {loadError && (
          <div className="empty-state" style={{ marginBottom: '20px' }}>
            <p>{loadError}</p>
          </div>
        )}
        
        {pages.length > 0 && (
          <>
            {frontPage && <h2 className="home-section-title">More Pages</h2>}
            <div className="page-grid">
              {pages.map((page) => (
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
              ))}
            </div>
          </>
        )}

        {!loadError && pages.length === 0 && !frontPage && (
          <div className="empty-state">
            <p>No published pages yet. Check back soon!</p>
          </div>
        )}
      </main>
      
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} FlareCMS. Built with passion.</p>
      </footer>
    </div>
  );
};

// Helper for front page hero image
const FrontPageHeroImage = ({ storagePath, alt }) => {
  const { url, error } = useImageUrl(storagePath);
  if (error) return <div className="front-page-hero-image placeholder-image"><span className="placeholder-icon">🖼️</span></div>;
  if (!url) return <div className="front-page-hero-image loading-image"></div>;
  return <img src={url} alt={alt} />;
};

// Helper for card images to avoid breaking the layout while loading
const RenderedCardImage = ({ storagePath, alt }) => {
  const { url, error } = useImageUrl(storagePath);

  if (error) return <div className="card-image placeholder-image"><span className="placeholder-icon">🖼️</span></div>;
  if (!url) return <div className="card-image loading-image"></div>;
  return <img src={url} alt={alt} />;
};
