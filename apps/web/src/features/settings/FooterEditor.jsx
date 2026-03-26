import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
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
  <div className="settings-dynamic-row">
    <input
      className="settings-input"
      placeholder={placeholderLabel || 'Label'}
      value={item.label}
      onChange={(e) => onChange({ ...item, label: e.target.value })}
    />
    <input
      className="settings-input"
      placeholder={placeholderUrl || 'URL'}
      value={item.url}
      onChange={(e) => onChange({ ...item, url: e.target.value })}
    />
    <button type="button" className="settings-remove-btn" onClick={onRemove} aria-label="Remove">
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
    <div>
      <div className="admin-section-header">
        <h1>Footer Settings</h1>
        {isEditor && <span className="settings-role-notice">👁 Editor Preview</span>}
      </div>

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

      <div className="settings-card">
        <h2>Footer Content</h2>

        <div className="settings-field">
          <label className="settings-label">Footer Tagline</label>
          <textarea
            className="settings-textarea"
            placeholder="Footer description or tagline"
            value={settings.footerText}
            onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Copyright Line</label>
          <input
            className="settings-input"
            placeholder={`© ${new Date().getFullYear()} Company Name`}
            value={settings.copyrightLine}
            onChange={(e) => setSettings((s) => ({ ...s, copyrightLine: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Contact Email</label>
          <input
            className="settings-input"
            type="email"
            placeholder="email@example.com"
            value={settings.contactEmail}
            onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Social Links</label>
          <div className="settings-dynamic-list">
            {(settings.socialLinks || []).map((item, i) => (
              <LinkRow
                key={i}
                item={item}
                placeholderLabel="Platform (e.g. Twitter)"
                placeholderUrl="https://..."
                onChange={(val) => updateList('socialLinks', i, val)}
                onRemove={() => removeListItem('socialLinks', i)}
              />
            ))}
          </div>
          {isAdmin && (
            <button type="button" className="settings-add-btn" onClick={() => addListItem('socialLinks')}>
              <Plus size={14} /> Add Social Link
            </button>
          )}
        </div>

        <div className="settings-field">
          <label className="settings-label">Legal Links</label>
          <div className="settings-dynamic-list">
            {(settings.legalLinks || []).map((item, i) => (
              <LinkRow
                key={i}
                item={item}
                placeholderLabel="Label (e.g. Privacy Policy)"
                placeholderUrl="/privacy"
                onChange={(val) => updateList('legalLinks', i, val)}
                onRemove={() => removeListItem('legalLinks', i)}
              />
            ))}
          </div>
          {isAdmin && (
            <button type="button" className="settings-add-btn" onClick={() => addListItem('legalLinks')}>
              <Plus size={14} /> Add Legal Link
            </button>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div className="settings-preview-panel">
        <div className="settings-preview-label">Live Preview</div>
        <div className="settings-preview-content">
          <footer className="site-footer">
            {settings.footerText && <p className="footer-tagline">{settings.footerText}</p>}
            <p>{settings.copyrightLine || `© ${new Date().getFullYear()} FlareCMS. Built with passion.`}</p>
            {settings.legalLinks?.length > 0 && (
              <nav className="footer-legal-links">
                {settings.legalLinks.map((link, i) => (
                  <a key={i} href={link.url || '#'}>{link.label || 'Link'}</a>
                ))}
              </nav>
            )}
          </footer>
        </div>
      </div>

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
            {saving ? 'Saving…' : 'Publish Live'}
          </button>
        </div>
      )}

      {/* Version History */}
      <div className="settings-card" style={{ marginTop: 20 }}>
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
