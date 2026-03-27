import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { getPageBySlug, getSettings } from '../../lib/firestore';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { useImageUrl } from '../../hooks/useImageUrl';
import { applySeo, fallbackDescriptionFromBlocks } from '../../lib/seo';

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
            getSettings('footer').catch(() => null),
            getSettings('header').catch(() => null),
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
  const heroAlt =
    page?.featuredImage?.alt ||
    page?.featuredImageAlt ||
    page?.title ||
    'Featured image';

  useEffect(() => {
    if (loading) return;

    if (!page) {
      applySeo({
        title: 'Page Not Found | FlareCMS',
        description: 'The requested page could not be found.',
        type: 'website',
      });
      return;
    }

    const metaTitle = page?.seoMetadata?.metaTitle?.trim();
    const metaDescription = page?.seoMetadata?.metaDescription?.trim();

    applySeo({
      title: metaTitle || `${page.title} | FlareCMS`,
      description: metaDescription || fallbackDescriptionFromBlocks(page.blocks),
      type: 'article',
    });
  }, [loading, page]);

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
          <div className="site-footer-surface">
            <div className="site-footer-brand">{headerSettings?.logoText || 'Cuvée Slate'}</div>

            {footerSettings?.footerText && <p className="footer-tagline">{footerSettings.footerText}</p>}

            {footerSettings?.legalLinks?.length > 0 && (
              <nav className="footer-legal-links">
                {footerSettings.legalLinks.map((link, i) => (
                  <a key={link.url || i} href={link.url || '#'}>{link.label || 'Link'}</a>
                ))}
              </nav>
            )}

            {footerSettings?.socialLinks?.length > 0 && (
              <div className="footer-social-links">
                {footerSettings.socialLinks.slice(0, 3).map((item, i) => (
                  <a
                    key={item.url || i}
                    href={item.url || '#'}
                    aria-label={item.label || 'Social link'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Share2 size={12} />
                  </a>
                ))}
              </div>
            )}

            <div className="footer-divider" />
            <p className="footer-copy">{footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS.`}</p>
          </div>
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
            <img src={heroUrl} alt={heroAlt} />
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
        <div className="site-footer-surface">
          <div className="site-footer-brand">{headerSettings?.logoText || 'Cuvée Slate'}</div>

          {footerSettings?.footerText && <p className="footer-tagline">{footerSettings.footerText}</p>}

          {footerSettings?.legalLinks?.length > 0 && (
            <nav className="footer-legal-links">
              {footerSettings.legalLinks.map((link, i) => (
                <a key={link.url || i} href={link.url || '#'}>{link.label || 'Link'}</a>
              ))}
            </nav>
          )}

          {footerSettings?.socialLinks?.length > 0 && (
            <div className="footer-social-links">
              {footerSettings.socialLinks.slice(0, 3).map((item, i) => (
                <a
                  key={item.url || i}
                  href={item.url || '#'}
                  aria-label={item.label || 'Social link'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Share2 size={12} />
                </a>
              ))}
            </div>
          )}

          <div className="footer-divider" />
          <p className="footer-copy">{footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS.`}</p>
        </div>
      </footer>
    </div>
  );
};

