import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPageBySlug } from '../../lib/firestore';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { getImageUrl } from '../../lib/storage';

export const PublicPage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heroUrl, setHeroUrl] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchPageContent = async () => {
      setLoading(true);
      setLoadError('');
      setHeroUrl(null);
      try {
        const data = await Promise.race([
          getPageBySlug(slug),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out while loading page.')), 5000)
          )
        ]);
        setPage(data);
        if (data?.featuredImage?.storagePath) {
          try {
            const url = await getImageUrl(data.featuredImage.storagePath);
            setHeroUrl(url);
          } catch (e) {
            console.error('Failed to load featured image', e);
          }
        }
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
        <main className="not-found">
          <h1>404</h1>
          <p>{loadError || `Page "${slug}" not found.`}</p>
          <Link to="/" className="btn-primary">Go Home</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="site-layout">
      <header className="site-header">
        <div className="header-content narrow-header">
          <Link to="/" className="site-logo">FlareCMS</Link>
        </div>
      </header>

      <article className="public-article">
        {heroUrl && (
          <div className="article-hero">
            <img src={heroUrl} alt={page.featuredImage?.alt || 'Featured Image'} />
          </div>
        )}
        
        <div className="article-content">
          <header className="article-title-section">
            <h1 className="article-title">{page.title}</h1>
            <div className="article-meta">
              Published on {page.publishedAt ? new Date(page.publishedAt.toMillis()).toLocaleDateString() : new Date(page.createdAt.toMillis()).toLocaleDateString()}
            </div>
          </header>
          
          <div className="article-body">
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
