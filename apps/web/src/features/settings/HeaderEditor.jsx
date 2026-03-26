import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const DEFAULT_SETTINGS = {
  logoText: 'FlareCMS',
  navItems: [],
};

const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr;
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
};

export const HeaderEditor = () => {
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
        getSettings('header'),
        callGetSettingsHistory('header', 10),
      ]);
      if (data) {
        const { _staging, _stagingToken, _published, _publishedAt, _updatedAt, _updatedBy, ...rest } = data;
        setSettings({ ...DEFAULT_SETTINGS, ...rest });
        setStagingData(data._staging ? { _staging: true, _stagingToken: data._stagingToken } : null);
      }
      setHistory(histRes?.data?.versions || []);
    } catch {
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
      await callSaveGlobalSettings('header', settings, publishNow);
      setMsg({ type: 'success', text: publishNow ? 'Published live!' : 'Saved as draft.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!window.confirm('Restore this version?')) return;
    setSaving(true);
    try {
      await callRestoreSettingsVersion('header', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const updateNavItem = (index, field, value) => {
    setSettings((s) => {
      const items = [...(s.navItems || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...s, navItems: items };
    });
  };

  const addNavItem = () => {
    setSettings((s) => ({
      ...s,
      navItems: [...(s.navItems || []), { label: '', href: '', visible: true, isExternal: false }],
    }));
  };

  const removeNavItem = (index) => {
    setSettings((s) => ({ ...s, navItems: (s.navItems || []).filter((_, i) => i !== index) }));
  };

  const reorderNavItem = (index, direction) => {
    setSettings((s) => ({ ...s, navItems: move(s.navItems || [], index, index + direction) }));
  };

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  const visibleNavItems = (settings.navItems || []).filter((n) => n.visible !== false);

  return (
    <div>
      <div className="admin-section-header">
        <h1>Header &amp; Navigation</h1>
        {isEditor && <span className="settings-role-notice">👁 Editor Preview</span>}
      </div>

      {stagingData?._staging && (
        <div className="settings-staging-banner">
          <span className="staging-icon">⚠️</span>
          <span className="staging-text">
            Unsaved draft changes.
            Token: <span className="settings-staging-token">{stagingData._stagingToken}</span>
          </span>
        </div>
      )}

      {msg.text && (
        <div className={msg.type === 'error' ? 'settings-error' : 'settings-success'}>{msg.text}</div>
      )}

      <div className="settings-card">
        <h2>Brand &amp; Logo</h2>
        <div className="settings-field">
          <label className="settings-label">Logo / Brand Text</label>
          <input
            className="settings-input"
            placeholder="FlareCMS"
            value={settings.logoText}
            onChange={(e) => setSettings((s) => ({ ...s, logoText: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div className="settings-card">
        <h2>Navigation Items</h2>
        <div className="settings-dynamic-list">
          {(settings.navItems || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
              <div className="settings-dynamic-row">
                <input
                  className="settings-input"
                  placeholder="Label"
                  value={item.label}
                  onChange={(e) => updateNavItem(i, 'label', e.target.value)}
                  disabled={!isAdmin}
                />
                <input
                  className="settings-input"
                  placeholder="/href or https://..."
                  value={item.href}
                  onChange={(e) => updateNavItem(i, 'href', e.target.value)}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <>
                    <button type="button" className="settings-remove-btn" onClick={() => reorderNavItem(i, -1)} title="Move up">
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" className="settings-remove-btn" onClick={() => reorderNavItem(i, 1)} title="Move down">
                      <ChevronDown size={14} />
                    </button>
                    <button type="button" className="settings-remove-btn" onClick={() => removeNavItem(i)} title="Remove">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={item.visible !== false}
                    onChange={(e) => updateNavItem(i, 'visible', e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Visible
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={!!item.isExternal}
                    onChange={(e) => updateNavItem(i, 'isExternal', e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Opens in new tab
                </label>
              </div>
            </div>
          ))}
        </div>
        {isAdmin && (
          <button type="button" className="settings-add-btn" onClick={addNavItem}>
            <Plus size={14} /> Add Nav Item
          </button>
        )}
      </div>

      {/* Live Preview */}
      <div className="settings-preview-panel">
        <div className="settings-preview-label">Live Preview</div>
        <div className="settings-preview-content">
          <header className="site-header">
            <div className="header-content">
              <span className="site-logo">{settings.logoText || 'FlareCMS'}</span>
              {visibleNavItems.map((item, i) =>
                item.isExternal ? (
                  <a key={i} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="pub-nav-link">
                    {item.label || 'Link'}
                  </a>
                ) : (
                  <Link key={i} to={item.href || '/'} className="pub-nav-link">
                    {item.label || 'Link'}
                  </Link>
                )
              )}
              <span className="pub-admin-link">Admin</span>
            </div>
          </header>
        </div>
      </div>

      {isAdmin && (
        <div className="settings-actions">
          <button className="admin-button-secondary" onClick={() => handleSave(false)} disabled={saving}>
            Save Draft
          </button>
          <button className="admin-button-primary" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? 'Saving…' : 'Publish Live'}
          </button>
        </div>
      )}

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
