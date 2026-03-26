import React, { useEffect, useState } from 'react';
import { getPages, getGeneralSettings, getHomepagePage, getSettings } from '../../lib/firestore';
import { Link } from 'react-router-dom';
import { useImageUrl } from '../../hooks/useImageUrl';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { applySeo, fallbackDescriptionFromBlocks } from '../../lib/seo';

export const PublicHome = () => {
  const [pages, setPages] = useState([]);
  const [frontPage, setFrontPage] = useState(null);
  const [footerSettings, setFooterSettings] = useState(null);
  const [headerSettings, setHeaderSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const frontPageHeroPath =
    frontPage?.featuredImagePath ||
    frontPage?.featuredImage?.storagePath ||
    frontPage?.featuredImage?.path ||
    null;
  const { url: frontPageHeroUrl } = useImageUrl(frontPageHeroPath);
  const frontPageHeroAlt =
    frontPage?.featuredImage?.alt ||
    frontPage?.featuredImageAlt ||
    frontPage?.title ||
    'Featured image';

  useEffect(() => {
    const fetchPublishedPages = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [data, homepage, settings, footerData, headerData] = await Promise.race([
          Promise.all([
            getPages(true),
            getHomepagePage(),
            getGeneralSettings(),
            getSettings('footer'),
            getSettings('header'),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading pages.')), 5000)
          )
        ]);
        const allPages = Array.isArray(data) ? data : [];

        // Prefer the page with isHomepage === true; fall back to settings.frontPageId.
        let fp = homepage;
        if (!fp) {
          const fpId = settings?.frontPageId ?? null;
          if (fpId) {
            fp = allPages.find((p) => p.id === fpId) || null;
          }
        }

        setFrontPage(fp);
        setPages(fp ? allPages.filter((p) => p.id !== fp.id) : allPages);
        setFooterSettings(footerData);
        setHeaderSettings(headerData);
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

  useEffect(() => {
    if (loading) return;

    if (frontPage) {
      const metaTitle = frontPage?.seoMetadata?.metaTitle?.trim();
      const metaDescription = frontPage?.seoMetadata?.metaDescription?.trim();
      applySeo({
        title: metaTitle || `${frontPage.title} | FlareCMS`,
        description: metaDescription || fallbackDescriptionFromBlocks(frontPage.blocks),
        type: 'website',
      });
      return;
    }

    applySeo({
      title: 'FlareCMS',
      description: 'A lightning-fast, beautifully crafted content management system built with React and Firebase.',
      type: 'website',
    });
  }, [loading, frontPage]);

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
          <Link to="/" className="site-logo">{headerSettings?.logoText || 'FlareCMS'}</Link>
          {headerSettings?.navItems?.filter((n) => n.visible !== false).map((item, i) =>
            item.isExternal ? (
              <a key={item.href || item.label || i} href={item.href} target="_blank" rel="noopener noreferrer" className="pub-nav-link">
                {item.label}
              </a>
            ) : (
              <Link key={item.href || item.label || i} to={item.href} className="pub-nav-link">
                {item.label}
              </Link>
            )
          )}
        </div>
      </header>

      <main className="public-home-main">

        {/* ── Hero block ───────────────────────────────────────── */}
        {frontPage ? (
          <article className="public-article">
            {frontPageHeroUrl && (
              <div className="pub-article-hero">
                <img src={frontPageHeroUrl} alt={frontPageHeroAlt} />
              </div>
            )}

            <div className="pub-article-inner">
              <div className="pub-article-body">
                <BlockRenderer blocks={frontPage.blocks} />
              </div>
            </div>
          </article>
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
                    {(page.featuredImagePath || page.featuredImage) ? (
                      <CardImage
                        imagePath={
                          page.featuredImagePath ||
                          page.featuredImage?.storagePath ||
                          page.featuredImage?.path ||
                          null
                        }
                        alt={page.featuredImage?.alt || page.featuredImageAlt || page.title}
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
        {footerSettings?.footerText && <p className="footer-tagline">{footerSettings.footerText}</p>}
        <p>{footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS. Built with passion.`}</p>
        {footerSettings?.legalLinks?.length > 0 && (
          <nav className="footer-legal-links">
            {footerSettings.legalLinks.map((link, i) => (
              <a key={link.url || i} href={link.url}>{link.label}</a>
            ))}
          </nav>
        )}
      </footer>
    </div>
  );
};

/** Card thumbnail image */
const CardImage = ({ imagePath, alt }) => {
  const { url, error } = useImageUrl(imagePath);
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

