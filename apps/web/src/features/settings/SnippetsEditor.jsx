import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const SNIPPET_TYPES = ['announcement_bar', 'promo_strip', 'trust_badge_row', 'disclaimer'];

const newSnippet = () => ({
  id: `snippet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: 'announcement_bar',
  title: '',
  content: '',
  enabled: true,
});

const Toggle = ({ checked, onChange, disabled }) => (
  <label className="settings-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
    <span className="settings-toggle-track" />
  </label>
);

export const SnippetsEditor = () => {
  const { isAdmin, profile } = useAuth();
  const isEditor = profile?.role === 'editor';

  const [snippets, setSnippets] = useState([]);
  const [stagingData, setStagingData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, histRes] = await Promise.all([
        getSettings('snippets'),
        callGetSettingsHistory('snippets', 10),
      ]);
      if (data?.snippets) {
        setSnippets(data.snippets);
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
      await callSaveGlobalSettings('snippets', { snippets }, publishNow);
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
      await callRestoreSettingsVersion('snippets', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const updateSnippet = (index, field, value) => {
    setSnippets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div className="settings-page-shell">
      <div className="admin-section-header">
        <div className="settings-page-header-main">
          <div className="settings-page-kicker">Settings • Snippets</div>
          <h1 className="settings-page-title">Snippets Settings</h1>
          <p className="settings-page-description">
            Customize reusable messaging. Manage announcement content, promo strips, and shared
            editorial snippets across all public pages.
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
        <h2>Snippets</h2>
        <p className="settings-muted-note">
          Manage reusable content snippets like announcement bars, promo strips, and disclaimers.
        </p>

        {snippets.map((snippet, i) => (
          <div key={snippet.id} className="settings-item-card">
            <div className="settings-item-head">
              <div className="settings-row">
                <Toggle
                  checked={snippet.enabled}
                  onChange={(val) => updateSnippet(i, 'enabled', val)}
                  disabled={!isAdmin}
                />
                <span className="settings-checkbox-note" style={{ color: snippet.enabled ? '#1b1c15' : '#82756a', fontWeight: 600 }}>
                  {snippet.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="settings-remove-btn"
                  onClick={() => setSnippets((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="settings-two-col" style={{ marginBottom: 8 }}>
              <div className="settings-field" style={{ margin: 0 }}>
                <label className="settings-label">Title</label>
                <input
                  className="settings-input"
                  placeholder="Snippet title"
                  value={snippet.title}
                  onChange={(e) => updateSnippet(i, 'title', e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="settings-field" style={{ margin: 0 }}>
                <label className="settings-label">Type</label>
                <select
                  className="settings-select"
                  value={snippet.type}
                  onChange={(e) => updateSnippet(i, 'type', e.target.value)}
                  disabled={!isAdmin}
                >
                  {SNIPPET_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-field" style={{ margin: 0 }}>
              <label className="settings-label">Content</label>
              <textarea
                className="settings-textarea"
                placeholder="Snippet content…"
                value={snippet.content}
                onChange={(e) => updateSnippet(i, 'content', e.target.value)}
                disabled={!isAdmin}
                style={{ minHeight: 60 }}
              />
            </div>
          </div>
        ))}

        {isAdmin && (
          <button
            type="button"
            className="settings-add-btn"
            onClick={() => setSnippets((prev) => [...prev, newSnippet()])}
          >
            <Plus size={14} /> Add Snippet
          </button>
        )}
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
