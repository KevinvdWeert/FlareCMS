import React, { useEffect, useState } from 'react';

/**
 * Displays a dismissible banner when the browser goes offline.
 * Automatically hides when the connection is restored.
 */
export const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner">
      You are currently offline. Some features may be unavailable.
    </div>
  );
};
