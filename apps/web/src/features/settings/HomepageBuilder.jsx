import React, { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { getSettings, parseFirestoreTimestamp } from '../../lib/firestore';
import {
  callSaveGlobalSettings,
  callGetSettingsHistory,
  callRestoreSettingsVersion,
} from '../../lib/functions';

const SECTION_TYPES = ['hero', 'featured_posts', 'latest_posts', 'newsletter', 'cta_band'];
const BG_STYLES = ['default', 'surface_low', 'surface_high'];

const DEFAULT_SECTIONS = [
  { id: 'hero', type: 'hero', title: 'Welcome', subtitle: 'A lightning-fast CMS.', bgStyle: 'default', visible: true },
  { id: 'featured_posts', type: 'featured_posts', title: 'Featured', subtitle: '', bgStyle: 'surface_low', visible: true },
  { id: 'latest_posts', type: 'latest_posts', title: 'Latest', subtitle: '', bgStyle: 'default', visible: true },
];

const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr;
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
};

const newSection = () => ({
  id: `section_${Date.now()}`,
  type: 'cta_band',
  title: '',
  subtitle: '',
  bgStyle: 'default',
  visible: true,
});

export const HomepageBuilder = () => {
  const { isAdmin, profile } = useAuth();
  const isEditor = profile?.role === 'editor';

  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [stagingData, setStagingData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, histRes] = await Promise.all([
        getSettings('homepage'),
        callGetSettingsHistory('homepage', 10),
      ]);
      if (data?.sections) {
        setSections(data.sections);
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
      await callSaveGlobalSettings('homepage', { sections }, publishNow);
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
      await callRestoreSettingsVersion('homepage', versionId);
      setMsg({ type: 'success', text: 'Version restored.' });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index, field, value) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (loading) return <div className="admin-section"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-section-header">
        <h1>Homepage Builder</h1>
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
        <h2>Page Sections</h2>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 16 }}>
          Arrange and configure sections that appear on the public homepage.
        </p>
        {sections.map((section, i) => (
          <div key={section.id} className={`section-builder-row${!section.visible ? ' hidden-section' : ''}`}>
            {isAdmin && (
              <div className="section-builder-handles">
                <button
                  type="button"
                  className="settings-remove-btn"
                  onClick={() => setSections((prev) => move(prev, i, i - 1))}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className="settings-remove-btn"
                  onClick={() => setSections((prev) => move(prev, i, i + 1))}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
            <div className="section-builder-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="section-builder-type-badge">{section.type}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={section.visible}
                    onChange={(e) => updateSection(i, 'visible', e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Visible
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="settings-field" style={{ margin: 0 }}>
                  <label className="settings-label">Title</label>
                  <input
                    className="settings-input"
                    value={section.title}
                    onChange={(e) => updateSection(i, 'title', e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="settings-field" style={{ margin: 0 }}>
                  <label className="settings-label">Type</label>
                  <select
                    className="settings-select"
                    value={section.type}
                    onChange={(e) => updateSection(i, 'type', e.target.value)}
                    disabled={!isAdmin}
                    style={{ width: '100%' }}
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="settings-field" style={{ margin: 0 }}>
                <label className="settings-label">Subtitle</label>
                <input
                  className="settings-input"
                  value={section.subtitle}
                  onChange={(e) => updateSection(i, 'subtitle', e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="settings-field" style={{ margin: 0 }}>
                <label className="settings-label">Background Style</label>
                <select
                  className="settings-select"
                  value={section.bgStyle}
                  onChange={(e) => updateSection(i, 'bgStyle', e.target.value)}
                  disabled={!isAdmin}
                  style={{ width: '100%' }}
                >
                  {BG_STYLES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                className="settings-remove-btn"
                onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))}
                title="Remove section"
                style={{ alignSelf: 'flex-start' }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <button type="button" className="settings-add-btn" onClick={() => setSections((prev) => [...prev, newSection()])}>
            <Plus size={14} /> Add Section
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
