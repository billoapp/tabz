/**
 * Balance Updates Hook
 * 
 * Provides real-time balance updates with animations and visual feedback.
 * Integrates with payment notifications and auto-close detection.
 * 
 * Requirements: 4.1, 4.3, 4.5, 4.2
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { BalanceUpdateService, TabBalance, BalanceChangeAnimation } from '../lib/services/balance-update-service';

export interface BalanceUpdateState {
  currentBalance: TabBalance | null;
  previousBalance: number | null;
  isLoading: boolean;
  animation: BalanceChangeAnimation | null;
  statusIndicator: {
    color: string;
    icon: string;
    message: string;
    urgency: 'low' | 'medium' | 'high';
  };
  formattedBalance: string;
  autoCloseDetected: boolean;
  lastUpdated: string | null;
}

export interface UseBalanceUpdatesOptions {
  tabId: string;
  barId?: string;
  enableAnimations?: boolean;
  enableAutoClose?: boolean;
  onBalanceChange?: (balance: TabBalance, previousBalance: number) => void;
  onAutoClose?: (tabId: string, finalBalance: number) => void;
  balanceUpdateService?: BalanceUpdateService;
}

/**
 * Hook for managing real-time balance updates
 * 
 * Provides balance state, animations, and auto-close detection
 * Integrates with existing real-time subscription system
 */
