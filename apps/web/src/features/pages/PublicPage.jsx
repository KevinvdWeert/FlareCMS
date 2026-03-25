import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPageBySlug } from '../../lib/firestore';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { useImageUrl } from '../../hooks/useImageUrl';

export const PublicPage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchPageContent = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await Promise.race([
          getPageBySlug(slug),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading page.')), 5000)
          )
        ]);
        setPage(data);
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
            <Link to="/" className="site-logo">FlareCMS</Link>
          </div>
        </header>
        <main className="not-found">
          <h1>404</h1>
          <p>{loadError || `Page "${slug}" not found.`}</p>
          <Link to="/" className="btn-primary">← Go Home</Link>
        </main>
        <footer className="site-footer">
          <p>&copy; {new Date().getFullYear()} FlareCMS.</p>
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
          <Link to="/" className="site-logo">FlareCMS</Link>
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
        <p>&copy; {new Date().getFullYear()} FlareCMS.</p>
      </footer>
    </div>
  );
};

