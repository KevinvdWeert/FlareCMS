import React, { useState } from 'react';
import { loginFirebase } from '../../lib/auth';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { validateEmail } from '../../lib/validation';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();

  if (user && isStaff) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    try {
      await loginFirebase(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container" style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>Admin Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" 
          required 
          style={{ padding: '8px' }}
        />
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" 
          required 
          style={{ padding: '8px' }}
        />
        <button type="submit" style={{ padding: '10px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
          Login
        </button>
      </form>
      <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
        For security, login is temporarily locked after repeated failures.
      </p>
      <p style={{ marginTop: '12px', color: '#64748b' }}>
        <Link to="/password-reset">Forgot password?</Link> · <Link to="/signup">Create account</Link>
      </p>
    </div>
  );
};
