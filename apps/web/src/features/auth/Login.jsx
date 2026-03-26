import React, { useState } from 'react';
import { loginFirebase } from '../../lib/auth';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
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
      if (err?.code === 'auth/invalid-credential') {
        setError('Invalid email/password for this Firebase project. If you expected demo users, run emulators + seed first.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
      <h2>FlareCMS Login</h2>
      <p className="auth-subtitle">Sign in to access the FlareCMS workspace.</p>
      {error && <p className="auth-error">{error}</p>}
      <form onSubmit={handleLogin} className="auth-form">
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" 
          required 
          className="auth-input"
        />
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" 
          required 
          className="auth-input"
        />
        <button type="submit" className="auth-submit">
          Enter Workspace
        </button>
      </form>
      <p className="auth-note">Your permissions are synced from Firebase role policy.</p>
      <p className="auth-links">
        <Link to="/password-reset">Forgot password?</Link>
      </p>
      </div>
    </div>
  );
};
