import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const MAX_DESC = 160;

const ROBOTS_OPTIONS = [
  { value: 'index,follow', label: 'index, follow (recommended)' },
  { value: 'noindex,follow', label: 'noindex, follow' },
  { value: 'noindex,nofollow', label: 'noindex, nofollow' },
];

const DEFAULT_SETTINGS = {
  titleTemplate: '{pageTitle} | {siteTitle}',
  descriptionFallback: '',
  socialImageFallbackPath: '',
  robotsDirective: 'index,follow',
};

export const SeoEditor = () => {
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
        getSettings('seo'),
        callGetSettingsHistory('seo', 10),
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
      await callSaveGlobalSettings('seo', settings, publishNow);
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
      await callRestoreSettingsVersion('seo', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const descLen = (settings.descriptionFallback || '').length;

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-section-header">
        <h1>SEO Defaults</h1>
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
        <h2>SEO Configuration</h2>

        <div className="settings-field">
          <label className="settings-label">Title Template</label>
          <input
            className="settings-input"
            placeholder="{pageTitle} | {siteTitle}"
            value={settings.titleTemplate}
            onChange={(e) => setSettings((s) => ({ ...s, titleTemplate: e.target.value }))}
            disabled={!isAdmin}
          />
          <span className="settings-hint">Available tokens: <code>{'{pageTitle}'}</code>, <code>{'{siteTitle}'}</code></span>
        </div>

        <div className="settings-field">
          <label className="settings-label">Default Meta Description</label>
          <textarea
            className="settings-textarea"
            maxLength={MAX_DESC + 20}
            placeholder="Used when a page has no specific description."
            value={settings.descriptionFallback}
            onChange={(e) => setSettings((s) => ({ ...s, descriptionFallback: e.target.value }))}
            disabled={!isAdmin}
          />
          <span className={`settings-char-counter${descLen > MAX_DESC ? ' over' : descLen > 140 ? ' warn' : ''}`}>
            {descLen}/{MAX_DESC}
          </span>
        </div>

        <div className="settings-field">
          <label className="settings-label">Social Image Fallback Path</label>
          <input
            className="settings-input"
            placeholder="/images/social-default.jpg"
            value={settings.socialImageFallbackPath}
            onChange={(e) => setSettings((s) => ({ ...s, socialImageFallbackPath: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Robots Directive</label>
          <select
            className="settings-select"
            value={settings.robotsDirective}
            onChange={(e) => setSettings((s) => ({ ...s, robotsDirective: e.target.value }))}
            disabled={!isAdmin}
            style={{ width: '100%' }}
          >
            {ROBOTS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 12 }}>
          Note: Existing prerender and sitemap behavior is preserved.
        </p>
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
