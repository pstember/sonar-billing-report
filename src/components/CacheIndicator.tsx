/**
 * Cache Status Indicator
 * Shows online/offline status and cache information
 */

import { useState, useEffect } from 'react';
import { getCacheSize, clearExpiredCache } from '../services/db';

export default function CacheIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cache size
    void getCacheSize().then(setCacheSize);

    // Clean expired cache on mount
    void clearExpiredCache();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-700 dark:text-slate-200">
        {isOnline ? 'Online' : 'Offline'}
      </span>
      {cacheSize > 0 && (
        <span className="text-gray-600 dark:text-slate-300">• {cacheSize} cached items</span>
      )}
    </div>
  );
}
