import React from 'react';
import { CloudUpload, Filter, Grid3X3, List, Tag } from 'lucide-react';

const demoAssets = [
  { id: 1, name: 'MARBLE_TEXTURE_01.JPG', meta: '4.2 MB • 4000x6000' },
  { id: 2, name: 'BOUTIQUE_HERO_V2.PNG', meta: 'Active in 4 Campaigns', active: true },
  { id: 3, name: 'PRODUCT_STUDIO_04.JPG', meta: '1.8 MB • 3000x3000' },
  { id: 4, name: 'ARCH_EXTERIOR_MAIN.JPG', meta: '8.5 MB • 8000x4000' },
  { id: 5, name: 'WATCH_SERIES_B.PNG', meta: '2.1 MB • 2000x2000' }
];

export const MediaManager = () => {
  return (
    <div className="admin-section media-screen">
      <section className="editorial-masthead">
        <div>
          <span className="editorial-kicker">Archive 2024</span>
          <h1>
            Media <span>Repository</span>
          </h1>
          <p>Browse, organize, and reuse your visual assets across editorial campaigns.</p>
        </div>
        <div className="editorial-masthead-card">
          <CloudUpload size={28} />
          <strong>128</strong>
          <span>Total assets</span>
        </div>
      </section>

      <section className="media-toolbar admin-surface">
        <div className="media-toolbar-left">
          <span className="media-select-all">Select All</span>
          <small>128 Items Total</small>
        </div>
        <div className="media-toolbar-right">
          <button type="button" className="admin-button-secondary">
            <Filter size={15} />
            <span>Sort</span>
          </button>
          <button type="button" className="admin-button-secondary">
            <CloudUpload size={15} />
            <span>Batch Export</span>
          </button>
          <div className="media-view-toggle">
            <button type="button" className="is-active" aria-label="Grid view">
              <Grid3X3 size={15} />
            </button>
            <button type="button" aria-label="List view">
              <List size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="media-layout">
        <div className="media-grid">
          {demoAssets.map((asset) => (
            <article key={asset.id} className={`admin-surface media-card ${asset.active ? 'is-active' : ''}`}>
              <div className="media-card-art">
                <span>{asset.name.charAt(0)}</span>
              </div>
              <div className="media-card-meta">
                <p>{asset.name}</p>
                <small>{asset.meta}</small>
              </div>
            </article>
          ))}

          <article className="admin-surface media-card media-card-add">
            <div className="media-card-art">
              <CloudUpload size={20} />
            </div>
            <div className="media-card-meta">
              <p>Add Asset</p>
              <small>Upload from desktop</small>
            </div>
          </article>
        </div>

        <aside className="admin-surface media-side-panel">
          <h3>Asset Details</h3>
          <div className="media-side-preview">
            <span>B</span>
          </div>
          <h4>BOUTIQUE_HERO_V2.PNG</h4>
          <p className="media-side-meta">Modified 2 hours ago by Sarah K.</p>

          <div className="media-side-specs">
            <div>
              <span>Dimensions</span>
              <b>5200 x 3400 px</b>
            </div>
            <div>
              <span>File Type</span>
              <b>PNG (Alpha)</b>
            </div>
            <div>
              <span>Usage</span>
              <b>Global Homepage</b>
            </div>
          </div>

          <div className="media-side-tags">
            <p>
              <Tag size={13} />
              <span>Tags</span>
            </p>
            <div>
              <span>Editorial</span>
              <span>Luxury</span>
              <span>Interiors</span>
            </div>
          </div>

          <div className="media-side-actions">
            <button type="button" className="admin-button-secondary">Open Editor</button>
            <button type="button" className="admin-button-primary">Replace File</button>
          </div>
        </aside>
      </section>
    </div>
  );
};
