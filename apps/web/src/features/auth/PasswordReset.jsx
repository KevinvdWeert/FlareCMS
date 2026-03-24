import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendResetPasswordEmail } from '../../lib/auth';
import { validateEmail } from '../../lib/validation';

export const PasswordReset = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSent(false);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await sendResetPasswordEmail(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>Reset password</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {sent && <p style={{ color: '#166534' }}>Reset email sent. Please check your inbox.</p>}
      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={{ padding: '8px' }} />
        <button type="submit" disabled={submitting} style={{ padding: '10px', cursor: 'pointer', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px' }}>
          {submitting ? 'Sending...' : 'Send reset email'}
        </button>
      </form>
      <p style={{ marginTop: '12px', color: '#64748b' }}>
        Back to <Link to="/admin/login">Login</Link>
      </p>
    </div>
  );
};
