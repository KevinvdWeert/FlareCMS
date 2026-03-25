import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupFirebase } from '../../lib/auth';
import { validateEmail, validatePassword } from '../../lib/validation';

export const Signup = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters and include an uppercase letter, a number, and a special character.');
      return;
    }

    setSubmitting(true);
    try {
      await signupFirebase(email, password, displayName);
      navigate('/admin/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>Create account</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required style={{ padding: '8px' }} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={{ padding: '8px' }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={{ padding: '8px' }} />
        <button type="submit" disabled={submitting} style={{ padding: '10px', cursor: 'pointer', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px' }}>
          {submitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: '12px', color: '#64748b' }}>
        Already have an account? <Link to="/admin/login">Log in</Link>
      </p>
    </div>
  );
};
