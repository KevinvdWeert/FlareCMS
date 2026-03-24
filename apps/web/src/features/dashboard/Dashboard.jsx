import React, { useEffect, useState } from 'react';
import { Activity, Globe, Layers, Sparkles } from 'lucide-react';
import { callGetDashboardStats, callGetRecentActivity } from '../../lib/functions';

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

const formatActivityTime = (createdAt) => {
  if (!createdAt) return '';
  const date = createdAt?.toDate?.() || new Date(createdAt);
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
        <div>
          <span className="editorial-kicker">System Overview</span>
          <h1>
            FlareCMS <span>Dashboard</span>
          </h1>
          <p>
            Welcome back. Your curated workspace is synchronized and ready for the next edition.
          </p>
        </div>
        <div className="editorial-masthead-card">
          <Globe size={28} />
          <strong>{statsLoading ? '—' : (stats?.totalUsers ?? '—')}</strong>
          <span>Total users</span>
        </div>
      </section>

      <section className="dashboard-activity admin-surface">
        <div className="dashboard-activity-head">
          <div>
            <h3>Recent Activity</h3>
            <p>Monitoring global contributions and editorial changes across the platform.</p>
          </div>
          <Activity size={20} />
        </div>

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
      </section>

      <section className="dashboard-stats-row">
        <article className="admin-surface dashboard-stat-card">
          <p>Published Pages</p>
          <strong>{statsLoading ? '—' : (stats?.publishedPages ?? '—')}</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>Draft Pages</p>
          <strong>{statsLoading ? '—' : (stats?.draftPages ?? '—')}</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>Active Users</p>
          <strong>{statsLoading ? '—' : (stats?.totalUsers ?? '—')}</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>Media Assets</p>
          <strong>{statsLoading ? '—' : (stats?.totalAssets ?? '—')}</strong>
        </article>
      </section>

      {statsError && <p className="admin-editor-error">{statsError}</p>}

      <section className="dashboard-bottom-note">
        <Layers size={16} />
        <span>Data refreshes every 5 minutes</span>
      </section>
    </div>
  );
};
