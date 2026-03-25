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
          <Link to="/admin/login" className="pub-admin-link">Admin</Link>
        </div>
      </header>

      <main className="public-home-main">

        {/* ── Hero block ───────────────────────────────────────── */}
        {frontPage ? (
          <Link to={`/${frontPage.slug}`} className="front-page-hero">
            <div className="pub-hero-inner">
              <div className="pub-hero-text">
                <span className="pub-kicker">Featured</span>
                <h1 className="pub-hero-title">{frontPage.title}</h1>
                <span className="pub-hero-cta">Read article →</span>
              </div>
              <div className="pub-hero-image-wrap">
                {frontPage.featuredImage ? (
                  <HeroImage
                    storagePath={frontPage.featuredImage.storagePath}
                    alt={frontPage.featuredImage.alt}
                  />
                ) : (
                  <div className="placeholder-image" style={{ height: '100%' }}>
                    <span>📰</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <section className="pub-fallback-hero">
            <span className="pub-kicker">Welcome</span>
            <h1 className="pub-splash-title">
              FlareCMS
              <em>editorial</em>
            </h1>
            <p className="pub-splash-desc">
              A lightning-fast, beautifully crafted content management system
              built with React&nbsp;&amp; Firebase.
            </p>
          </section>
        )}

        {/* ── Error notice ─────────────────────────────────────── */}
        {loadError && (
          <div className="empty-state">
            <p>{loadError}</p>
          </div>
        )}

        {/* ── Pages grid ───────────────────────────────────────── */}
        {pages.length > 0 && (
          <section className="pub-pages-section">
            <h2 className="home-section-title">
              {frontPage ? 'More Pages' : 'Latest'}
            </h2>
            <div className="page-grid">
              {pages.map((page) => (
                <Link to={`/${page.slug}`} key={page.id} className="page-card">
                  <div className="card-image">
                    {page.featuredImage ? (
                      <CardImage
                        storagePath={page.featuredImage.storagePath}
                        alt={page.featuredImage.alt}
                      />
                    ) : (
                      <div className="placeholder-image" style={{ height: '100%' }}>
                        <span>📄</span>
                      </div>
                    )}
                  </div>
                  <div className="card-content">
                    <h3>{page.title}</h3>
                    <p className="slug-text">/{page.slug}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
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

/** Hero image for the featured front-page card */
const HeroImage = ({ storagePath, alt }) => {
  const { url, error } = useImageUrl(storagePath);
  if (error) {
    return (
      <div className="placeholder-image" style={{ height: '100%' }}>
        <span>🖼️</span>
      </div>
    );
  }
  if (!url) return <div className="loading-image" style={{ width: '100%', height: '100%' }} />;
  return <img src={url} alt={alt || ''} />;
};

/** Card thumbnail image */
const CardImage = ({ storagePath, alt }) => {
  const { url, error } = useImageUrl(storagePath);
  if (error) {
    return (
      <div className="placeholder-image" style={{ height: '100%' }}>
        <span>🖼️</span>
      </div>
    );
  }
  if (!url) return <div className="loading-image" style={{ width: '100%', height: '100%' }} />;
  return <img src={url} alt={alt || ''} />;
};

