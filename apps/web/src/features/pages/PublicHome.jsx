import React, { useEffect, useState } from 'react';
import { getGeneralSettings, getHomepagePage, getPageById, getSettings } from '../../lib/firestore';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { useImageUrl } from '../../hooks/useImageUrl';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { applySeo, fallbackDescriptionFromBlocks } from '../../lib/seo';

export const PublicHome = () => {
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

  const visibleNavItems = (headerSettings?.navItems || []).filter((item) => item?.visible !== false);

  useEffect(() => {
    const fetchPublishedPages = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [homepage, settings, footerRes, headerRes] = await Promise.race([
          Promise.all([
            getHomepagePage(),
            getGeneralSettings(),
            getSettings('footer').catch(() => null),
            getSettings('header').catch(() => null),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading pages.')), 5000)
          )
        ]);
        // Prefer the page with isHomepage === true; fall back to settings.frontPageId.
        let fp = homepage;
        if (!fp) {
          const fpId = settings?.frontPageId ?? null;
          if (fpId) {
            const byId = await getPageById(fpId).catch(() => null);
            fp = byId?.status === 'published' ? byId : null;
          }
        }

        setFrontPage(fp);
        setFooterSettings(footerRes);
        setHeaderSettings(headerRes);
      } catch (error) {
        console.error('Failed to load published pages:', error);
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
          {visibleNavItems.map((item, i) =>
            item?.isExternal ? (
              <a
                key={item.href || i}
                href={item.href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="pub-nav-link"
              >
                {item.label || 'Link'}
              </a>
            ) : (
              <Link key={item.href || i} to={item.href || '/'} className="pub-nav-link">
                {item.label || 'Link'}
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

        {/* ── Empty state ──────────────────────────────────────── */}
        {!loadError && !frontPage && (
          <div className="empty-state">
            <p>No published pages yet. Check back soon!</p>
          </div>
        )}
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
          <p className="footer-copy">
            {footerSettings?.copyrightLine || `© ${new Date().getFullYear()} FlareCMS. Built with passion.`}
          </p>
        </div>
      </footer>
    </div>
  );
};

