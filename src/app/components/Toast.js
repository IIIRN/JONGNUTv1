"use client";

import { createContext, useContext, useState, useRef } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const toastIdRef = useRef(0);

  const showToast = (message, type = 'info') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    const toast = { id, message, type, read: false, timestamp: new Date() };
    
    setToasts(prev => {
      const newToasts = [...prev, toast];
      return newToasts;
    });

    setHasUnread(true);
  };

  const markAsRead = (id) => {
    setToasts(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, read: true } : t);
      const stillHasUnread = updated.some(t => !t.read);
      setHasUnread(stillHasUnread);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setToasts(prev => prev.map(t => ({ ...t, read: true })));
    setHasUnread(false);
  };

  const removeToast = (id) => {
    setToasts(prev => {
      const filtered = prev.filter(toast => toast.id !== id);
      const stillHasUnread = filtered.some(t => !t.read);
      setHasUnread(stillHasUnread);
      return filtered;
    });
  };

  const clearAllToasts = () => {
    setToasts([]);
    setHasUnread(false);
  };

  return (
    <ToastContext.Provider value={{ 
      showToast, 
      markAsRead, 
      markAllAsRead,
      removeToast, 
      clearAllToasts,
      toasts,
      hasUnread
    }}>
      {children}
    </ToastContext.Provider>
  );
}
