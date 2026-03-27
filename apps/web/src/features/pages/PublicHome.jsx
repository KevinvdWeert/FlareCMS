import React, { useEffect, useState } from 'react';
import { getGeneralSettings, getHomepagePage, getPageById, getPages, getSettings } from '../../lib/firestore';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { useImageUrl } from '../../hooks/useImageUrl';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { applySeo, fallbackDescriptionFromBlocks } from '../../lib/seo';

const DEFAULT_HOMEPAGE_SECTIONS = [
  { id: 'hero', type: 'hero', title: 'Welcome', subtitle: 'A lightning-fast CMS.', bgStyle: 'default', visible: true },
  { id: 'featured_posts', type: 'featured_posts', title: 'Featured', subtitle: '', bgStyle: 'surface_low', visible: true },
  { id: 'latest_posts', type: 'latest_posts', title: 'Latest', subtitle: '', bgStyle: 'default', visible: true },
];

const sectionBgClass = (bgStyle) => {
  if (bgStyle === 'surface_low') return 'home-dynamic-section is-surface-low';
  if (bgStyle === 'surface_high') return 'home-dynamic-section is-surface-high';
  return 'home-dynamic-section is-default';
};

export const PublicHome = () => {
  const [sections, setSections] = useState(DEFAULT_HOMEPAGE_SECTIONS);
  const [publishedPages, setPublishedPages] = useState([]);
  const [frontPage, setFrontPage] = useState(null);
  const [footerSettings, setFooterSettings] = useState(null);
  const [contactSettings, setContactSettings] = useState(null);
  const [headerSettings, setHeaderSettings] = useState(null);
  const [identitySettings, setIdentitySettings] = useState(null);
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
        const [homepage, settings, footerRes, headerRes, identityRes, contactRes, homepageSettings, allPages] = await Promise.race([
          Promise.all([
            getHomepagePage(),
            getGeneralSettings(),
            getSettings('footer').catch(() => null),
            getSettings('header').catch(() => null),
            getSettings('identity').catch(() => null),
            getSettings('contact').catch(() => null),
            getSettings('homepage').catch(() => null),
            getPages(true).catch(() => []),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading pages.')), 5000)
          )
        ]);

        const allPublished = Array.isArray(allPages) ? allPages : [];
        // Prefer the page with isHomepage === true; fall back to settings.frontPageId.
        let fp = homepage;
        if (!fp) {
          const fpId = settings?.frontPageId ?? null;
          if (fpId) {
            const byId = await getPageById(fpId).catch(() => null);
            fp = byId?.status === 'published' ? byId : null;
          }
        }

        const dynamicSections = Array.isArray(homepageSettings?.sections) && homepageSettings.sections.length > 0
          ? homepageSettings.sections
          : DEFAULT_HOMEPAGE_SECTIONS;

        const remaining = allPublished.filter((p) => !fp || p.id !== fp.id);

        setFrontPage(fp);
        setSections(dynamicSections);
        setPublishedPages(remaining);
        setFooterSettings(footerRes);
        setContactSettings(contactRes);
        setHeaderSettings(headerRes);
        setIdentitySettings(identityRes);
      } catch (error) {
        console.error('Failed to load published pages:', error);
        setFrontPage(null);
        setSections(DEFAULT_HOMEPAGE_SECTIONS);
        setPublishedPages([]);
        setContactSettings(null);
        setIdentitySettings(null);
        setLoadError('Loading content is taking too long. Please refresh to retry.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublishedPages();
  }, []);

  useEffect(() => {
    if (loading) return;

    const siteTitle = identitySettings?.siteTitle?.trim() || 'FlareCMS';
    const defaultDescription = identitySettings?.defaultMetaDescription?.trim() || 'A lightning-fast, beautifully crafted content management system built with React and Firebase.';
    const defaultOgImage = identitySettings?.defaultOgImagePath?.trim() || '';
    const faviconUrl = identitySettings?.faviconUrl?.trim() || '';

    if (frontPage) {
      const metaTitle = frontPage?.seoMetadata?.metaTitle?.trim();
      const metaDescription = frontPage?.seoMetadata?.metaDescription?.trim();
      applySeo({
        title: metaTitle || `${frontPage.title} | ${siteTitle}`,
        description: metaDescription || fallbackDescriptionFromBlocks(frontPage.blocks) || defaultDescription,
        type: 'website',
        ogImage: defaultOgImage,
        faviconUrl,
      });
      return;
    }

    applySeo({
      title: siteTitle,
      description: defaultDescription,
      type: 'website',
      ogImage: defaultOgImage,
      faviconUrl,
    });
  }, [loading, frontPage, identitySettings]);

  if (loading) {
    return (
      <div className="site-layout loading-state">
        <div className="spinner"></div>
      </div>
    );
  }

  const visibleSections = sections.filter((section) => section?.visible !== false);
  const sectionsToRender = visibleSections.length > 0
    ? visibleSections
    : [{
      id: 'fallback-hero',
      type: 'hero',
      bgStyle: 'default',
      visible: true,
      _fallback: true,
    }];

  const renderPageCards = (items) => {
    if (!items.length) {
      return (
        <div className="empty-state" style={{ paddingTop: 10 }}>
          <p>No published pages available for this section.</p>
        </div>
      );
    }

    return (
      <div className="page-grid">
        {items.map((page) => (
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
    );
  };

  return (
    <div className="site-layout">
      <header className="site-header">
        <div className="header-content">
          <Link to="/" className="site-logo">{headerSettings?.logoText || identitySettings?.siteTitle || 'FlareCMS'}</Link>
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
        {sectionsToRender.map((section, index) => {
          const bgClass = sectionBgClass(section?.bgStyle);
          const key = section?.id || `${section?.type || 'section'}-${index}`;

          if (section?.type === 'hero') {
            return (
              <section key={key} className={`${bgClass} home-section-hero`}>
                {!section?._fallback && (section?.title || section?.subtitle) && (
                  <div className="home-section-head">
                    {section?.title && <h2 className="home-section-title-main">{section.title}</h2>}
                    {section?.subtitle && <p className="home-section-subtitle">{section.subtitle}</p>}
                  </div>
                )}

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
                      {headerSettings?.logoText || identitySettings?.siteTitle || 'FlareCMS'}
                      <em>editorial</em>
                    </h1>
                    <p className="pub-splash-desc">
                      {section?.subtitle || identitySettings?.siteTagline || 'A lightning-fast, beautifully crafted content management system built with React and Firebase.'}
                    </p>
                  </section>
                )}
              </section>
            );
          }

          if (section?.type === 'featured_posts') {
            return (
              <section key={key} className={`${bgClass} pub-pages-section`}>
                {(section?.title || section?.subtitle) && (
                  <div className="home-section-head">
                    {section?.title && <h2 className="home-section-title-main">{section.title}</h2>}
                    {section?.subtitle && <p className="home-section-subtitle">{section.subtitle}</p>}
                  </div>
                )}
                {renderPageCards(publishedPages.slice(0, 3))}
              </section>
            );
          }

          if (section?.type === 'latest_posts') {
            return (
              <section key={key} className={`${bgClass} pub-pages-section`}>
                {(section?.title || section?.subtitle) && (
                  <div className="home-section-head">
                    {section?.title && <h2 className="home-section-title-main">{section.title}</h2>}
                    {section?.subtitle && <p className="home-section-subtitle">{section.subtitle}</p>}
                  </div>
                )}
                {renderPageCards(publishedPages.slice(0, 6))}
              </section>
            );
          }

          if (section?.type === 'newsletter' || section?.type === 'cta_band') {
            return (
              <section key={key} className={`${bgClass} home-callout-band`}>
                {(section?.title || section?.subtitle) && (
                  <div className="home-section-head">
                    {section?.title && <h2 className="home-section-title-main">{section.title}</h2>}
                    {section?.subtitle && <p className="home-section-subtitle">{section.subtitle}</p>}
                  </div>
                )}
                <Link to="/" className="btn-primary">Explore Homepage</Link>
              </section>
            );
          }

          return null;
        })}

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
          <div className="site-footer-brand">{headerSettings?.logoText || identitySettings?.siteTitle || 'Cuvée Slate'}</div>

          {(contactSettings?.organizationName || contactSettings?.email || contactSettings?.phone || contactSettings?.officeHours || contactSettings?.address || contactSettings?.mapUrl) && (
            <div className="footer-contact-meta">
              {contactSettings?.organizationName && <p>{contactSettings.organizationName}</p>}
              {(contactSettings?.email || contactSettings?.phone) && (
                <p>
                  {contactSettings?.email && <a href={`mailto:${contactSettings.email}`}>{contactSettings.email}</a>}
                  {contactSettings?.email && contactSettings?.phone ? ' · ' : ''}
                  {contactSettings?.phone && <a href={`tel:${contactSettings.phone}`}>{contactSettings.phone}</a>}
                </p>
              )}
              {contactSettings?.officeHours && <p>{contactSettings.officeHours}</p>}
              {contactSettings?.address && <p>{contactSettings.address}</p>}
              {contactSettings?.mapUrl && (
                <p>
                  <a href={contactSettings.mapUrl} target="_blank" rel="noopener noreferrer">View map</a>
                </p>
              )}
            </div>
          )}

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

