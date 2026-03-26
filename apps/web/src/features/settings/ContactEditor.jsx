import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const DEFAULT_SETTINGS = {
  organizationName: '',
  address: '',
  phone: '',
  email: '',
  officeHours: '',
  mapUrl: '',
};

export const ContactEditor = () => {
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
        getSettings('contact'),
        callGetSettingsHistory('contact', 10),
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
      await callSaveGlobalSettings('contact', settings, publishNow);
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
      await callRestoreSettingsVersion('contact', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setSettings((s) => ({ ...s, [field]: e.target.value }));

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-section-header">
        <h1>Contact &amp; Organization Info</h1>
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
        <h2>Organization Details</h2>
        <div className="contact-info-grid">
          <div className="settings-field">
            <label className="settings-label">Organization Name</label>
            <input className="settings-input" placeholder="Acme Inc." value={settings.organizationName} onChange={set('organizationName')} disabled={!isAdmin} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Email</label>
            <input className="settings-input" type="email" placeholder="contact@example.com" value={settings.email} onChange={set('email')} disabled={!isAdmin} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Phone</label>
            <input className="settings-input" type="tel" placeholder="+1 (555) 000-0000" value={settings.phone} onChange={set('phone')} disabled={!isAdmin} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Office Hours</label>
            <input className="settings-input" placeholder="Mon–Fri, 9 AM–5 PM" value={settings.officeHours} onChange={set('officeHours')} disabled={!isAdmin} />
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Address</label>
          <textarea className="settings-textarea" placeholder="123 Main St, City, State ZIP" value={settings.address} onChange={set('address')} disabled={!isAdmin} style={{ minHeight: 60 }} />
        </div>

        <div className="settings-field">
          <label className="settings-label">Map URL</label>
          <input className="settings-input" placeholder="https://maps.google.com/..." value={settings.mapUrl} onChange={set('mapUrl')} disabled={!isAdmin} />
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
