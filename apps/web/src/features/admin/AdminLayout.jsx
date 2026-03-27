import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { logoutFirebase } from '../../lib/auth';
import { callGetRecentActivity } from '../../lib/functions';
import {
  LogOut,
  FileText,
  Users,
  ArrowLeft,
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  PenSquare,
  Images,
  Sliders,
} from 'lucide-react';

const ACTION_LABELS = {
  page_created: 'created page',
  page_updated: 'updated page',
  page_deleted: 'deleted page',
  page_published: 'published page',
  page_unpublished: 'unpublished page',
  role_change: 'changed role',
  user_profile: 'updated role profile',
  media_uploaded: 'uploaded media',
  media_deleted: 'deleted media',
  invite_created: 'invited user',
  invite_accepted: 'accepted invite',
};

const QUICK_ACTIONS = [
  { id: 'dashboard', label: 'Go to Dashboard', route: '/admin/dashboard', keywords: ['overview', 'home', 'stats'] },
  { id: 'pages', label: 'Open Content Library', route: '/admin/pages', keywords: ['pages', 'content', 'library'] },
  { id: 'new-page', label: 'Create New Page', route: '/admin/pages/new', keywords: ['new', 'create', 'editor'] },
  { id: 'media', label: 'Open Media Manager', route: '/admin/media', keywords: ['media', 'assets', 'images'] },
  { id: 'settings', label: 'Open Settings', route: '/admin/settings', keywords: ['settings', 'configure'] },
  { id: 'settings-footer', label: 'Edit Footer Settings', route: '/admin/settings/footer', keywords: ['footer'] },
  { id: 'settings-header', label: 'Edit Header Settings', route: '/admin/settings/header', keywords: ['header', 'navigation'] },
  { id: 'settings-homepage', label: 'Edit Homepage Settings', route: '/admin/settings/homepage', keywords: ['homepage', 'home', 'sections'] },
  { id: 'settings-identity', label: 'Edit Site Identity', route: '/admin/settings/identity', keywords: ['identity', 'branding', 'seo'] },
  { id: 'settings-contact', label: 'Edit Contact Settings', route: '/admin/settings/contact', keywords: ['contact', 'email', 'phone'] },
  { id: 'settings-seo', label: 'Edit SEO Settings', route: '/admin/settings/seo', keywords: ['seo', 'meta'] },
  { id: 'settings-media-credits', label: 'Edit Media Credits', route: '/admin/settings/media-credits', keywords: ['credits', 'media'] },
  { id: 'settings-link-checker', label: 'Run Link Checker', route: '/admin/settings/link-checker', keywords: ['links', 'checker'] },
  { id: 'users', label: 'Open User Management', route: '/admin/users', adminOnly: true, keywords: ['users', 'roles', 'permissions'] },
];

