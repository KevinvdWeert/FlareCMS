import React, { useEffect, useState } from 'react';
import { fetchUsers, updateUserRole } from '../../lib/firestore';
import { useAuth } from '../auth/AuthContext';

export const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth(); // Logged in user

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch users");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (uid, newRole) => {
    if (uid === currentUser.uid) {
      alert("You cannot change your own role.");
      return;
    }
    try {
      await updateUserRole(uid, newRole);
      // Update local state
      setUsers(users.map(u => u.id === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
      alert("Failed to update role. Make sure you are an admin.");
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '30px', color: '#1e293b' }}>User Management</h1>
      
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '15px' }}>Email</th>
              <th style={{ padding: '15px' }}>Display Name</th>
              <th style={{ padding: '15px' }}>Role</th>
              <th style={{ padding: '15px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '15px' }}>{u.email || 'N/A'}</td>
                <td style={{ padding: '15px' }}>{u.displayName || 'No Name'}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    background: u.role === 'admin' ? '#fecaca' : (u.role === 'editor' ? '#bbf7d0' : '#e2e8f0'),
                    color: u.role === 'admin' ? '#991b1b' : (u.role === 'editor' ? '#166534' : '#475569')
                  }}>
                    {u.role || 'user'}
                  </span>
                  {u.id === currentUser.uid && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#94a3b8' }}>(You)</span>}
                </td>
                <td style={{ padding: '15px' }}>
                  <select 
                    value={u.role || 'user'} 
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === currentUser.uid}
                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="user">User</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
