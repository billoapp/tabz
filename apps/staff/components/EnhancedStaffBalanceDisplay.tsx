/**
 * Enhanced Staff Balance Display Component
 * 
 * Integrates with the new balance update system to provide real-time balance updates,
 * animations, and auto-close detection for the staff interface.
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
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

export interface EnhancedStaffBalanceDisplayProps {
  tabId: string;
  barId?: string;
  className?: string;
  onAutoClose?: (tabId: string, finalBalance: number) => void;
  onBalanceChange?: (newBalance: number, previousBalance: number) => void;
  showActions?: boolean;
  showTrend?: boolean;
  showPaymentHistory?: boolean;
  compact?: boolean;
  variant?: 'card' | 'inline' | 'summary';
}

/**
 * Enhanced Staff Balance Display Component
 * 
 * Provides real-time balance updates with staff-specific features
 */
export const EnhancedStaffBalanceDisplay: React.FC<EnhancedStaffBalanceDisplayProps> = ({
  tabId,
  barId,
  className = '',
  onAutoClose,
  onBalanceChange,
  showActions = true,
  showTrend = false,
  showPaymentHistory = false,
  compact = false,
  variant = 'card'
}) => {
  // Initialize services with service role key for staff
  const [balanceUpdateService] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    
    return new BalanceUpdateService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseServiceRoleKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // Use anon key for client
      enableRealTimeNotifications: true,
      enableAuditLogging: true, // Enable audit logging for staff
      paymentNotificationService: new PaymentNotificationService({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceRoleKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
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

  // Payment history state
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load payment history for staff view
  useEffect(() => {
    if (!showPaymentHistory || !tabId) return;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('tab_payments')
          .select(`
            id,
            amount,
            method,
            status,
            reference,
            metadata,
            created_at,
            updated_at
          `)
          .eq('tab_id', tabId)
          .order('created_at', { ascending: false })
          .limit(10);

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
  }, [tabId, showPaymentHistory]);

  // Format currency consistently
  const formatCurrency = (amount: number): string => {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  };

  // Get balance trend indicator
  const getBalanceTrend = () => {
    if (!currentBalance || previousBalance === null) return null;
    
    const change = currentBalance.balance - previousBalance;
    if (Math.abs(change) < 1) return null; // No significant change
    
    return {
      change,
      direction: change > 0 ? 'up' : 'down',
      percentage: previousBalance > 0 ? Math.abs((change / previousBalance) * 100) : 0
    };
  };

  // Get staff action buttons
  const getStaffActions = () => {
    if (!showActions || !currentBalance) return null;

    const actions = [];

    // Refresh balance action
    actions.push(
      <button
        key="refresh"
        onClick={refreshBalance}
        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
        title="Refresh balance"
      >
        🔄 Refresh
      </button>
    );

    // Auto-close action (if applicable)
    if (currentBalance.status === 'overdue' && currentBalance.balance <= 0) {
      actions.push(
        <button
          key="auto-close"
          onClick={() => onAutoClose?.(tabId, currentBalance.balance)}
          className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded border border-green-200"
          title="Close tab automatically"
        >
          ✅ Auto-close
        </button>
      );
    }

    return actions;
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
          <AlertCircle size={16} />
          <div>
            <p className="font-medium text-sm">Balance Unavailable</p>
            <button 
              onClick={refreshBalance}
              className="text-xs underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const trend = getBalanceTrend();
  const staffActions = getStaffActions();

  // Render based on variant
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <div className={`
            w-3 h-3 rounded-full
            ${currentBalance.balance <= 0 ? 'bg-green-500' : ''}
            ${currentBalance.status === 'overdue' ? 'bg-red-500' : ''}
            ${currentBalance.balance > 0 && currentBalance.status !== 'overdue' ? 'bg-orange-500' : ''}
          `}></div>
          <span className="font-medium">{formattedBalance}</span>
        </div>
        
        {trend && showTrend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend.direction === 'down' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.direction === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            <span>{formatCurrency(Math.abs(trend.change))}</span>
          </div>
        )}
        
        {!isConnected && (
          <span className="text-xs text-gray-400" title="Offline">📶</span>
        )}
      </div>
    );
  }

  if (variant === 'summary') {
    return (
      <div className={`bg-white border rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Tab Balance</h3>
          <div className="flex items-center gap-2">
            {staffActions}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-2xl font-bold">{formattedBalance}</div>
            <div className={`text-sm ${
              currentBalance.balance <= 0 ? 'text-green-600' : 
              currentBalance.status === 'overdue' ? 'text-red-600' : 'text-orange-600'
            }`}>
              {statusIndicator.message}
            </div>
          </div>
          
          {trend && showTrend && (
            <div className={`text-right ${
              trend.direction === 'down' ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className="flex items-center gap-1">
                {trend.direction === 'down' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                <span className="font-medium">{formatCurrency(Math.abs(trend.change))}</span>
              </div>
              <div className="text-xs opacity-75">
                {trend.percentage.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
        
        {autoCloseDetected && (
          <div className="mt-3 bg-green-100 border border-green-200 rounded-lg p-2">
            <div className="flex items-center gap-2 text-green-800 text-sm">
              <CheckCircle size={14} />
              <span>Auto-closing tab...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default card variant
  return (
    <div className={className}>
      {/* Auto-close notification */}
      {autoCloseDetected && (
        <div className="mb-4 bg-green-100 border border-green-300 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle size={16} />
            <div>
              <p className="font-medium text-sm">Tab Auto-closing</p>
              <p className="text-xs">Balance paid in full - tab will close automatically</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection status */}
      {!isConnected && (
        <div className="mb-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <Clock size={14} />
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

      {/* Main balance card */}
      <BalanceCard
        tabId={tabId}
        barId={barId}
        balanceUpdateService={balanceUpdateService}
        title="Current Balance"
        subtitle={
          currentBalance.status === 'overdue' ? 'Overdue payment' :
          currentBalance.balance <= 0 ? 'Fully paid' : 'Outstanding balance'
        }
        actions={<div className="flex gap-1">{staffActions}</div>}
        className="mb-4"
      />

      {/* Balance trend */}
      {trend && showTrend && (
        <div className="mb-4 bg-gray-50 border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Balance Change</span>
            <div className={`flex items-center gap-2 ${
              trend.direction === 'down' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.direction === 'down' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
              <span className="font-medium">{formatCurrency(Math.abs(trend.change))}</span>
              <span className="text-xs">({trend.percentage.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment history */}
      {showPaymentHistory && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Payment History</h3>
          
          {loadingHistory ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : paymentHistory.length > 0 ? (
            <div className="space-y-3">
              {paymentHistory.map((payment, index) => (
                <div key={payment.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-2 h-2 rounded-full
                      ${payment.method === 'mpesa' ? 'bg-green-500' : ''}
                      ${payment.method === 'cash' ? 'bg-blue-500' : ''}
                      ${payment.method === 'card' ? 'bg-purple-500' : ''}
                    `}></div>
                    <div>
                      <div className="font-medium capitalize">{payment.method}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className={`text-xs ${
                      payment.status === 'success' ? 'text-green-600' :
                      payment.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {payment.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No payments recorded</p>
          )}
        </div>
      )}

      {/* Animation overlay */}
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
                <DollarSign size={16} />
                <span className="font-medium">Payment: -{formatCurrency(animation.amount)}</span>
              </div>
            )}
            {animation.type === 'increase' && (
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                <span className="font-medium">Increase: +{formatCurrency(animation.amount)}</span>
              </div>
            )}
            {animation.type === 'zero' && (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} />
                <span className="font-medium">Fully Paid!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Staff Balance Display for lists and tables
 */
export const CompactStaffBalanceDisplay: React.FC<Omit<EnhancedStaffBalanceDisplayProps, 'compact' | 'variant'>> = (props) => {
  return (
    <EnhancedStaffBalanceDisplay
      {...props}
      compact={true}
      variant="inline"
      showActions={false}
      showTrend={false}
      showPaymentHistory={false}
    />
  );
};

/**
 * Staff Balance Summary for dashboard views
 */
export const StaffBalanceSummary: React.FC<EnhancedStaffBalanceDisplayProps> = (props) => {
  return (
    <EnhancedStaffBalanceDisplay
      {...props}
      variant="summary"
      showTrend={true}
      showActions={true}
    />
  );