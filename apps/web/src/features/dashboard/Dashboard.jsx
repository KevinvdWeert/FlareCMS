import React, { useEffect, useState } from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { callGetDashboardStats, callGetRecentActivity } from '../../lib/functions';
import { parseFirestoreTimestamp } from '../../lib/firestore';

const ACTION_LABELS = {
  page_created: 'created page',
  page_updated: 'updated page',
  page_deleted: 'deleted page',
  page_published: 'published page',
  page_unpublished: 'unpublished page',
  role_change: 'changed role',
  media_uploaded: 'uploaded media',
  media_deleted: 'deleted media',
  invite_created: 'invited user',
  invite_accepted: 'accepted invite',
};

const TRAFFIC_SERIES = [38, 56, 49, 72, 61, 86, 66, 42];
const TRAFFIC_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'MON'];

const formatActivityTime = (createdAt) => {
  if (!createdAt) return '';
  const date = parseFirestoreTimestamp(createdAt);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} day${diffD !== 1 ? 's' : ''} ago`;
};

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    setStatsLoading(true);
    callGetDashboardStats()
      .then((result) => {
        setStats(result.data);
      })
      .catch((err) => {
        console.error('Dashboard stats error:', err);
        setStatsError('Failed to load stats.');
      })
      .finally(() => setStatsLoading(false));

    setActivityLoading(true);
    callGetRecentActivity({ limit: 10 })
      .then((result) => {
        setActivity(result.data?.entries || []);
      })
      .catch((err) => {
        console.error('Activity feed error:', err);
        setActivityError('Failed to load activity.');
      })
      .finally(() => setActivityLoading(false));
  }, []);

  return (
    <div className="admin-section dashboard-screen">
      <section className="editorial-masthead dashboard-masthead">
        <div className="dashboard-masthead-copy">
          <span className="editorial-kicker">System Overview</span>
          <h1>
            The Editorial
            <br />
            <span>Monolith</span>
          </h1>
          <p>
            Welcome back. Your curated workspace is synchronized and ready for the next edition.
            Recent analytics show a 24% increase in reader engagement.
          </p>
        </div>
        <div className="dashboard-masthead-visual">
          <div className="dashboard-masthead-image">
            <img
              src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80"
              alt="Editorial workspace"
            />
          </div>
          <div className="dashboard-masthead-metric">
            <strong>{statsLoading ? '—' : (stats?.totalUsers ?? '—')}</strong>
            <span>Total Users</span>
          </div>
        </div>
      </section>

      <section className="dashboard-bento">
        <article className="dashboard-card dashboard-card-traffic" style={{ gridColumn: 'span 2' }}>
          <div className="dashboard-card-head">
            <div>
              <h3>Site Traffic Trends</h3>
              <p>Performance over the last 30 days</p>
            </div>
            <div className="dashboard-pills" aria-label="Traffic timeframe">
              <span>Daily</span>
              <span className="is-active">Weekly</span>
            </div>
          </div>

          <div className="dashboard-chart-bars" role="img" aria-label="Bar chart of weekly traffic trends">
            {TRAFFIC_SERIES.map((value, idx) => (
              <i
                key={`${TRAFFIC_LABELS[idx]}-${idx}`}
                className={idx === 5 ? 'is-highlight' : ''}
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
          <div className="dashboard-chart-labels" aria-hidden="true">
            {TRAFFIC_LABELS.map((label, idx) => (
              <span key={`${label}-${idx}`}>{label}</span>
            ))}
          </div>
        </article>

        <article className="dashboard-card dashboard-card-preview" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3>Live Preview Hub</h3>
          <div className="dashboard-preview-frame">
            <img
              src="https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=700&q=80"
              alt="Campaign preview board"
            />
          </div>
          <p className="dashboard-side-copy">
            <strong>Current Active Campaign:</strong>
            <br />
            &quot;Autumn Whispers: A Study in Minimalist Textiles&quot;
          </p>
          <button type="button" className="admin-button-primary dashboard-side-cta">
            <Sparkles size={15} />
            <span>Launch Designer Mode</span>
          </button>
        </article>

        <div className="dashboard-bento-wide">
          <div className="dashboard-bento-header">
            <div>
              <h3>Recent<br/>Activity</h3>
              <div className="dashboard-bento-accent-line" />
            </div>
            <p className="dashboard-bento-desc">
              Monitoring global contributions and editorial changes across the platform.
            </p>
          </div>

          <div className="dashboard-activity">
            {activityError && <p className="admin-editor-error">{activityError}</p>}
            <div className="dashboard-activity-list">
              {activityLoading ? (
                <div className="dashboard-activity-row"><div><p className="admin-muted-text">Loading activity…</p></div></div>
              ) : activity.length === 0 ? (
                <div className="dashboard-activity-row"><div><p className="admin-muted-text">No activity yet.</p></div></div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="dashboard-activity-row">
                    <div>
                      <p>
                        {item.actorEmail || item.actorId}{' '}
                        {ACTION_LABELS[item.action] || item.action}
                        {item.meta?.title ? ` "${item.meta.title}"` : ''}
                      </p>
                      <small>
                        {formatActivityTime(item.createdAt)}{' '}
                        &bull; {(item.resourceType || '').toUpperCase()}
                      </small>
                    </div>
                    <span aria-hidden="true">›</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-stats-row">
        <article className="dashboard-stat-card">
          <p>Published Pages</p>
          <strong>{statsLoading ? '—' : (stats?.publishedPages ?? '—')}</strong>
        </article>
        <article className="dashboard-stat-card">
          <p>Draft Pages</p>
          <strong>{statsLoading ? '—' : (stats?.draftPages ?? '—')}</strong>
        </article>
        <article className="dashboard-stat-card">
          <p>Active Users</p>
          <strong>{statsLoading ? '—' : (stats?.totalUsers ?? '—')}</strong>
        </article>
        <article className="dashboard-stat-card">
          <p>Media Assets</p>
          <strong>{statsLoading ? '—' : (stats?.totalAssets ?? '—')}</strong>
        </article>
      </section>

      {statsError && <p className="admin-editor-error" style={{ marginTop: '12px' }}>{statsError}</p>}

      <div className="dashboard-bottom-note">
        <Layers size={16} />
        <span>Data refreshes every 5 minutes</span>
      </div>
    </div>
  );
};
