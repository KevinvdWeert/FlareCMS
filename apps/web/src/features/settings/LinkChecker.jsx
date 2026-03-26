import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { getPages } from '../../lib/firestore';

const isValidUrl = (href) => {
  if (!href) return false;
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/');
};

const getCategory = (href) => {
  if (!href) return 'unknown';
  if (href.startsWith('http://') || href.startsWith('https://')) return 'external';
  if (href.startsWith('/')) return 'internal';
  return 'malformed';
};

const extractLinks = (blocks, pageTitle, pageSlug) => {
  const links = [];
  if (!Array.isArray(blocks)) return links;

  const scanValue = (value, context) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.href === 'string') links.push({ pageTitle, pageSlug, linkText: value.text || value.label || '', url: value.href });
    if (typeof value.url === 'string') links.push({ pageTitle, pageSlug, linkText: value.alt || value.label || '', url: value.url });
    Object.values(value).forEach((v) => {
      if (v && typeof v === 'object') scanValue(v, context);
    });
  };

  blocks.forEach((block) => scanValue(block, pageTitle));
  return links;
};

const StatusBadge = ({ url }) => {
  const cat = getCategory(url);
  if (cat === 'malformed') return <span className="link-checker-badge-error">Malformed</span>;
  if (cat === 'external') return <span className="link-checker-badge-warn">External</span>;
  if (cat === 'internal') return <span className="link-checker-badge-ok">Internal</span>;
  return <span className="link-checker-badge-warn">Unknown</span>;
};

export const LinkChecker = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const pages = await getPages(false);
      const allLinks = [];
      pages.forEach((page) => {
        const extracted = extractLinks(page.blocks || [], page.title || 'Untitled', page.slug || '');
        allLinks.push(...extracted);
      });
      setLinks(allLinks);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);

  const filtered = filter === 'all'
    ? links
    : links.filter((l) => getCategory(l.url) === filter);

  const counts = {
    all: links.length,
    internal: links.filter((l) => getCategory(l.url) === 'internal').length,
    external: links.filter((l) => getCategory(l.url) === 'external').length,
    malformed: links.filter((l) => getCategory(l.url) === 'malformed').length,
  };

  return (
    <div>
      <div className="admin-section-header">
        <h1>Link Checker</h1>
        <button className="admin-button-secondary" onClick={scan} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      <div className="settings-card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([key, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                border: `1px solid ${filter === key ? '#0ea5e9' : '#e2e8f0'}`,
                background: filter === key ? 'rgba(14,165,233,0.08)' : '#fff',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                color: filter === key ? '#0284c7' : '#475569',
              }}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: '0.84rem', color: '#94a3b8', textAlign: 'center', padding: 32 }}>
            No links found matching this filter.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table link-checker-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Link Text</th>
                  <th>URL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((link, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '0.84rem' }}>
                      <span style={{ fontWeight: 600 }}>{link.pageTitle}</span>
                      <br />
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>/{link.pageSlug}</span>
                    </td>
                    <td style={{ fontSize: '0.84rem', color: '#475569' }}>{link.linkText || <em style={{ color: '#94a3b8' }}>no text</em>}</td>
                    <td>
                      <span className="link-checker-url">{link.url || <em style={{ color: '#94a3b8' }}>empty</em>}</span>
                    </td>
                    <td><StatusBadge url={link.url} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
