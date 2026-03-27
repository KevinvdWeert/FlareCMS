import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Share2, Eye } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const DEFAULT_SETTINGS = {
  footerText: '',
  copyrightLine: `© ${new Date().getFullYear()} FlareCMS. Built with passion.`,
  contactEmail: '',
  socialLinks: [],
  legalLinks: [],
};

const LinkRow = ({ item, onChange, onRemove, placeholderLabel, placeholderUrl }) => (
  <div className="settings-dynamic-row footer-settings-row">
    <input
      className="settings-input footer-settings-input"
      placeholder={placeholderLabel || 'Label'}
      value={item.label}
      onChange={(e) => onChange({ ...item, label: e.target.value })}
    />
    <input
      className="settings-input footer-settings-input"
      placeholder={placeholderUrl || 'URL'}
      value={item.url}
      onChange={(e) => onChange({ ...item, url: e.target.value })}
    />
    <button type="button" className="settings-remove-btn footer-settings-remove" onClick={onRemove} aria-label="Remove">
      <X size={15} />
    </button>
  </div>
);

export const FooterEditor = () => {
  const { isAdmin, profile } = useAuth();
  const isEditor = profile?.role === 'editor';

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stagingData, setStagingData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, histRes] = await Promise.all([
        getSettings('footer'),
        callGetSettingsHistory('footer', 10),
      ]);
      if (data) {
        const { _staging, _stagingToken, _published, _publishedAt, _updatedAt, _updatedBy, ...rest } = data;
        setSettings({ ...DEFAULT_SETTINGS, ...rest });
        setStagingData(data._staging ? { _staging: true, _stagingToken: data._stagingToken } : null);
      }
      setHistory(histRes?.data?.versions || []);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (publishNow) => {
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await callSaveGlobalSettings('footer', settings, publishNow);
      setMsg({ type: 'success', text: publishNow ? 'Published live!' : 'Saved as draft.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!window.confirm('Restore this version? Current settings will be overwritten.')) return;
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await callRestoreSettingsVersion('footer', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const updateList = (field, index, value) => {
    const list = [...(settings[field] || [])];
    list[index] = value;
    setSettings((s) => ({ ...s, [field]: list }));
  };

  const addListItem = (field) => {
    setSettings((s) => ({ ...s, [field]: [...(s[field] || []), { label: '', url: '' }] }));
  };

  const removeListItem = (field, index) => {
    setSettings((s) => ({ ...s, [field]: (s[field] || []).filter((_, i) => i !== index) }));
  };

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div className="footer-settings-page">
      <header className="footer-settings-hero">
        <div className="footer-settings-kicker">Settings • Footer</div>
        <h1>Footer Settings</h1>
        <p>
          Customize your site's foundation. Manage brand messaging, global navigation links, and
          legal compliance anchors across all editorial pages.
        </p>
        {isEditor && <span className="settings-role-notice">Editor Preview</span>}
      </header>

      <section className="footer-settings-section">
        <div className="footer-settings-section-head">
          <span className="footer-settings-index">01</span>
          <h2>Core Content</h2>
        </div>

        <div className="settings-card footer-settings-surface">
          <div className="settings-field">
            <label className="settings-label footer-settings-label">Footer Tagline</label>
            <textarea
              className="settings-textarea footer-settings-input"
              placeholder="A brief narrative about your brand's mission..."
              value={settings.footerText}
              onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>

          <div className="footer-settings-grid-2">
            <div className="settings-field">
              <label className="settings-label footer-settings-label">Copyright Line</label>
              <input
                className="settings-input footer-settings-input"
                placeholder={`© ${new Date().getFullYear()} FlareCMS. Built with passion.`}
                value={settings.copyrightLine}
                onChange={(e) => setSettings((s) => ({ ...s, copyrightLine: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>

            <div className="settings-field">
              <label className="settings-label footer-settings-label">Contact Email</label>
              <input
                className="settings-input footer-settings-input"
                type="email"
                placeholder="hello@yourbrand.com"
                value={settings.contactEmail}
                onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="footer-settings-section">
        <div className="footer-settings-section-head footer-settings-section-head-between">
          <div className="footer-settings-section-head-group">
            <span className="footer-settings-index">02</span>
            <h2>Social Networks</h2>
          </div>
          {isAdmin && (
            <button type="button" className="footer-settings-inline-add" onClick={() => addListItem('socialLinks')}>
              <Plus size={13} />
              <span>Add Social Link</span>
            </button>
          )}
        </div>

        <div className="settings-dynamic-list footer-settings-list">
          {(settings.socialLinks || []).map((item, i) => (
            <div key={i} className="footer-settings-social-item">
              <Share2 size={15} />
              <LinkRow
                item={item}
                placeholderLabel="Platform"
                placeholderUrl="https://..."
                onChange={(val) => updateList('socialLinks', i, val)}
                onRemove={() => removeListItem('socialLinks', i)}
              />
            </div>
          ))}
          {(settings.socialLinks || []).length === 0 && (
            <div className="footer-settings-empty">No social links yet.</div>
          )}
        </div>
      </section>

      <section className="footer-settings-section">
        <div className="footer-settings-section-head footer-settings-section-head-between">
          <div className="footer-settings-section-head-group">
            <span className="footer-settings-index">03</span>
            <h2>Legal Compliance</h2>
          </div>
          {isAdmin && (
            <button type="button" className="footer-settings-inline-add" onClick={() => addListItem('legalLinks')}>
              <Plus size={13} />
              <span>Add Legal Link</span>
            </button>
          )}
        </div>

        <div className="footer-settings-grid-2 footer-settings-legal-grid">
          {(settings.legalLinks || []).map((item, i) => (
            <div key={i} className="footer-settings-legal-card">
              <div className="footer-settings-legal-head">
                <label className="settings-label footer-settings-label">
                  {item.label || `Legal Link ${i + 1}`}
                </label>
                <button type="button" className="settings-remove-btn footer-settings-remove" onClick={() => removeListItem('legalLinks', i)} aria-label="Remove legal link">
                  <X size={14} />
                </button>
              </div>
              <LinkRow
                item={item}
                placeholderLabel="Label (e.g. Privacy Policy)"
                placeholderUrl="/privacy-policy"
                onChange={(val) => updateList('legalLinks', i, val)}
                onRemove={() => removeListItem('legalLinks', i)}
              />
            </div>
          ))}
          {(settings.legalLinks || []).length === 0 && (
            <div className="footer-settings-empty">No legal links yet.</div>
          )}
        </div>
      </section>

      <section className="footer-settings-section">
        <div className="footer-settings-section-head">
          <Eye size={15} />
          <h2>Live Preview</h2>
        </div>

        <div className="settings-preview-panel footer-settings-preview-wrap">
          <div className="settings-preview-content footer-settings-preview-surface">
            <footer className="footer-settings-preview-footer">
              <div className="footer-settings-preview-brand">Cuvée Slate</div>
              <p className="footer-settings-preview-tagline">
                {settings.footerText || 'Crafting digital narratives with the precision of a master sommelier.'}
              </p>

              {settings.legalLinks?.length > 0 && (
                <nav className="footer-settings-preview-links">
                  {settings.legalLinks.map((link, i) => (
                    <a key={link.url || i} href={link.url || '#'}>{link.label || 'Link'}</a>
                  ))}
                </nav>
              )}

              {settings.socialLinks?.length > 0 && (
                <div className="footer-settings-preview-social">
                  {settings.socialLinks.slice(0, 3).map((item, i) => (
                    <a key={item.url || i} href={item.url || '#'} aria-label={item.label || 'Social link'}>
                      <Share2 size={12} />
                    </a>
                  ))}
                </div>
              )}

              <div className="footer-settings-preview-divider" />
              <p className="footer-settings-preview-copy">
                {settings.copyrightLine || `© ${new Date().getFullYear()} FlareCMS. Built with passion.`}
              </p>
            </footer>
          </div>
        </div>
      </section>

      <div className="footer-settings-sticky-actions">
        {stagingData?._staging && (
          <div className="settings-staging-banner">
            <span className="staging-icon">⚠️</span>
            <span className="staging-text">
              You have unsaved draft changes.
              Token: <span className="settings-staging-token">{stagingData._stagingToken}</span>
            </span>
          </div>
        )}

        {msg.text && (
          <div className={msg.type === 'error' ? 'settings-error' : 'settings-success'}>{msg.text}</div>
        )}

        {isAdmin && (
          <div className="settings-actions">
            <button
              className="admin-button-secondary"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              Save Draft
            </button>
            <button
              className="admin-button-primary"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Publish Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="settings-card footer-settings-history-card">
        <h2>Version History</h2>
        <div className="settings-version-list">
          {history.map((v) => (
            <div className="settings-version-item" key={v.id}>
              <div className="version-meta">
                <span className="version-who">{v.savedByEmail || 'Unknown'}</span>
                {' · '}
                {parseFirestoreTimestamp(v.savedAt).toLocaleString()}
                {v.isPublished && (
                  <span className="admin-badge" style={{ marginLeft: 8, background: '#dcfce7', color: '#166534' }}>
                    Published
                  </span>
                )}
              </div>
              {isAdmin && (
                <button
                  className="admin-button-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => handleRestore(v.id)}
                  disabled={saving}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
          {history.length === 0 && (
            <p style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No saved versions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
