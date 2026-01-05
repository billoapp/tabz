'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TokenNotification {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'milestone';
  title: string;
  message: string;
  amount?: number;
  timestamp: string;
  autoHide?: number; // Auto-hide after this many milliseconds
}

interface TokenNotificationsProps {
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function TokenNotifications({ 
  maxVisible = 5, 
  position = 'top-right',
  className = '' 
}: TokenNotificationsProps) {
  const [notifications, setNotifications] = useState<TokenNotification[]>([]);

  // Auto-hide notifications after their duration
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => {
        const now = Date.now();
        return prev.filter(notification => {
          // Keep if no auto-hide or if not expired
          if (!notification.autoHide || (now - new Date(notification.timestamp).getTime() < (notification.autoHide * 1000))) {
            return notification;
          }
          return false; // Remove expired or auto-hidden notifications
        });
      });
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  const addNotification = (notification: Omit<TokenNotification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: TokenNotification = {
      id,
      ...notification,
      timestamp: new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, maxVisible));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'earned': return '🎉';
      case 'redeemed': return '🎟️';
      case 'bonus': return '🎁';
      case 'milestone': return '🏆';
      default: return '🪙';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'earned': return 'bg-green-50 border-green-200 text-green-800';
      case 'redeemed': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'bonus': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'milestone': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (notifications.length === 0) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed z-50 space-y-2 ${positionClasses[position]} ${className}`}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            relative p-4 rounded-lg shadow-lg border transition-all duration-300 transform
            ${getNotificationColor(notification.type)}
            ${notification.autoHide ? 'animate-pulse' : 'animate-slide-in'}
          `}
          style={{
            animation: notification.autoHide ? 'pulse 2s infinite' : 'slideIn 0.3s ease-out',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => removeNotification(notification.id)}
            className="absolute top-2 right-2 p-1 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
            title="Dismiss notification"
          >
            <X size={16} className="text-gray-600" />
          </button>

          {/* Icon */}
          <div className="flex items-start gap-3">
            <span className="text-2xl text-white">{getNotificationIcon(notification.type)}</span>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-white">{notification.title}</h4>
              <p className="text-sm opacity-90 text-white">{notification.message}</p>
              {notification.amount && (
                <p className="text-xs font-medium mt-1 text-white">
                  {notification.amount > 0 ? '+' : ''}{notification.amount} tokens
                </p>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-xs opacity-70 mt-2">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for easy usage throughout the app
export function useTokenNotifications() {
  const [notifications, setNotifications] = useState<TokenNotification[]>([]);

  const showNotification = (notification: Omit<TokenNotification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: TokenNotification = {
      id,
      ...notification,
      timestamp: new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    showNotification,
    clearNotifications,
  };
}
