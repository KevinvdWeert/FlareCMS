import React, { useEffect, useState } from 'react';
import { getPagesPaginated, deletePage, getGeneralSettings } from '../../lib/firestore';
import { callSetFrontPage } from '../../lib/functions';
import { Link, useSearchParams } from 'react-router-dom';
import { Edit, Trash, Plus, FileStack, Home } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export const PageList = () => {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [error, setError] = useState('');
  const [frontPageId, setFrontPageId] = useState(null);
  const [settingFrontPage, setSettingFrontPage] = useState('');
  const PAGE_SIZE = 10;
  const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();

  const filteredPages = pages.filter((page) => {
    if (!searchQuery) return true;
    return (
      String(page.title || '').toLowerCase().includes(searchQuery) ||
      String(page.slug || '').toLowerCase().includes(searchQuery) ||
      String(page.status || '').toLowerCase().includes(searchQuery)
    );
  });

  const publishedCount = pages.filter((p) => p.status === 'published').length;
  const draftCount = pages.filter((p) => p.status !== 'published').length;
  const scheduledCount = pages.filter((p) => !!p.scheduledPublishAt).length;

  const fetchPageChunk = async ({ next = false } = {}) => {
    if (next) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const [data, settings] = await Promise.all([
        getPagesPaginated({ pageSize: PAGE_SIZE, cursor: next ? cursor : null }),
        next ? Promise.resolve(null) : getGeneralSettings(),
      ]);
      setPages((prev) => (next ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setHasMorePages(data.hasMore);
      if (settings !== null) {
        setFrontPageId(settings?.frontPageId ?? null);
      }
    } catch (err) {
      console.error("Error fetching pages:", err);
      setError("Failed to load pages. Check Firestore permissions.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPageChunk();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this page?")) {
      await deletePage(id);
      await fetchPageChunk();
    }
  };

  const handleSetFrontPage = async (pageId) => {
    const isCurrent = frontPageId === pageId;
    const action = isCurrent ? 'clear the front page?' : 'set this page as the front page?';
    if (!window.confirm(`Are you sure you want to ${action}`)) return;
    setSettingFrontPage(pageId);
    setError('');
    try {
      await callSetFrontPage(isCurrent ? null : pageId);
      setFrontPageId(isCurrent ? null : pageId);
    } catch (err) {
      console.error('Failed to set front page:', err);
      setError(err?.message || 'Failed to update front page setting.');
    } finally {
      setSettingFrontPage('');
    }
  };

  return (
    <div className="admin-section editorial-page-list">
      <div className="editorial-masthead">
        <div>
          <span className="editorial-kicker">Archive 2024</span>
          <h1>Content <span>Library</span></h1>
          <p>Curate and publish your editorial pages with premium control and a clear publishing rhythm.</p>
        </div>
        <div className="editorial-masthead-card">
          <FileStack size={28} />
          <strong>{pages.length}</strong>
          <span>Loaded entries</span>
        </div>
      </div>

      <div className="admin-section-header">
        <Link to="/admin/pages/new" className="admin-button-primary">
          <Plus size={18} />
          <span>Create Page</span>
        </Link>
        {searchQuery && (
          <p className="admin-muted-text">Showing matches for: {searchParams.get('q')}</p>
        )}
      </div>

      <section className="editorial-cards-grid">
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Published</span>
          <strong>{loading ? '—' : publishedCount}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Drafts</span>
          <strong>{loading ? '—' : draftCount}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Homepage</span>
          <strong>{loading ? '—' : frontPageId ? 'Set' : 'None'}</strong>
        </article>
        <article className="editorial-mini-card">
          <span className="editorial-mini-label">Scheduled</span>
          <strong>{loading ? '—' : scheduledCount}</strong>
        </article>
      </section>

      {error && <div className="admin-editor-error">{error}</div>}

      {loading ? (
        <p className="admin-muted-text">Loading pages...</p>
      ) : (
        <div className="admin-surface">
          <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th className="align-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPages.map((page) => (
              <tr key={page.id}>
                <td>
                  <span className="page-list-title">
                    {page.title}
                    {frontPageId === page.id && (
                      <span className="admin-badge front-page" title="Front page">
                        <Home size={11} />
                        Front Page
                      </span>
                    )}
                  </span>
                </td>
                <td className="admin-cell-muted">/{page.slug}</td>
                <td>
                  <span className={`admin-badge ${page.status === 'published' ? 'published' : 'draft'}`}>
                    {page.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="align-right">
                  {isAdmin && page.status === 'published' && (
                    <button
                      onClick={() => handleSetFrontPage(page.id)}
                      className={`admin-icon-action front-page${frontPageId === page.id ? ' is-active' : ''}`}
                      aria-label={frontPageId === page.id ? 'Clear front page' : 'Set as front page'}
                      disabled={settingFrontPage === page.id}
                      title={frontPageId === page.id ? 'Clear front page' : 'Set as front page'}
                    >
                      <Home size={18} />
                    </button>
                  )}
                  <Link to={`/admin/pages/${page.id}`} className="admin-icon-action edit" aria-label="Edit page">
                    <Edit size={18} />
                  </Link>
                  <button onClick={() => handleDelete(page.id)} className="admin-icon-action delete" aria-label="Delete page">
                    <Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredPages.length === 0 && (
              <tr>
                <td colSpan="4" className="admin-empty-row">
                  {searchQuery ? 'No pages matched your search.' : 'No pages found. Create one to get started.'}
                </td>
              </tr>
            )}
          </tbody>
          </table>
          {hasMorePages && (
            <div className="admin-pagination-row">
              <button
                onClick={() => fetchPageChunk({ next: true })}
                disabled={loadingMore}
                className="admin-button-secondary"
              >
                {loadingMore ? 'Loading...' : 'Load more pages'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
