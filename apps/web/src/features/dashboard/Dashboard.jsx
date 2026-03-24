import React from 'react';
import { Activity, Globe, Layers, Sparkles } from 'lucide-react';

export const Dashboard = () => {
  const activity = [
    {
      id: 1,
      title: 'Elena Vance published "The Silk Route"',
      meta: '2 MINUTES AGO • EDITORIAL'
    },
    {
      id: 2,
      title: 'New Asset Batch uploaded to MediaManager',
      meta: '1 HOUR AGO • SYSTEM'
    },
    {
      id: 3,
      title: 'Marcus Thorne updated User Permissions',
      meta: '4 HOURS AGO • SECURITY'
    }
  ];

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
          <strong>12.4k</strong>
          <span>Live visitors</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="admin-surface dashboard-card dashboard-card-large">
          <div className="dashboard-card-head">
            <div>
              <h3>Site Traffic Trends</h3>
              <p>Performance over the last 30 days</p>
            </div>
            <div className="dashboard-pills">
              <span>Daily</span>
              <span className="is-active">Weekly</span>
            </div>
          </div>

          <div className="dashboard-chart-bars" aria-hidden="true">
            <i style={{ height: '36%' }}></i>
            <i style={{ height: '58%' }}></i>
            <i style={{ height: '52%' }}></i>
            <i style={{ height: '78%' }}></i>
            <i style={{ height: '62%' }}></i>
            <i className="is-highlight" style={{ height: '92%' }}></i>
            <i style={{ height: '67%' }}></i>
            <i style={{ height: '44%' }}></i>
          </div>
        </article>

        <article className="admin-surface dashboard-card dashboard-card-side">
          <h3>Live Preview Hub</h3>
          <div className="dashboard-preview-frame">
            <span>Campaign preview area</span>
          </div>
          <p className="dashboard-side-copy">Current Active Campaign: Autumn Whispers</p>
          <button type="button" className="admin-button-primary dashboard-side-cta">
            <Sparkles size={16} />
            <span>Launch Designer Mode</span>
          </button>
        </article>
      </section>

      <section className="dashboard-activity admin-surface">
        <div className="dashboard-activity-head">
          <div>
            <h3>Recent Activity</h3>
            <p>Monitoring global contributions and editorial changes across the platform.</p>
          </div>
          <Activity size={20} />
        </div>

        <div className="dashboard-activity-list">
          {activity.map((item) => (
            <div key={item.id} className="dashboard-activity-row">
              <div>
                <p>{item.title}</p>
                <small>{item.meta}</small>
              </div>
              <span aria-hidden="true">›</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-stats-row">
        <article className="admin-surface dashboard-stat-card">
          <p>Server Status</p>
          <strong>Optimized</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>Active Users</p>
          <strong>1,204</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>Content Score</p>
          <strong>98/100</strong>
        </article>
        <article className="admin-surface dashboard-stat-card">
          <p>System Version</p>
          <strong>v4.8.2</strong>
        </article>
      </section>

      <section className="dashboard-bottom-note">
        <Layers size={16} />
        <span>Tonal layering mode active</span>
      </section>
    </div>
  );
};
