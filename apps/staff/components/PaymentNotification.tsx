'use client';

import React from 'react';
import { X, CheckCircle, AlertCircle, Phone, Wallet, CreditCard, Clock } from 'lucide-react';

// Types for payment notifications
export interface PaymentNotificationData {
  id: string;
  tabId: string;
  tabNumber: number;
  amount: number;
  method: 'mpesa' | 'cash' | 'card';
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  mpesaReceiptNumber?: string;
  reference?: string;
  displayName?: string;
  tableNumber?: number;
}

export interface PaymentNotificationProps {
  payment: PaymentNotificationData;
  type: 'success' | 'failed' | 'processing';
  onDismiss?: () => void;
  onViewTab?: (tabId: string) => void;
  onRetry?: (paymentId: string) => void;
}

/**
 * PaymentNotification Component for Staff Interface
 * 
 * Displays payment notifications with consistent styling across all payment methods.
 * Matches existing order notification styling and includes payment-specific information.
 * 
 * Requirements: 1.2, 7.1, 7.2, 7.3, 7.4, 7.5
 */
export const PaymentNotification: React.FC<PaymentNotificationProps> = ({
  payment,
  type,
  onDismiss,
  onViewTab,
  onRetry
}) => {
  // Format currency consistently
  const formatCurrency = (amount: number): string => {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get payment method icon and styling
  const getPaymentMethodInfo = () => {
    switch (payment.method) {
      case 'mpesa':
        return {
          icon: <Phone className="w-5 h-5 text-green-600" />,
          label: 'M-Pesa',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700'
        };
      case 'cash':
        return {
          icon: <Wallet className="w-5 h-5 text-blue-600" />,
          label: 'Cash',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700'
        };
      case 'card':
        return {
          icon: <CreditCard className="w-5 h-5 text-purple-600" />,
          label: 'Card',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-700'
        };
      default:
        return {
          icon: <Wallet className="w-5 h-5 text-gray-600" />,
          label: 'Payment',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700'
        };
    }
  };

  // Get notification styling based on type
  const getNotificationStyles = () => {
    switch (type) {
      case 'success':
        return {
          containerClass: 'bg-green-50 border-green-200 text-green-800',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          title: 'Payment Received'
        };
      case 'failed':
        return {
          containerClass: 'bg-red-50 border-red-200 text-red-800',
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          title: 'Payment Failed'
        };
      case 'processing':
        return {
          containerClass: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: <Clock className="w-5 h-5 text-blue-500 animate-spin" />,
          title: 'Payment Processing'
        };
      default:
        return {
          containerClass: 'bg-gray-50 border-gray-200 text-gray-800',
          icon: <Clock className="w-5 h-5 text-gray-500" />,
          title: 'Payment Update'
        };
    }
  };

  const paymentMethodInfo = getPaymentMethodInfo();
  const notificationStyles = getNotificationStyles();

  // Get tab display name
  const getTabDisplayName = (): string => {
    if (payment.displayName) {
      return payment.displayName;
    }
    return `Tab ${payment.tabNumber}`;
  };

  return (
    <div
      className={`
        max-w-sm w-full rounded-lg border p-4 shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-2
        ${notificationStyles.containerClass}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {notificationStyles.icon}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold">{notificationStyles.title}</h4>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentMethodInfo.bgColor} ${paymentMethodInfo.textColor}`}>
              <div className="flex items-center gap-1">
                {paymentMethodInfo.icon}
                <span>{paymentMethodInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{getTabDisplayName()}</span>
              <span className="text-sm font-bold">{formatCurrency(payment.amount)}</span>
            </div>
            
            {payment.tableNumber && (
              <div className="text-xs opacity-75">
                Table {payment.tableNumber}
              </div>
            )}

            {/* Payment Reference */}
            {payment.mpesaReceiptNumber && (
              <div className="text-xs opacity-75">
                Receipt: {payment.mpesaReceiptNumber}
              </div>
            )}
            
            {payment.reference && !payment.mpesaReceiptNumber && (
              <div className="text-xs opacity-75">
                Ref: {payment.reference}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs opacity-75">
              {formatTimestamp(payment.timestamp)}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            {onViewTab && (
              <button
                onClick={() => onViewTab(payment.tabId)}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-white bg-opacity-50 hover:bg-opacity-75 rounded-md transition-colors"
              >
                View Tab
              </button>
            )}
            
            {type === 'failed' && onRetry && (
              <button
                onClick={() => onRetry(payment.id)}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-white bg-opacity-50 hover:bg-opacity-75 rounded-md transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * PaymentNotificationContainer Component
 * 
 * Container for displaying multiple payment notifications in a stack.
 * Positioned consistently with existing toast notifications.
 */
export interface PaymentNotificationContainerProps {
  notifications: Array<{
    id: string;
    payment: PaymentNotificationData;
    type: 'success' | 'failed' | 'processing';
  }>;
  onDismiss: (id: string) => void;
  onViewTab?: (tabId: string) => void;
  onRetry?: (paymentId: string) => void;
}

export const PaymentNotificationContainer: React.FC<PaymentNotificationContainerProps> = ({
  notifications,
  onDismiss,
  onViewTab,
  onRetry
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notification => (
        <PaymentNotification
          key={notification.id}
          payment={notification.payment}
          type={notification.type}
          onDismiss={() => onDismiss(notification.id)}
          onViewTab={onViewTab}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
};

/**
 * Hook for managing payment notifications
 * 
 * Provides state management and helper functions for payment notifications.
 * Integrates with existing toast system for consistent behavior.
 */
export const usePaymentNotifications = () => {
  const [notifications, setNotifications] = React.useState<Array<{
    id: string;
    payment: PaymentNotificationData;
    type: 'success' | 'failed' | 'processing';
    duration?: number;
  }>>([]);

  const showPaymentNotification = React.useCallback((
    payment: PaymentNotificationData,
    type: 'success' | 'failed' | 'processing',
    duration: number = 5000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notification = { id, payment, type, duration };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-dismiss after duration (except for failed payments)
    if (duration > 0 && type !== 'failed') {
      setTimeout(() => {
        removePaymentNotification(id);
      }, duration);
    }
  }, []);

  const removePaymentNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = React.useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    showPaymentNotification,
    removePaymentNotification,
    clearAllNotifications
  };
};