export const AdminLayout = () => {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef(null);
  const notificationsRef = useRef(null);

  const handleLogout = async () => {
    await logoutFirebase();
    navigate('/admin/login');
  };

  const filteredActions = useMemo(() => {
    const available = QUICK_ACTIONS.filter((action) => !(action.adminOnly && !isAdmin));
    const query = search.trim().toLowerCase();
    if (!query) {
      return available.slice(0, 8);
    }

    const matched = available.filter((action) => {
      return (
        action.label.toLowerCase().includes(query) ||
        action.route.toLowerCase().includes(query) ||
        action.keywords.some((keyword) => keyword.includes(query))
      );
    });

    if (matched.length > 0) {
      return matched;
    }

    return [
      {
        id: 'search-pages-fallback',
        label: `Search pages for "${search.trim()}"`,
        route: `/admin/pages?q=${encodeURIComponent(search.trim())}`,
      },
    ];
  }, [isAdmin, search]);

  useEffect(() => {
    let cancelled = false;
    setNotificationsLoading(true);
    setNotificationsError('');

    callGetRecentActivity({ limit: 8 })
      .then((result) => {
        if (cancelled) return;
        const entries = result?.data?.entries || [];
        setNotifications(entries);
        setUnreadCount(entries.length);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load topbar notifications:', err);
        setNotificationsError('Failed to load notifications.');
      })
      .finally(() => {
        if (!cancelled) {
          setNotificationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setShowSearchMenu(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const runQuickAction = (route) => {
    navigate(route);
    setSearch('');
    setShowSearchMenu(false);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter' && filteredActions.length > 0) {
      event.preventDefault();
      runQuickAction(filteredActions[0].route);
      return;
    }
    if (event.key === 'Escape') {
      setShowSearchMenu(false);
    }
  };

  const routeForActivity = (item) => {
    const resourceType = String(item?.resourceType || '').toLowerCase();
    const pageId = item?.resourceId || item?.meta?.pageId || item?.meta?.id;
    if (resourceType === 'page' && pageId) {
      return `/admin/pages/${pageId}`;
    }
    if (resourceType === 'page') {
      return '/admin/pages';
    }
    if (resourceType === 'media') {
      return '/admin/media';
    }
    if (resourceType === 'settings') {
      return '/admin/settings';
    }
    if (resourceType === 'user') {
      return isAdmin ? '/admin/users' : '/admin/dashboard';
    }
    return '/admin/dashboard';
  };

  const openNotifications = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
      }
      return next;
    });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand-wrap">
          <div className="admin-brand">FlareCMS</div>
          <p className="admin-brand-subtitle">Firebase CMS</p>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/admin/pages" end className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <FileText size={18} />
            <span>ContentLibrary</span>
          </NavLink>

          <NavLink to="/admin/pages/new" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <PenSquare size={18} />
            <span>ContentEditor</span>
          </NavLink>

          <NavLink to="/admin/media" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <Images size={18} />
            <span>MediaManager</span>
          </NavLink>

          <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <Sliders size={18} />
            <span>Settings</span>
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
              <Users size={18} />
              <span>UserManagement</span>
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <a href="/" target="_blank" rel="noopener noreferrer" className="admin-nav-link subtle">
            <ArrowLeft size={18} />
            <span>View Site</span>
          </a>

          <div className="admin-user-pill">
            <div className="admin-user-avatar">{(profile?.fullName || profile?.displayName || user?.email || 'A').charAt(0).toUpperCase()}</div>
            <div>
              <p className="admin-user-name">{profile?.fullName || profile?.displayName || user?.email || 'Administrator'}</p>
              <p className="admin-user-role">{profile?.role || 'user'}</p>
            </div>
          </div>

          <div className="admin-session">
            <button onClick={handleLogout} className="admin-logout-button" type="button">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-search-wrap" ref={searchRef}>
            <Search size={16} />
            <input
              id="admin-global-search"
              type="search"
              placeholder="Search pages, assets, metadata..."
              value={search}
              onFocus={() => setShowSearchMenu(true)}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSearchMenu(true);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {showSearchMenu && (
              <div className="admin-topbar-menu" role="listbox" aria-label="Quick actions">
                {filteredActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="admin-topbar-menu-item"
                    onClick={() => runQuickAction(action.route)}
                  >
                    <span>{action.label}</span>
                    <small>{action.route}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-topbar-popover" ref={notificationsRef}>
              <button
                type="button"
                className="admin-top-icon-btn"
                aria-label="Notifications"
                onClick={openNotifications}
                aria-expanded={notificationsOpen}
              >
                {unreadCount > 0 && <span className="admin-top-icon-dot" aria-hidden="true" />}
                <Bell size={17} />
              </button>
              {notificationsOpen && (
                <div className="admin-topbar-panel" role="dialog" aria-label="Recent activity">
                  <div className="admin-topbar-panel-head">
                    <strong>Recent activity</strong>
                    <button
                      type="button"
                      className="admin-topbar-link-btn"
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('/admin/dashboard');
                      }}
                    >
                      View all
                    </button>
                  </div>
                  {notificationsLoading ? (
                    <p className="admin-topbar-panel-empty">Loading...</p>
                  ) : notificationsError ? (
                    <p className="admin-topbar-panel-empty">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="admin-topbar-panel-empty">No activity yet.</p>
                  ) : (
                    <div className="admin-topbar-panel-list">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="admin-topbar-panel-item"
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate(routeForActivity(item));
                          }}
                        >
                          <p>
                            {item.actorName || item.actorEmail || item.actorId}{' '}
                            {ACTION_LABELS[item.action] || item.action}
                          </p>
                          <small>{(item.resourceType || '').toUpperCase() || 'ACTIVITY'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="admin-top-icon-btn"
              aria-label="Go to settings"
              onClick={() => navigate('/admin/settings')}
            >
              <Settings size={17} />
            </button>
            <div className="admin-topbar-divider" />
          </div>
        </header>

        <section className="admin-canvas">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
