import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const MAX_META_DESC = 160;

const DEFAULT_SETTINGS = {
  siteTitle: 'FlareCMS',
  siteTagline: 'A lightning-fast editorial CMS.',
  defaultMetaDescription: '',
  defaultOgImagePath: '',
  faviconUrl: '',
};

export const SiteIdentityEditor = () => {
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
        getSettings('identity'),
        callGetSettingsHistory('identity', 10),
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
      await callSaveGlobalSettings('identity', settings, publishNow);
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
      await callRestoreSettingsVersion('identity', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const metaDescLen = (settings.defaultMetaDescription || '').length;

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div className="settings-page-shell">
      <div className="admin-section-header">
        <div className="settings-page-header-main">
          <div className="settings-page-kicker">Settings • Identity</div>
          <h1 className="settings-page-title">Identity Settings</h1>
          <p className="settings-page-description">
            Customize your site&apos;s identity foundation. Manage title systems, brand language, and
            default metadata anchors across all editorial pages.
          </p>
        </div>
        <div className="settings-page-header-actions">
          {isEditor && <span className="settings-role-notice">Editor Preview</span>}
        </div>
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
        <h2>Brand Identity</h2>

        <div className="settings-field">
          <label className="settings-label">Site Title</label>
          <input
            className="settings-input"
            placeholder="FlareCMS"
            value={settings.siteTitle}
            onChange={(e) => setSettings((s) => ({ ...s, siteTitle: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Site Tagline</label>
          <input
            className="settings-input"
            placeholder="A lightning-fast editorial CMS."
            value={settings.siteTagline}
            onChange={(e) => setSettings((s) => ({ ...s, siteTagline: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Default Meta Description</label>
          <textarea
            className="settings-textarea"
            maxLength={MAX_META_DESC + 20}
            placeholder="Describe your site in 160 characters or fewer."
            value={settings.defaultMetaDescription}
            onChange={(e) => setSettings((s) => ({ ...s, defaultMetaDescription: e.target.value }))}
            disabled={!isAdmin}
          />
          <span className={`settings-char-counter${metaDescLen > MAX_META_DESC ? ' over' : metaDescLen > 140 ? ' warn' : ''}`}>
            {metaDescLen}/{MAX_META_DESC}
          </span>
        </div>

        <div className="settings-field">
          <label className="settings-label">Default OG Image Path</label>
          <input
            className="settings-input"
            placeholder="/images/og-default.jpg"
            value={settings.defaultOgImagePath}
            onChange={(e) => setSettings((s) => ({ ...s, defaultOgImagePath: e.target.value }))}
            disabled={!isAdmin}
          />
          <span className="settings-hint">Use the media manager to upload, then paste the path here.</span>
        </div>

        <div className="settings-field">
          <label className="settings-label">Favicon URL</label>
          <input
            className="settings-input"
            placeholder="/favicon.ico"
            value={settings.faviconUrl}
            onChange={(e) => setSettings((s) => ({ ...s, faviconUrl: e.target.value }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Theme</label>
          <input
            className="settings-input"
            value="Theme locked to Champagne + Slate design language"
            readOnly
            style={{ color: '#94a3b8', cursor: 'not-allowed' }}
          />
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

      <div className="settings-card settings-history-card">
        <h2>Version History</h2>
        <div className="settings-version-list">
          {history.map((v) => (
            <div className="settings-version-item" key={v.id}>
              <div className="version-meta">
                <span className="version-who">{v.savedByEmail || 'Unknown'}</span>
                {' · '}
                {parseFirestoreTimestamp(v.savedAt).toLocaleString()}
                {v.isPublished && (
                  <span className="admin-badge settings-published-badge">
                    Published
                  </span>
                )}
              </div>
              {isAdmin && (
                <button
                  className="admin-button-secondary settings-restore-btn"
                  onClick={() => handleRestore(v.id)}
                  disabled={saving}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
          {history.length === 0 && (
            <p className="settings-history-empty">No saved versions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
