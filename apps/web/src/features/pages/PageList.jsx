import React, { useEffect, useState } from 'react';
import { getPages, deletePage } from '../../lib/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { Edit, Trash, Plus } from 'lucide-react';

export const PageList = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const PAGES_PER_LOAD = 10;

  const fetchAllPages = async () => {
    setLoading(true);
    try {
      const data = await getPages(false);
      setPages(data);
    } catch (err) {
      console.error("Error fetching pages:", err);
      alert("Failed to load pages. Check Firestore permissions.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllPages();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this page?")) {
      await deletePage(id);
      await fetchAllPages();
    }
  };

  const displayedPages = pages.slice(0, PAGES_PER_LOAD);
  const hasMorePages = pages.length > PAGES_PER_LOAD;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Pages</h1>
        <Link to="/admin/pages/new" style={{ background: '#0ea5e9', color: 'white', padding: '10px 15px', textDecoration: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={18} /> Create Page
        </Link>
      </div>

      {loading ? (
        <p>Loading pages...</p>
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '15px' }}>Title</th>
              <th style={{ padding: '15px' }}>Slug</th>
              <th style={{ padding: '15px' }}>Status</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedPages.map((page) => (
              <tr key={page.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '15px' }}>{page.title}</td>
                <td style={{ padding: '15px', color: '#64748b' }}>/{page.slug}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    background: page.status === 'published' ? '#dcfce7' : '#f1f5f9',
                    color: page.status === 'published' ? '#166534' : '#475569'
                  }}>
                    {page.status}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'right' }}>
                  <Link to={`/admin/pages/${page.id}`} style={{ marginRight: '15px', color: '#0ea5e9' }}>
                    <Edit size={18} />
                  </Link>
                  <button onClick={() => handleDelete(page.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No pages found. Create one to get started.</td>
              </tr>
            )}
          </tbody>
          </table>
          {hasMorePages && (
            <p style={{ marginTop: '20px', textAlign: 'center', color: '#64748b' }}>
              Showing {displayedPages.length} of {pages.length} pages
            </p>
          )}
        </div>
      )}
    </div>
  );
};
