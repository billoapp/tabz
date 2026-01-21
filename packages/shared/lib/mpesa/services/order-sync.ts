/**
 * Order Status Synchronization Service
 * Handles updating order/tab status based on M-PESA payment results
 * Integrates with existing tab_payments system for partial payment support
 */

import { BaseService, Logger, HttpClient } from './base';
import { Transaction, ServiceConfig, MpesaError } from '../types';
import { createClient } from '@supabase/supabase-js';

/**
 * Order synchronization result
 */
export interface OrderSyncResult {
  success: boolean;
  tabPaymentId?: string;
  tabId?: string;
  amount?: number;
  error?: string;
}

/**
 * Tab payment data for creating payment records
 */
export interface TabPaymentData {
  tabId: string;
  amount: number;
  method: 'mpesa';
  status: 'success' | 'failed';
  reference: string;
  metadata?: Record<string, any>;
}

/**
 * Order Status Update Service
 * Handles synchronization between M-PESA transactions and tab payments
 */
export class OrderStatusUpdateService extends BaseService {
  private supabase: any;

  constructor(
    config: ServiceConfig,
    logger?: Logger,
    httpClient?: HttpClient
  ) {
    super(config, logger, httpClient);
    this.validateConfig();
    this.initializeSupabase();
  }

  /**
   * Initialize Supabase client for database operations
   */
  private initializeSupabase(): void {
    if (!this.config.supabaseUrl || !this.config.supabaseServiceKey) {
      throw new MpesaError('Supabase configuration missing for order sync service', 'CONFIG_ERROR');
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey
    );
  }

  /**
   * Update order status based on successful M-PESA payment
   * Creates a tab_payments record and links it to the M-PESA transaction
   */
  async updateOrderStatusForSuccessfulPayment(
    transaction: Transaction,
    mpesaReceiptNumber: string,
    transactionDate: Date
  ): Promise<OrderSyncResult> {
    try {
      this.logWithContext('info', 'Processing successful M-PESA payment for order sync', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        amount: transaction.amount,
        mpesaReceiptNumber
      });

      // Use the database function to complete the payment atomically
      const { data: paymentId, error } = await this.supabase
        .rpc('complete_mpesa_payment', {
          p_transaction_id: transaction.id,
          p_mpesa_receipt_number: mpesaReceiptNumber,
          p_transaction_date: transactionDate.toISOString()
        });

      if (error) {
        throw new MpesaError(`Failed to complete M-PESA payment: ${error.message}`, 'DATABASE_ERROR');
      }

      this.logWithContext('info', 'Successfully created tab payment for M-PESA transaction', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        tabPaymentId: paymentId,
        amount: transaction.amount,
        mpesaReceiptNumber
      });

