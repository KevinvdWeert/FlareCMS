import React, { useEffect, useState } from 'react';
import { getPagesPaginated, deletePage } from '../../lib/firestore';
import { Link } from 'react-router-dom';
import { Edit, Trash, Plus } from 'lucide-react';

export const PageList = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMorePages, setHasMorePages] = useState(false);
  const PAGE_SIZE = 10;

  const fetchPageChunk = async ({ next = false } = {}) => {
    if (next) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await getPagesPaginated({
        pageSize: PAGE_SIZE,
        cursor: next ? cursor : null
      });
      setPages((prev) => (next ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setHasMorePages(data.hasMore);
    } catch (err) {
      console.error("Error fetching pages:", err);
      alert("Failed to load pages. Check Firestore permissions.");
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

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h1>Pages</h1>
        <Link to="/admin/pages/new" className="admin-button-primary">
          <Plus size={18} />
          <span>Create Page</span>
        </Link>
      </div>

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
            {pages.map((page) => (
              <tr key={page.id}>
                <td>{page.title}</td>
                <td className="admin-cell-muted">/{page.slug}</td>
                <td>
                  <span className={`admin-badge ${page.status === 'published' ? 'published' : 'draft'}`}>
                    {page.status}
                  </span>
                </td>
                <td className="align-right">
                  <Link to={`/admin/pages/${page.id}`} className="admin-icon-action edit" aria-label="Edit page">
                    <Edit size={18} />
                  </Link>
                  <button onClick={() => handleDelete(page.id)} className="admin-icon-action delete" aria-label="Delete page">
                    <Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan="4" className="admin-empty-row">No pages found. Create one to get started.</td>
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
