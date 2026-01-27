/**
 * Enhanced Balance Display for Customer Interface
 * 
 * Integrates with the new balance update system to provide real-time balance updates,
 * animations, and auto-close detection for the customer menu page.
 * 
 * Requirements: 4.1, 4.3, 4.5, 4.2
 */

'use client';

import React, { useEffect, useState } from 'react';
import { BalanceDisplay, BalanceCard } from '@tabeza/shared/lib/components/BalanceDisplay';
import { useBalanceUpdates } from '@tabeza/shared/hooks/useBalanceUpdates';
import { BalanceUpdateService } from '@tabeza/shared/lib/services/balance-update-service';
import { PaymentNotificationService } from '@tabeza/shared/lib/services/payment-notification-service';
import { supabase } from '@/lib/supabase';

export interface EnhancedBalanceDisplayProps {
  tabId: string;
  barId?: string;
  className?: string;
  onAutoClose?: (tabId: string, finalBalance: number) => void;
  onBalanceChange?: (newBalance: number, previousBalance: number) => void;
  showPaymentSection?: boolean;
  compact?: boolean;
}

/**
 * Enhanced Balance Display Component for Customer Interface
 * 
 * Provides real-time balance updates with animations and auto-close detection
 */
export const EnhancedBalanceDisplay: React.FC<EnhancedBalanceDisplayProps> = ({
  tabId,
  barId,
  className = '',
  onAutoClose,
  onBalanceChange,
  showPaymentSection = true,
  compact = false
}) => {
  // Initialize services
  const [balanceUpdateService] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    
    return new BalanceUpdateService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseServiceRoleKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // Use anon key for client
      enableRealTimeNotifications: true,
      enableAuditLogging: false, // Disable audit logging on client side
      paymentNotificationService: new PaymentNotificationService({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceRoleKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // Use anon key for client
      })
    });
  });

  // Use balance updates hook
  const {
    currentBalance,
    previousBalance,
    isLoading,
    animation,
    statusIndicator,
    formattedBalance,
    autoCloseDetected,
    connectionStatus,
    isConnected,
    refreshBalance
  } = useBalanceUpdates({
    tabId,
    barId,
    enableAnimations: true,
    enableAutoClose: true,
    balanceUpdateService,
    onBalanceChange: (balance, prevBalance) => {
      if (onBalanceChange) {
        onBalanceChange(balance.balance, prevBalance);
      }
    },
    onAutoClose: (tabId, finalBalance) => {
      if (onAutoClose) {
        onAutoClose(tabId, finalBalance);
      }
    }
  });

  // Auto-close notification state
  const [showAutoCloseNotification, setShowAutoCloseNotification] = useState(false);

  // Handle auto-close detection
  useEffect(() => {
    if (autoCloseDetected) {
      setShowAutoCloseNotification(true);
      
      // Auto-hide notification after 5 seconds
      const timeout = setTimeout(() => {
        setShowAutoCloseNotification(false);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [autoCloseDetected]);

  // Format currency consistently
  const formatCurrency = (amount: number): string => {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  };

  // Get payment urgency message
  const getPaymentUrgencyMessage = () => {
    if (!currentBalance) return null;
    
    if (currentBalance.status === 'overdue') {
      return {
        type: 'error' as const,
        message: '⚠️ Tab is overdue - payment required immediately'
      };
    } else if (currentBalance.balance > 1000) {
      return {
        type: 'warning' as const,
        message: '💰 Large outstanding balance - consider making a payment'
      };
    }
    
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg p-4">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (!currentBalance) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <span>❌</span>
          <div>
            <p className="font-medium">Balance Unavailable</p>
            <p className="text-sm">Unable to load current balance</p>
            <button 
              onClick={refreshBalance}
              className="text-xs underline hover:no-underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't show if balance is zero or negative (tab is paid)
  if (currentBalance.balance <= 0 && !autoCloseDetected) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-green-600">
          <span>✅</span>
          <div>
            <p className="font-medium">Tab Fully Paid!</p>
            <p className="text-sm">No outstanding balance</p>
          </div>
        </div>
      </div>
    );
  }

  const urgencyMessage = getPaymentUrgencyMessage();

  return (
    <div className={className}>
      {/* Auto-close notification */}
      {showAutoCloseNotification && (
        <div className="mb-4 bg-green-100 border border-green-300 rounded-lg p-3 animate-pulse">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-lg">🎉</span>
            <div>
              <p className="font-medium">Tab Closing Automatically!</p>
              <p className="text-sm">Your payment has been processed and the tab will close shortly.</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      {!isConnected && (
        <div className="mb-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <span>📶</span>
            <span>Offline - balance may not be current</span>
            <button 
              onClick={refreshBalance}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Main balance display */}
      {compact ? (
        <BalanceDisplay
          tabId={tabId}
          barId={barId}
          balanceUpdateService={balanceUpdateService}
          size="medium"
          showStatus={true}
          showAnimation={true}
          showAutoCloseIndicator={true}
          className="justify-center"
        />
      ) : (
        <BalanceCard
          tabId={tabId}
          barId={barId}
          balanceUpdateService={balanceUpdateService}
          title="Outstanding Balance"
          subtitle={currentBalance.status === 'overdue' ? 'Payment overdue' : 'Current balance'}
          className="mb-4"
          actions={
            <button 
              onClick={refreshBalance}
              className="text-xs text-gray-500 hover:text-gray-700"
              title="Refresh balance"
            >
              🔄
            </button>
          }
        />
      )}

      {/* Urgency message */}
      {urgencyMessage && (
        <div className={`
          mt-3 p-3 rounded-lg text-sm
          ${urgencyMessage.type === 'error' 
            ? 'bg-red-50 border border-red-200 text-red-800' 
            : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
          }
        `}>
          {urgencyMessage.message}
        </div>
      )}

      {/* Payment section hint */}
      {showPaymentSection && currentBalance.balance > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            👇 Use the payment section below to pay your balance
          </p>
        </div>
      )}

      {/* Animation overlay for visual feedback */}
      {animation && (
        <div className="fixed top-4 right-4 z-50 pointer-events-none">
          <div className={`
            bg-white border rounded-lg shadow-lg p-3 animate-bounce
            ${animation.type === 'decrease' ? 'border-green-200 text-green-600' : ''}
            ${animation.type === 'increase' ? 'border-red-200 text-red-600' : ''}
            ${animation.type === 'zero' ? 'border-green-200 text-green-600' : ''}
          `}>
            {animation.type === 'decrease' && (
              <div className="flex items-center gap-2">
                <span>💳</span>
                <span className="font-medium">-{formatCurrency(animation.amount)}</span>
              </div>
            )}
            {animation.type === 'increase' && (
              <div className="flex items-center gap-2">
                <span>↗️</span>
                <span className="font-medium">+{formatCurrency(animation.amount)}</span>
              </div>
            )}
            {animation.type === 'zero' && (
              <div className="flex items-center gap-2">
                <span>✅</span>
                <span className="font-medium">Paid in full!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Balance Display for tight spaces
 */
export const CompactEnhancedBalanceDisplay: React.FC<Omit<EnhancedBalanceDisplayProps, 'compact' | 'showPaymentSection'>> = (props) => {
  return (
    <EnhancedBalanceDisplay
      {...props}
      compact={true}
      showPaymentSection={false}
    />
  );
};

/**
 * Balance Summary Component
 * 
 * Shows balance with payment history and trends
 */
export const BalanceSummary: React.FC<EnhancedBalanceDisplayProps & {
  showHistory?: boolean;
  showTrends?: boolean;
}> = ({
  showHistory = false,
  showTrends = false,
  ...props
}) => {
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load payment history
  useEffect(() => {
    if (!showHistory || !props.tabId) return;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('tab_payments')
          .select('amount, method, status, created_at, metadata')
          .eq('tab_id', props.tabId)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          setPaymentHistory(data);
        }
      } catch (error) {
        console.error('Error loading payment history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [props.tabId, showHistory]);

  return (
    <div className="space-y-4">
      <EnhancedBalanceDisplay {...props} />
      
      {/* Payment History */}
      {showHistory && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Payments</h3>
          
          {loadingHistory ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : paymentHistory.length > 0 ? (
            <div className="space-y-2">
              {paymentHistory.map((payment, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`
                      w-2 h-2 rounded-full
                      ${payment.method === 'mpesa' ? 'bg-green-500' : ''}
                      ${payment.method === 'cash' ? 'bg-blue-500' : ''}
                      ${payment.method === 'card' ? 'bg-purple-500' : ''}
                    `}></span>
                    <span className="capitalize">{payment.method}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {`KSh ${payment.amount.toLocaleString()}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No payments yet</p>
          )}
        </div>
      )}
    </div>
  );
};