      return {
        success: true,
        tabPaymentId: paymentId,
        tabId: transaction.tabId,
        amount: transaction.amount
      };

    } catch (error) {
      this.logWithContext('error', 'Failed to update order status for successful payment', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update order status based on failed M-PESA payment
   * Marks the transaction as failed but doesn't affect tab balance
   */
  async updateOrderStatusForFailedPayment(
    transaction: Transaction,
    failureReason: string,
    resultCode?: number
  ): Promise<OrderSyncResult> {
    try {
      this.logWithContext('info', 'Processing failed M-PESA payment for order sync', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        amount: transaction.amount,
        failureReason,
        resultCode
      });

      // Use the database function to mark payment as failed
      const { error } = await this.supabase
        .rpc('fail_mpesa_payment', {
          p_transaction_id: transaction.id,
          p_failure_reason: failureReason,
          p_result_code: resultCode
        });

      if (error) {
        throw new MpesaError(`Failed to mark M-PESA payment as failed: ${error.message}`, 'DATABASE_ERROR');
      }

      this.logWithContext('info', 'Successfully marked M-PESA payment as failed', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        failureReason,
        resultCode
      });

      return {
        success: true,
        tabId: transaction.tabId,
        amount: transaction.amount
      };

    } catch (error) {
      this.logWithContext('error', 'Failed to update order status for failed payment', {
        transactionId: transaction.id,
        tabId: transaction.tabId,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get tab balance information after payment processing
   * Useful for providing feedback to customers about remaining balance
   */
  async getTabBalanceInfo(tabId: string): Promise<{
    totalOrders: number;
    totalPayments: number;
    balance: number;
    paymentMethods: Array<{ method: string; amount: number; count: number }>;
  }> {
    try {
      // Get total orders for the tab
      const { data: orders, error: ordersError } = await this.supabase
        .from('tab_orders')
        .select('total')
        .eq('tab_id', tabId)
        .eq('status', 'confirmed');

      if (ordersError) {
        throw new MpesaError(`Failed to get tab orders: ${ordersError.message}`, 'DATABASE_ERROR');
      }

      // Get total payments for the tab
      const { data: payments, error: paymentsError } = await this.supabase
        .from('tab_payments')
        .select('amount, method')
        .eq('tab_id', tabId)
        .eq('status', 'success');

      if (paymentsError) {
        throw new MpesaError(`Failed to get tab payments: ${paymentsError.message}`, 'DATABASE_ERROR');
      }

      // Calculate totals
      const totalOrders = orders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;
      const totalPayments = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) || 0;
      const balance = totalOrders - totalPayments;

      // Group payments by method
      const paymentMethods = payments?.reduce((acc, payment) => {
        const existing = acc.find(p => p.method === payment.method);
        if (existing) {
          existing.amount += parseFloat(payment.amount);
          existing.count += 1;
        } else {
          acc.push({
            method: payment.method,
            amount: parseFloat(payment.amount),
            count: 1
          });
        }
        return acc;
      }, [] as Array<{ method: string; amount: number; count: number }>) || [];

      return {
        totalOrders,
        totalPayments,
        balance,
        paymentMethods
      };

    } catch (error) {
      this.logWithContext('error', 'Failed to get tab balance info', {
        tabId,
        error: error instanceof Error ? error.message : error
      });

      throw error;
    }
  }

  /**
   * Validate that a transaction can be processed for order sync
   */
  async validateTransactionForSync(transaction: Transaction): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if transaction exists and is in correct state
      if (!transaction.id) {
        errors.push('Transaction ID is missing');
      }

      if (!transaction.tabId) {
        errors.push('Tab ID is missing from transaction');
      }

      if (!transaction.amount || transaction.amount <= 0) {
        errors.push('Invalid transaction amount');
      }

      // Check if tab exists and is accessible
      if (transaction.tabId) {
        const { data: tab, error: tabError } = await this.supabase
          .from('tabs')
          .select('id, status, bar_id')
          .eq('id', transaction.tabId)
          .single();

        if (tabError || !tab) {
          errors.push('Tab not found or not accessible');
        } else if (tab.status === 'closed') {
          errors.push('Cannot process payment for closed tab');
        }
      }

      // Check for duplicate payments (same receipt number)
      if (transaction.mpesaReceiptNumber) {
        const { data: existingPayment, error: duplicateError } = await this.supabase
          .from('tab_payments')
          .select('id')
          .eq('reference', transaction.mpesaReceiptNumber)
          .single();

        if (!duplicateError && existingPayment) {
          errors.push('Payment with this M-PESA receipt number already exists');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Rollback a completed payment (for error recovery)
   * This should only be used in exceptional circumstances
   */
  async rollbackPayment(transactionId: string, reason: string): Promise<OrderSyncResult> {
    try {
      this.logWithContext('warn', 'Rolling back M-PESA payment', {
        transactionId,
        reason
      });

      // Get the transaction and associated payment
      const { data: transaction, error: transactionError } = await this.supabase
        .from('mpesa_transactions')
        .select('id, tab_id, amount, tab_payment_id, mpesa_receipt_number')
        .eq('id', transactionId)
        .eq('status', 'completed')
        .single();

      if (transactionError || !transaction) {
        throw new MpesaError('Transaction not found or not in completed status', 'TRANSACTION_NOT_FOUND');
      }

      // Start transaction for rollback
      const { error: rollbackError } = await this.supabase.rpc('rollback_mpesa_payment', {
        p_transaction_id: transactionId,
        p_rollback_reason: reason
      });

      if (rollbackError) {
        throw new MpesaError(`Failed to rollback payment: ${rollbackError.message}`, 'DATABASE_ERROR');
      }

      this.logWithContext('info', 'Successfully rolled back M-PESA payment', {
        transactionId,
        tabId: transaction.tab_id,
        amount: transaction.amount,
        reason
      });

      return {
        success: true,
        tabId: transaction.tab_id,
        amount: transaction.amount
      };

    } catch (error) {
      this.logWithContext('error', 'Failed to rollback payment', {
        transactionId,
        reason,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get payment history for a tab (including M-PESA and other methods)
   */
  async getTabPaymentHistory(tabId: string): Promise<Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    reference?: string;
    createdAt: Date;
    mpesaTransactionId?: string;
  }>> {
    try {
      const { data: payments, error } = await this.supabase
        .from('tab_payments')
        .select(`
          id,
          amount,
          method,
          status,
          reference,
          created_at,
          metadata
        `)
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new MpesaError(`Failed to get payment history: ${error.message}`, 'DATABASE_ERROR');
      }

      return payments?.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount),
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        createdAt: new Date(payment.created_at),
        mpesaTransactionId: payment.metadata?.mpesa_transaction_id
      })) || [];

    } catch (error) {
      this.logWithContext('error', 'Failed to get tab payment history', {
        tabId,
        error: error instanceof Error ? error.message : error
      });

      throw error;
    }
  }

  /**
   * Validate service configuration
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.supabaseUrl) {
      throw new MpesaError('Supabase URL is required for order sync service', 'CONFIG_ERROR');
    }

    if (!this.config.supabaseServiceKey) {
      throw new MpesaError('Supabase service key is required for order sync service', 'CONFIG_ERROR');
    }
  }
}