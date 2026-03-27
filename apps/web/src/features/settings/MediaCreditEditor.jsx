import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const LICENSE_STYLES = [
  { value: 'hidden', label: 'Hidden' },
  { value: 'tooltip', label: 'Tooltip on hover' },
  { value: 'inline', label: 'Inline text' },
];

const DEFAULT_SETTINGS = {
  requireAltText: true,
  requirePhotographerCredit: false,
  showCaptionOnPublicPages: true,
  showCreditOnPublicPages: true,
  licenseDisplayStyle: 'hidden',
};

const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <div className="settings-toggle-row">
    <div>
      <div className="settings-toggle-label">{label}</div>
      {description && <div className="settings-hint">{description}</div>}
    </div>
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="settings-toggle-track" />
    </label>
  </div>
);

export const MediaCreditEditor = () => {
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
        getSettings('media-credits'),
        callGetSettingsHistory('media-credits', 10),
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
      await callSaveGlobalSettings('media-credits', settings, publishNow);
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
      await callRestoreSettingsVersion('media-credits', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const setBool = (field) => (val) => setSettings((s) => ({ ...s, [field]: val }));

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div className="settings-page-shell">
      <div className="admin-section-header">
        <div className="settings-page-header-main">
          <div className="settings-page-kicker">Settings • Media Credits</div>
          <h1 className="settings-page-title">Media Credits Settings</h1>
          <p className="settings-page-description">
            Customize media governance. Manage attribution requirements, caption visibility, and
            licensing presentation across all editorial pages.
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
        <h2>Display Rules</h2>

        <Toggle
          label="Require Alt Text"
          description="Flag media without descriptive alt text."
          checked={settings.requireAltText}
          onChange={setBool('requireAltText')}
          disabled={!isAdmin}
        />
        <Toggle
          label="Require Photographer Credit"
          description="Media must have a photographer credit field filled."
          checked={settings.requirePhotographerCredit}
          onChange={setBool('requirePhotographerCredit')}
          disabled={!isAdmin}
        />
        <Toggle
          label="Show Caption on Public Pages"
          description="Display the caption below media on public-facing pages."
          checked={settings.showCaptionOnPublicPages}
          onChange={setBool('showCaptionOnPublicPages')}
          disabled={!isAdmin}
        />
        <Toggle
          label="Show Credit on Public Pages"
          description="Display photographer/source credit on public-facing pages."
          checked={settings.showCreditOnPublicPages}
          onChange={setBool('showCreditOnPublicPages')}
          disabled={!isAdmin}
        />

        <div className="settings-field" style={{ marginTop: 14 }}>
          <label className="settings-label">License Display Style</label>
          <select
            className="settings-select"
            value={settings.licenseDisplayStyle}
            onChange={(e) => setSettings((s) => ({ ...s, licenseDisplayStyle: e.target.value }))}
            disabled={!isAdmin}
            style={{ width: '100%' }}
          >
            {LICENSE_STYLES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
