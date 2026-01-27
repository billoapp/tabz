/**
 * Balance Update Service
 * 
 * Handles real-time balance updates across interfaces when payments are processed.
 * Provides consistent balance calculations and visual feedback for all payment methods.
 * Integrates with payment notification system for real-time UI updates.
 * 
 * Requirements: 4.1, 4.3, 4.5
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PaymentNotificationService, PaymentNotificationPayload } from './payment-notification-service';

export interface TabBalance {
  tabId: string;
  barId: string;
  tabNumber: number;
  totalOrders: number;
  totalPayments: number;
  balance: number;
  status: 'open' | 'overdue' | 'closed';
  lastUpdated: string;
}

export interface BalanceUpdatePayload {
  tabId: string;
  barId: string;
  paymentId: string;
  paymentAmount: number;
  paymentMethod: 'mpesa' | 'cash' | 'card';
  previousBalance: number;
  newBalance: number;
  timestamp: string;
  autoCloseTriggered?: boolean;
}

export interface BalanceChangeAnimation {
  type: 'decrease' | 'increase' | 'zero';
  amount: number;
  duration: number;
  easing: 'ease-in-out' | 'ease-out' | 'linear';
}

/**
 * Configuration for the Balance Update Service
 */
export interface BalanceUpdateServiceConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  animationDuration?: number;
  enableVisualFeedback?: boolean;
  enableAuditLogging?: boolean;
  enableRealTimeNotifications?: boolean;
  paymentNotificationService?: PaymentNotificationService;
}

/**
 * Internal configuration with all required fields
 */
interface InternalBalanceUpdateServiceConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  animationDuration: number;
  enableVisualFeedback: boolean;
  enableAuditLogging: boolean;
  enableRealTimeNotifications: boolean;
  paymentNotificationService?: PaymentNotificationService;
}

/**
 * Balance Update Service Class
 * 
 * Handles real-time balance calculations and updates across all interfaces.
 * Ensures consistency between staff and customer views of tab balances.
 * Integrates with payment notification system for real-time updates.
 */
export class BalanceUpdateService {
  private supabase: SupabaseClient;
  private config: InternalBalanceUpdateServiceConfig;
  private paymentNotificationService?: PaymentNotificationService;

  constructor(config: BalanceUpdateServiceConfig) {
    this.config = {
      animationDuration: 800,
      enableVisualFeedback: true,
      enableAuditLogging: true,
      enableRealTimeNotifications: true,
      paymentNotificationService: config.paymentNotificationService || undefined,
      ...config
    };

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceRoleKey
    );

