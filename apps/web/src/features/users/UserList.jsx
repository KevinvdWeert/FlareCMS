import React, { useEffect, useState } from 'react';
import { fetchUsers } from '../../lib/firestore';
import { callSetUserRole } from '../../lib/functions';
import { useAuth } from '../auth/useAuth';

const formatRelativeTime = (dateVal) => {
  if (!dateVal) return '—';
  let date;
  if (dateVal?.seconds) {
    date = new Date(dateVal.seconds * 1000);
  } else if (dateVal?._seconds) {
    date = new Date(dateVal._seconds * 1000);
  } else {
    date = new Date(dateVal);
  }
  if (isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Active now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} day${diffD !== 1 ? 's' : ''} ago`;
  const diffMo = Math.floor(diffD / 30);
  return `${diffMo} month${diffMo !== 1 ? 's' : ''} ago`;
};

export const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const { user: currentUser } = useAuth();

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch users. Please refresh to retry.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (uid, newRole) => {
    if (!currentUser) return;
    setError('');
    try {
      setUpdatingUid(uid);
      await callSetUserRole(uid, newRole);
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u)));
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to update role. Make sure you are an admin.');
    } finally {
      setUpdatingUid('');
    }
  };

  const handleInviteUser = () => {
    setInviteMessage('Invite User feature coming soon.');
    setTimeout(() => setInviteMessage(''), 4000);
  };

  // Derived stats
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const editorCount = users.filter((u) => u.role === 'editor').length;
  const writerCount = users.filter((u) => u.role === 'writer' || u.role === 'user').length;
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  // Filtered list
  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.fullName || u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-section editorial-user-list">
      {/* Masthead */}
      <section className="editorial-masthead">
        <div>
          <span className="editorial-kicker">System Integrity</span>
          <h1>User <span>Ecosystem.</span></h1>
          <p>A curated overview of your editorial staff and system contributors. Manage hierarchies with surgical precision.</p>
        </div>
        <div className="editorial-masthead-card">
          <span className="material-symbols-outlined" style={{ fontSize: '28px', opacity: 0.15, position: 'absolute', right: '-4px', bottom: '-4px' }}>verified_user</span>
          <strong>{users.length}</strong>
          <span>Active contributors</span>
        </div>
      </section>

      {/* Stats Bento Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span className="material-symbols-outlined admin-stat-icon">shield_person</span>
          <p className="admin-stat-label">Admins</p>
          <strong className="admin-stat-value">{loading ? '—' : adminCount}</strong>
        </div>
        <div className="admin-stat-card">
          <span className="material-symbols-outlined admin-stat-icon">history_edu</span>
          <p className="admin-stat-label">Editors</p>
          <strong className="admin-stat-value">{loading ? '—' : editorCount}</strong>
        </div>
        <div className="admin-stat-card">
          <span className="material-symbols-outlined admin-stat-icon">ink_pen</span>
          <p className="admin-stat-label">Writers</p>
          <strong className="admin-stat-value">{loading ? '—' : writerCount}</strong>
        </div>
        <div className="admin-stat-card">
          <span className="material-symbols-outlined admin-stat-icon">group_add</span>
          <p className="admin-stat-label">Pending</p>
          <strong className="admin-stat-value">{loading ? '—' : pendingCount}</strong>
        </div>
      </div>

      {/* Search & Action Bar */}
      <div className="admin-user-list-header">
        <div className="admin-search-wrapper">
          <span className="material-symbols-outlined admin-search-icon">search</span>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search accounts, roles or permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-user-list-actions">
          <button type="button" className="admin-invite-btn" onClick={handleInviteUser}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
            Invite User
          </button>
        </div>
      </div>

      {inviteMessage && <div className="admin-editor-success" style={{ marginBottom: '12px' }}>{inviteMessage}</div>}
      {error && <div className="admin-editor-error">{error}</div>}

      {loading ? (
        <p className="admin-muted-text">Loading users...</p>
      ) : (
        <div className="admin-surface">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Identity</th>
                <th>Authority Role</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-muted-text" style={{ padding: '20px' }}>
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-identity-cell">
                        <div className="admin-identity-avatar">{(u.fullName || u.displayName || u.email || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="admin-identity-name">{u.fullName || u.displayName || 'No Name'}</p>
                          <p className="admin-identity-email">{u.email || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${u.role === 'admin' ? 'admin' : (u.role === 'editor' ? 'editor' : 'user')}`}>
                        {u.role || 'user'}
                      </span>
                      {u.id === currentUser.uid && <span className="admin-inline-note">(You)</span>}
                    </td>
                    <td>
                      <span className="admin-last-active">{formatRelativeTime(u.lastLoginAt || u.createdAt)}</span>
                    </td>
                    <td>
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={updatingUid === u.id || u.id === currentUser.uid}
                        title="Change role"
                        className="admin-select"
                      >
                        <option value="user">User</option>
                        <option value="writer">Writer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {updatingUid === u.id && <span className="admin-inline-note">Saving...</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
