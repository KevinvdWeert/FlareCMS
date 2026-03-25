import React from 'react';
import '../animations.css';

export const LoadingSpinner = ({ label = 'Loading...' }) => {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '140px', fontFamily: 'sans-serif', color: '#475569' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          aria-hidden="true"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: '2px solid #cbd5e1',
            borderTopColor: '#0ea5e9',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
};
