import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPageBySlug, getSettings } from '../../lib/firestore';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { useImageUrl } from '../../hooks/useImageUrl';

export const PublicPage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [footerSettings, setFooterSettings] = useState(null);
  const [headerSettings, setHeaderSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchPageContent = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [data, footerData, headerData] = await Promise.race([
          Promise.all([
            getPageBySlug(slug),
            getSettings('footer'),
            getSettings('header'),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading page.')), 5000)
          )
        ]);
        setPage(data);
        setFooterSettings(footerData);
        setHeaderSettings(headerData);
      } catch (error) {
        console.error('Failed to load page:', error);
        setPage(null);
        setLoadError('This page is taking too long to load.');
      } finally {
        setLoading(false);
      }
    };
    fetchPageContent();
  }, [slug]);

  const heroImagePath =
    page?.featuredImagePath ||
    page?.featuredImage?.storagePath ||
    page?.featuredImage?.path ||
    null;
  const { url: heroUrl } = useImageUrl(heroImagePath);

  if (loading) {
    return (
      <div className="site-layout loading-state">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="site-layout">
        <header className="site-header">
          <div className="header-content narrow-header">
            <Link to="/" className="site-logo">{headerSettings?.logoText || 'FlareCMS'}</Link>
          </div>
        </header>
        <main className="not-found">
          <h1>404</h1>
          <p>{loadError || `Page "${slug}" not found.`}</p>
          <Link to="/" className="btn-primary">← Go Home</Link>
        </main>
        <footer className="site-footer">
          {footerSettings?.footerText && <p className="footer-tagline">{footerSettings.footerText}</p>}
          <p>{footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS.`}</p>
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
  }

  const publishDate = new Date(
    page?.publishedAt?.toMillis?.() ?? page?.createdAt?.toMillis?.() ?? Date.now()
  ).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="site-layout">
      <header className="site-header">
        <div className="header-content narrow-header">
          <Link to="/" className="site-logo">{headerSettings?.logoText || 'FlareCMS'}</Link>
          {headerSettings?.navItems?.filter((n) => n.visible !== false).map((item, i) =>
            item.isExternal
              ? <a key={item.href || i} href={item.href} target="_blank" rel="noopener noreferrer" className="pub-nav-link">{item.label}</a>
              : <Link key={item.href || i} to={item.href} className="pub-nav-link">{item.label}</Link>
          )}
        </div>
      </header>

      <article className="public-article">
        {heroUrl && (
          <div className="pub-article-hero">
            <img src={heroUrl} alt={page.title || 'Featured Image'} />
          </div>
        )}

        <div className="pub-article-inner">
          <header className="pub-article-header">
            <Link to="/" className="pub-back-link">← Back to home</Link>
            <h1 className="pub-article-title">{page.title}</h1>
            <div className="pub-article-meta">Published {publishDate}</div>
          </header>

          <div className="pub-article-body">
            <BlockRenderer blocks={page.blocks} />
          </div>
        </div>
      </article>

      <footer className="site-footer">
        {footerSettings?.footerText && <p className="footer-tagline">{footerSettings.footerText}</p>}
        <p>{footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS.`}</p>
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