    this.paymentNotificationService = this.config.paymentNotificationService;
  }

  /**
   * Calculate current tab balance using the same logic as tab_balances view
   * Requirements: 4.1 - Consistent balance calculations across all payment methods
   */
  async calculateTabBalance(tabId: string): Promise<TabBalance | null> {
    try {
      // Use the tab_balances view for consistent calculation
      const { data: balanceData, error: balanceError } = await this.supabase
        .from('tab_balances')
        .select('*')
        .eq('tab_id', tabId)
        .single();

      if (balanceError || !balanceData) {
        console.error('Failed to get tab balance:', balanceError);
        return null;
      }

      return {
        tabId: balanceData.tab_id,
        barId: balanceData.bar_id,
        tabNumber: balanceData.tab_number,
        totalOrders: balanceData.total_orders,
        totalPayments: balanceData.total_payments,
        balance: balanceData.balance,
        status: balanceData.status,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating tab balance:', error);
      return null;
    }
  }

  /**
   * Process payment and trigger real-time balance updates
   * Requirements: 4.1 - Update tab balance displays immediately when payments are processed
   * Requirements: 4.3 - Ensure balance calculations include all payment methods consistently
   */
  async processPaymentBalanceUpdate(
    paymentId: string,
    tabId: string,
    paymentAmount: number,
    paymentMethod: 'mpesa' | 'cash' | 'card',
    paymentStatus: 'success' | 'failed' = 'success'
  ): Promise<{
    success: boolean;
    balanceUpdate?: BalanceUpdatePayload;
    autoCloseTriggered?: boolean;
    error?: string;
  }> {
    try {
      // Only process successful payments for balance updates
      if (paymentStatus !== 'success') {
        console.log('Skipping balance update for failed payment:', paymentId);
        return { success: true };
      }

      // Get current balance before payment
      const currentBalance = await this.calculateTabBalance(tabId);
      if (!currentBalance) {
        throw new Error('Failed to calculate current tab balance');
      }

      const previousBalance = currentBalance.balance + paymentAmount;

      // Create balance update payload
      const balanceUpdate = await this.createBalanceUpdatePayload(
        tabId,
        paymentId,
        paymentAmount,
        paymentMethod,
        previousBalance
      );

      if (!balanceUpdate) {
        throw new Error('Failed to create balance update payload');
      }

      // Check if auto-close should be triggered
      const autoCloseTriggered = this.shouldAutoCloseTab(currentBalance);

      // Trigger real-time notifications if enabled
      if (this.config.enableRealTimeNotifications && this.paymentNotificationService) {
        await this.triggerBalanceUpdateNotifications(balanceUpdate, autoCloseTriggered);
      }

      // Handle auto-close logic if triggered
      if (autoCloseTriggered) {
        await this.handleTabAutoClose(tabId, paymentId, currentBalance.balance);
      }

      console.log('Balance update processed successfully:', {
        paymentId,
        tabId,
        previousBalance,
        newBalance: balanceUpdate.newBalance,
        autoCloseTriggered
      });

      return {
        success: true,
        balanceUpdate,
        autoCloseTriggered
      };

    } catch (error) {
      console.error('Error processing payment balance update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger real-time balance update notifications
   * Requirements: 4.1 - Real-time balance updates across all interfaces
   */
  private async triggerBalanceUpdateNotifications(
    balanceUpdate: BalanceUpdatePayload,
    autoCloseTriggered: boolean
  ): Promise<void> {
    if (!this.paymentNotificationService) {
      console.warn('Payment notification service not available for balance updates');
      return;
    }

    try {
      // Create payment notification payload for balance update
      const paymentNotification: Partial<PaymentNotificationPayload> = {
        paymentId: balanceUpdate.paymentId,
        tabId: balanceUpdate.tabId,
        amount: balanceUpdate.paymentAmount,
        status: 'success',
        method: balanceUpdate.paymentMethod,
        timestamp: balanceUpdate.timestamp
      };

      // Create the notification
      const notification = await this.paymentNotificationService.createPaymentNotification(
        paymentNotification
      );

      // Get notification recipients
      const recipients = await this.paymentNotificationService.getNotificationRecipients(
        balanceUpdate.barId,
        balanceUpdate.tabId,
        true // Include customer
      );

      // Deliver balance update notification
      const deliveryResult = await this.paymentNotificationService.deliverNotification(
        notification,
        recipients,
        'high' // High priority for balance updates
      );

      console.log('Balance update notification delivered:', {
        paymentId: balanceUpdate.paymentId,
        tabId: balanceUpdate.tabId,
        deliverySuccess: deliveryResult.success,
        deliveredCount: deliveryResult.deliveredCount,
        deliveryTime: deliveryResult.deliveryTime
      });

      // Trigger auto-close notification if needed
      if (autoCloseTriggered) {
        await this.triggerAutoCloseNotification(balanceUpdate);
      }

    } catch (error) {
      console.error('Error triggering balance update notifications:', error);
    }
  }

  /**
   * Trigger auto-close notification for overdue tabs
   * Requirements: 4.2 - Auto-close detection logic when tab balances reach zero
   */
  private async triggerAutoCloseNotification(balanceUpdate: BalanceUpdatePayload): Promise<void> {
    if (!this.paymentNotificationService) return;

    try {
      // Create auto-close notification payload
      const autoCloseNotification = await this.paymentNotificationService.createTabAutoCloseNotification({
        tabId: balanceUpdate.tabId,
        paymentId: balanceUpdate.paymentId,
        finalBalance: balanceUpdate.newBalance,
        closedBy: 'system',
        timestamp: new Date().toISOString()
      });

      // Get notification recipients
      const recipients = await this.paymentNotificationService.getNotificationRecipients(
        balanceUpdate.barId,
        balanceUpdate.tabId,
        true // Include customer
      );

      // Deliver auto-close notification
      const deliveryResult = await this.paymentNotificationService.deliverNotification(
        autoCloseNotification,
        recipients,
        'high' // High priority for auto-close
      );

      console.log('Auto-close notification delivered:', {
        tabId: balanceUpdate.tabId,
        paymentId: balanceUpdate.paymentId,
        deliverySuccess: deliveryResult.success,
        deliveredCount: deliveryResult.deliveredCount
      });

    } catch (error) {
      console.error('Error triggering auto-close notification:', error);
    }
  }

  /**
   * Handle tab auto-close logic
   * Requirements: 4.2 - Auto-close detection logic when tab balances reach zero
   */
  private async handleTabAutoClose(
    tabId: string,
    paymentId: string,
    finalBalance: number
  ): Promise<void> {
    try {
      // Update tab status to closed
      const { error: closeError } = await this.supabase
        .from('tabs')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: 'system'
        })
        .eq('id', tabId)
        .eq('status', 'overdue'); // Only close if still overdue

      if (closeError) {
        console.error('Failed to auto-close tab:', {
          tabId,
          paymentId,
          error: closeError
        });
        return;
      }

      // Create audit log for auto-close
      if (this.config.enableAuditLogging) {
        const { data: tabData } = await this.supabase
          .from('tabs')
          .select('bar_id')
          .eq('id', tabId)
          .single();

        if (tabData) {
          await this.createBalanceUpdateAuditLog({
            tabId,
            barId: tabData.bar_id,
            paymentId,
            paymentAmount: 0, // No additional payment for auto-close
            paymentMethod: 'mpesa', // Method that triggered the close
            previousBalance: finalBalance,
            newBalance: finalBalance,
            timestamp: new Date().toISOString(),
            autoCloseTriggered: true
          });
        }
      }

      console.log('Tab auto-closed successfully:', {
        tabId,
        paymentId,
        finalBalance
      });

    } catch (error) {
      console.error('Error handling tab auto-close:', error);
    }
  }

  /**
   * Get real-time balance update for UI components
   * Requirements: 4.5 - Add balance change animations and visual feedback
   */
  async getBalanceUpdateForUI(
    tabId: string,
    paymentAmount: number,
    paymentMethod: 'mpesa' | 'cash' | 'card'
  ): Promise<{
    currentBalance: TabBalance | null;
    animation: BalanceChangeAnimation;
    statusIndicator: {
      color: string;
      icon: string;
      message: string;
      urgency: 'low' | 'medium' | 'high';
    };
    formattedBalance: string;
    balanceTrend?: {
      trend: 'decreasing' | 'stable' | 'increasing';
      changePercentage: number;
      recentPayments: number;
      averagePaymentAmount: number;
    };
  }> {
    try {
      // Get current balance
      const currentBalance = await this.calculateTabBalance(tabId);
      if (!currentBalance) {
        throw new Error('Failed to get current balance');
      }

      // Calculate previous balance for animation
      const previousBalance = currentBalance.balance + paymentAmount;

      // Get animation configuration
      const animation = this.getBalanceChangeAnimation(previousBalance, currentBalance.balance);

      // Get status indicator
      const statusIndicator = this.getBalanceStatusIndicator(
        currentBalance.balance,
        currentBalance.status
      );

      // Format balance for display
      const formattedBalance = this.formatBalance(currentBalance.balance);

      // Get balance trend (optional, requires payment history)
      let balanceTrend;
      try {
        const { data: paymentHistory } = await this.supabase
          .from('tab_payments')
          .select('amount, created_at')
          .eq('tab_id', tabId)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(10);

        if (paymentHistory) {
          balanceTrend = this.getBalanceTrend(
            currentBalance.balance,
            previousBalance,
            paymentHistory.map(p => ({ amount: p.amount, timestamp: p.created_at }))
          );
        }
      } catch (error) {
        console.warn('Failed to get balance trend:', error);
      }

      return {
        currentBalance,
        animation,
        statusIndicator,
        formattedBalance,
        balanceTrend
      };

    } catch (error) {
      console.error('Error getting balance update for UI:', error);
      
      // Return safe defaults
      return {
        currentBalance: null,
        animation: {
          type: 'zero',
          amount: 0,
          duration: this.config.animationDuration,
          easing: 'ease-in-out'
        },
        statusIndicator: {
          color: 'gray',
          icon: 'ℹ️',
          message: 'Balance unknown',
          urgency: 'low' as const
        },
        formattedBalance: 'KSh 0'
      };
    }
  }

  /**
   * Create balance update payload for notifications
   * Requirements: 4.1 - Update tab balance displays immediately when payments are processed
   */
  async createBalanceUpdatePayload(
    tabId: string,
    paymentId: string,
    paymentAmount: number,
    paymentMethod: 'mpesa' | 'cash' | 'card',
    previousBalance?: number
  ): Promise<BalanceUpdatePayload | null> {
    try {
      // Get current balance
      const currentBalance = await this.calculateTabBalance(tabId);
      if (!currentBalance) {
        throw new Error('Failed to calculate current tab balance');
      }

      // Calculate previous balance if not provided
      const prevBalance = previousBalance !== undefined 
        ? previousBalance 
        : currentBalance.balance + paymentAmount;

      // Check if auto-close should be triggered
      const autoCloseTriggered = currentBalance.balance <= 0 && currentBalance.status === 'overdue';

      const payload: BalanceUpdatePayload = {
        tabId: currentBalance.tabId,
        barId: currentBalance.barId,
        paymentId,
        paymentAmount,
        paymentMethod,
        previousBalance: prevBalance,
        newBalance: currentBalance.balance,
        timestamp: new Date().toISOString(),
        autoCloseTriggered
      };

      // Create audit log if enabled
      if (this.config.enableAuditLogging) {
        await this.createBalanceUpdateAuditLog(payload);
      }

      return payload;
    } catch (error) {
      console.error('Error creating balance update payload:', error);
      return null;
    }
  }

  /**
   * Get balance change animation configuration
   * Requirements: 4.5 - Add balance change animations and visual feedback
   */
  getBalanceChangeAnimation(
    previousBalance: number,
    newBalance: number
  ): BalanceChangeAnimation {
    const difference = previousBalance - newBalance;
    
    if (difference > 0) {
      // Balance decreased (payment made)
      return {
        type: 'decrease',
        amount: difference,
        duration: this.config.animationDuration,
        easing: 'ease-out'
      };
    } else if (difference < 0) {
      // Balance increased (rare case, maybe refund)
      return {
        type: 'increase',
        amount: Math.abs(difference),
        duration: this.config.animationDuration,
        easing: 'ease-in-out'
      };
    } else {
      // Balance reached zero
      return {
        type: 'zero',
        amount: 0,
        duration: this.config.animationDuration * 1.5, // Longer animation for zero balance
        easing: 'ease-in-out'
      };
    }
  }

  /**
   * Format balance for display with consistent currency formatting
   * Requirements: 4.3 - Ensure balance calculations include all payment methods consistently
   */
  formatBalance(amount: number): string {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  }

  /**
   * Get balance status indicator
   * Requirements: 4.5 - Add balance change animations and visual feedback
   */
  getBalanceStatusIndicator(balance: number, tabStatus: string): {
    color: string;
    icon: string;
    message: string;
    urgency: 'low' | 'medium' | 'high';
  } {
    if (balance <= 0) {
      return {
        color: 'green',
        icon: '✅',
        message: 'Tab fully paid',
        urgency: 'low'
      };
    } else if (tabStatus === 'overdue') {
      return {
        color: 'red',
        icon: '⚠️',
        message: 'Overdue - payment required',
        urgency: 'high'
      };
    } else if (balance > 0) {
      return {
        color: 'orange',
        icon: '💰',
        message: 'Outstanding balance',
        urgency: 'medium'
      };
    } else {
      return {
        color: 'gray',
        icon: 'ℹ️',
        message: 'Balance unknown',
        urgency: 'low'
      };
    }
  }

  /**
   * Validate balance update payload
   */
  validateBalanceUpdatePayload(payload: any): payload is BalanceUpdatePayload {
    return (
      typeof payload === 'object' &&
      typeof payload.tabId === 'string' &&
      typeof payload.barId === 'string' &&
      typeof payload.paymentId === 'string' &&
      typeof payload.paymentAmount === 'number' &&
      ['mpesa', 'cash', 'card'].includes(payload.paymentMethod) &&
      typeof payload.previousBalance === 'number' &&
      typeof payload.newBalance === 'number' &&
      typeof payload.timestamp === 'string'
    );
  }

  /**
   * Create audit log for balance updates
   * Requirements: 4.1 - Audit logging for balance changes
   */
  private async createBalanceUpdateAuditLog(payload: BalanceUpdatePayload): Promise<void> {
    try {
      const auditLog = {
        id: crypto.randomUUID(),
        bar_id: payload.barId,
        tab_id: payload.tabId,
        action: 'balance_updated',
        details: {
          paymentId: payload.paymentId,
          paymentAmount: payload.paymentAmount,
          paymentMethod: payload.paymentMethod,
          previousBalance: payload.previousBalance,
          newBalance: payload.newBalance,
          balanceChange: payload.previousBalance - payload.newBalance,
          autoCloseTriggered: payload.autoCloseTriggered || false
        },
        created_at: payload.timestamp
      };

      const { error } = await this.supabase
        .from('audit_logs')
        .insert(auditLog);

      if (error) {
        console.error('Failed to create balance update audit log:', error);
      }
    } catch (error) {
      console.error('Error creating balance update audit log:', error);
    }
  }

  /**
   * Get multiple tab balances efficiently
   * Requirements: 4.1 - Efficient balance calculations for multiple tabs
   */
  async getMultipleTabBalances(tabIds: string[]): Promise<TabBalance[]> {
    try {
      const { data: balanceData, error: balanceError } = await this.supabase
        .from('tab_balances')
        .select('*')
        .in('tab_id', tabIds);

      if (balanceError) {
        console.error('Failed to get multiple tab balances:', balanceError);
        return [];
      }

      return (balanceData || []).map(data => ({
        tabId: data.tab_id,
        barId: data.bar_id,
        tabNumber: data.tab_number,
        totalOrders: data.total_orders,
        totalPayments: data.total_payments,
        balance: data.balance,
        status: data.status,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting multiple tab balances:', error);
      return [];
    }
  }

  /**
   * Check if tab should be auto-closed based on balance
   * Requirements: 4.2 - Auto-close detection logic when tab balances reach zero
   */
  shouldAutoCloseTab(balance: TabBalance): boolean {
    return balance.balance <= 0 && balance.status === 'overdue';
  }

  /**
   * Get balance trend analysis
   * Requirements: 4.5 - Visual feedback for balance changes
   */
  getBalanceTrend(
    currentBalance: number,
    previousBalance: number,
    paymentHistory: Array<{ amount: number; timestamp: string }>
  ): {
    trend: 'decreasing' | 'stable' | 'increasing';
    changePercentage: number;
    recentPayments: number;
    averagePaymentAmount: number;
  } {
    const change = currentBalance - previousBalance;
    const changePercentage = previousBalance > 0 ? (change / previousBalance) * 100 : 0;
    
    // Analyze recent payments (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPayments = paymentHistory.filter(p => 
      new Date(p.timestamp) > oneDayAgo
    );
    
    const averagePaymentAmount = recentPayments.length > 0
      ? recentPayments.reduce((sum, p) => sum + p.amount, 0) / recentPayments.length
      : 0;

    let trend: 'decreasing' | 'stable' | 'increasing';
    if (Math.abs(changePercentage) < 5) {
      trend = 'stable';
    } else if (changePercentage < 0) {
      trend = 'decreasing';
    } else {
      trend = 'increasing';
    }

    return {
      trend,
      changePercentage,
      recentPayments: recentPayments.length,
      averagePaymentAmount
    };
  }
}