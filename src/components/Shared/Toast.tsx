/**
 * Toast notification component for celebration moments
 */

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  variant?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, variant = 'success', duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for slide-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variants = {
    success: 'bg-green-500 dark:bg-green-600',
    info: 'bg-blue-500 dark:bg-blue-600',
    warning: 'bg-amber-500 dark:bg-amber-600',
    error: 'bg-red-500 dark:bg-red-600',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${variants[variant]} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 min-w-[300px] max-w-md`}>
        <span className="text-lg">{variant === 'success' ? '🎉' : variant === 'info' ? 'ℹ️' : variant === 'warning' ? '⚠️' : '❌'}</span>
        <p className="font-body text-sm flex-1">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-white/80 hover:text-white"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