export const useBalanceUpdates = (options: UseBalanceUpdatesOptions) => {
  const {
    tabId,
    barId,
    enableAnimations = true,
    enableAutoClose = true,
    onBalanceChange,
    onAutoClose,
    balanceUpdateService
  } = options;

  // Balance state
  const [balanceState, setBalanceState] = useState<BalanceUpdateState>({
    currentBalance: null,
    previousBalance: null,
    isLoading: true,
    animation: null,
    statusIndicator: {
      color: 'gray',
      icon: 'ℹ️',
      message: 'Loading balance...',
      urgency: 'low'
    },
    formattedBalance: 'KSh 0',
    autoCloseDetected: false,
    lastUpdated: null
  });

  // Animation timeout ref
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format currency consistently
  const formatBalance = useCallback((amount: number): string => {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  }, []);

  // Get status indicator based on balance and tab status
  const getStatusIndicator = useCallback((balance: number, tabStatus: string) => {
    if (balance <= 0) {
      return {
        color: 'green',
        icon: '✅',
        message: 'Tab fully paid',
        urgency: 'low' as const
      };
    } else if (tabStatus === 'overdue') {
      return {
        color: 'red',
        icon: '⚠️',
        message: 'Overdue - payment required',
        urgency: 'high' as const
      };
    } else if (balance > 0) {
      return {
        color: 'orange',
        icon: '💰',
        message: 'Outstanding balance',
        urgency: 'medium' as const
      };
    } else {
      return {
        color: 'gray',
        icon: 'ℹ️',
        message: 'Balance unknown',
        urgency: 'low' as const
      };
    }
  }, []);

  // Get balance change animation
  const getBalanceChangeAnimation = useCallback((
    previousBalance: number,
    newBalance: number
  ): BalanceChangeAnimation => {
    const difference = previousBalance - newBalance;
    
    if (difference > 0) {
      // Balance decreased (payment made)
      return {
        type: 'decrease',
        amount: difference,
        duration: 800,
        easing: 'ease-out'
      };
    } else if (difference < 0) {
      // Balance increased (rare case, maybe refund)
      return {
        type: 'increase',
        amount: Math.abs(difference),
        duration: 800,
        easing: 'ease-in-out'
      };
    } else {
      // Balance reached zero
      return {
        type: 'zero',
        amount: 0,
        duration: 1200, // Longer animation for zero balance
        easing: 'ease-in-out'
      };
    }
  }, []);

  // Load initial balance
  const loadBalance = useCallback(async () => {
    if (!balanceUpdateService) {
      console.warn('Balance update service not available');
      return;
    }

    try {
      setBalanceState(prev => ({ ...prev, isLoading: true }));

      const balance = await balanceUpdateService.calculateTabBalance(tabId);
      if (balance) {
        const statusIndicator = getStatusIndicator(balance.balance, balance.status);
        const formattedBalance = formatBalance(balance.balance);

        setBalanceState(prev => ({
          ...prev,
          currentBalance: balance,
          statusIndicator,
          formattedBalance,
          isLoading: false,
          lastUpdated: new Date().toISOString()
        }));
      } else {
        setBalanceState(prev => ({
          ...prev,
          isLoading: false,
          statusIndicator: {
            color: 'red',
            icon: '❌',
            message: 'Failed to load balance',
            urgency: 'high'
          }
        }));
      }
    } catch (error) {
      console.error('Error loading balance:', error);
      setBalanceState(prev => ({
        ...prev,
        isLoading: false,
        statusIndicator: {
          color: 'red',
          icon: '❌',
          message: 'Error loading balance',
          urgency: 'high'
        }
      }));
    }
  }, [tabId, balanceUpdateService, getStatusIndicator, formatBalance]);

  // Handle payment updates from real-time subscriptions
  const handlePaymentUpdate = useCallback(async (payload: any) => {
    console.log('Balance update - payment subscription update:', payload);

    // Only process successful payments
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const payment = payload.new;
      
      if (payment?.status === 'success' && payment?.tab_id === tabId) {
        console.log('Processing balance update for successful payment:', payment);

        try {
          // Get updated balance using service if available
          if (balanceUpdateService) {
            const balanceUpdate = await balanceUpdateService.getBalanceUpdateForUI(
              tabId,
              payment.amount,
              payment.method
            );

            const previousBalance = balanceState.currentBalance?.balance || 0;
            const newBalance = balanceUpdate.currentBalance?.balance || 0;

            // Check for auto-close
            const autoCloseDetected = enableAutoClose && 
              balanceUpdate.currentBalance?.status === 'overdue' && 
              newBalance <= 0;

            // Create animation if enabled
            let animation: BalanceChangeAnimation | null = null;
            if (enableAnimations && previousBalance !== newBalance) {
              animation = getBalanceChangeAnimation(previousBalance + payment.amount, newBalance);
            }

            // Update state
            setBalanceState(prev => ({
              ...prev,
              currentBalance: balanceUpdate.currentBalance,
              previousBalance: previousBalance,
              animation,
              statusIndicator: balanceUpdate.statusIndicator,
              formattedBalance: balanceUpdate.formattedBalance,
              autoCloseDetected,
              lastUpdated: new Date().toISOString()
            }));

            // Trigger callbacks
            if (balanceUpdate.currentBalance && onBalanceChange) {
              onBalanceChange(balanceUpdate.currentBalance, previousBalance);
            }

            if (autoCloseDetected && onAutoClose) {
              onAutoClose(tabId, newBalance);
            }

            // Clear animation after duration
            if (animation && animationTimeoutRef.current) {
              clearTimeout(animationTimeoutRef.current);
            }
            
            if (animation) {
              animationTimeoutRef.current = setTimeout(() => {
                setBalanceState(prev => ({ ...prev, animation: null }));
              }, animation.duration);
            }

          } else {
            // Fallback: reload balance without service
            await loadBalance();
          }

        } catch (error) {
          console.error('Error processing balance update:', error);
          // Fallback: reload balance
          await loadBalance();
        }
      }
    }
  }, [
    tabId,
    balanceUpdateService,
    balanceState.currentBalance?.balance,
    enableAnimations,
    enableAutoClose,
    getBalanceChangeAnimation,
    onBalanceChange,
    onAutoClose,
    loadBalance
  ]);

  // Handle tab status updates (for auto-close detection)
  const handleTabUpdate = useCallback(async (payload: any) => {
    console.log('Balance update - tab subscription update:', payload);

    if (payload.eventType === 'UPDATE' && payload.new?.id === tabId) {
      const updatedTab = payload.new;
      
      // Check if tab was closed
      if (updatedTab.status === 'closed' && balanceState.currentBalance?.status !== 'closed') {
        console.log('Tab was closed, updating balance state');
        
        setBalanceState(prev => ({
          ...prev,
          currentBalance: prev.currentBalance ? {
            ...prev.currentBalance,
            status: 'closed'
          } : null,
          statusIndicator: {
            color: 'gray',
            icon: '🔒',
            message: 'Tab closed',
            urgency: 'low'
          },
          autoCloseDetected: true,
          lastUpdated: new Date().toISOString()
        }));

        if (onAutoClose && balanceState.currentBalance) {
          onAutoClose(tabId, balanceState.currentBalance.balance);
        }
      }
    }
  }, [tabId, balanceState.currentBalance, onAutoClose]);

  // Set up real-time subscriptions
  const realtimeConfigs = [
    {
      channelName: `balance-updates-${tabId}`,
      table: 'tab_payments',
      filter: `tab_id=eq.${tabId}`,
      event: '*' as const,
      handler: handlePaymentUpdate
    },
    {
      channelName: `balance-updates-${tabId}`,
      table: 'tabs',
      filter: `id=eq.${tabId}`,
      event: '*' as const,
      handler: handleTabUpdate
    }
  ];

  const { connectionStatus, isConnected } = useRealtimeSubscription(
    realtimeConfigs,
    [tabId], // Re-subscribe when tabId changes
    {
      onConnectionChange: (status) => {
        console.log(`Balance updates connection status: ${status}`);
      }
    }
  );

  // Load initial balance on mount
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Cleanup animation timeout
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Manual refresh function
  const refreshBalance = useCallback(async () => {
    await loadBalance();
  }, [loadBalance]);

  // Check if balance should trigger auto-close
  const shouldAutoClose = useCallback((balance: TabBalance): boolean => {
    return enableAutoClose && balance.balance <= 0 && balance.status === 'overdue';
  }, [enableAutoClose]);

  return {
    // Balance state
    ...balanceState,
    
    // Connection status
    connectionStatus,
    isConnected,
    
    // Actions
    refreshBalance,
    shouldAutoClose,
    
    // Utilities
    formatBalance,
    getStatusIndicator: (balance: number, status: string) => getStatusIndicator(balance, status)
  };
};

/**
 * Simplified hook for basic balance display
 * Use when you only need current balance without animations
 */
export const useSimpleBalance = (tabId: string, balanceUpdateService?: BalanceUpdateService) => {
  const [balance, setBalance] = useState<TabBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    if (!balanceUpdateService) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const balanceData = await balanceUpdateService.calculateTabBalance(tabId);
      setBalance(balanceData);
    } catch (err) {
      console.error('Error loading simple balance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [tabId, balanceUpdateService]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  return {
    balance,
    isLoading,
    error,
    refreshBalance: loadBalance,
    formattedBalance: balance ? `KSh ${balance.balance.toLocaleString()}` : 'KSh 0'
  };
};