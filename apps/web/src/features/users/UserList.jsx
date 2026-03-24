import React, { useEffect, useState } from 'react';
import { fetchUsers, updateUserRole } from '../../lib/firestore';
import { useAuth } from '../auth/useAuth';
import { ShieldCheck } from 'lucide-react';

export const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState('');
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth(); // Logged in user

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
    if (!currentUser) {
      return;
    }
    setError('');
    try {
      setUpdatingUid(uid);
      await updateUserRole(uid, newRole);
      // Update local state
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u)));
    } catch (err) {
      console.error(err);
      setError('Failed to update role. Make sure you are an admin.');
    } finally {
      setUpdatingUid('');
    }
  };

  return (
    <div className="admin-section editorial-user-list">
      <div className="editorial-masthead">
        <div>
          <span className="editorial-kicker">System Integrity</span>
          <h1>User <span>Ecosystem</span></h1>
          <p>Manage editorial roles, protect publishing authority, and keep contributor access aligned.</p>
        </div>
        <div className="editorial-masthead-card">
          <ShieldCheck size={28} />
          <strong>{users.length}</strong>
          <span>Active contributors</span>
        </div>
      </div>

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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="admin-identity-cell">
                      <div className="admin-identity-avatar">{(u.displayName || u.email || 'U').charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="admin-identity-name">{u.displayName || 'No Name'}</p>
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
                    <select
                      value={u.role || 'user'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={updatingUid === u.id}
                      title="Change role"
                      className="admin-select"
                    >
                      <option value="user">User</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {updatingUid === u.id && <span className="admin-inline-note">Saving...</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
