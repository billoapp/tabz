/**
 * M-PESA Transaction Service
 * Handles CRUD operations for M-PESA transactions with proper state management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, TransactionStatus, MpesaEnvironment } from '../types';

export interface CreateTransactionData {
  tabId: string;           // Changed from orderId
  customerId?: string;
  phoneNumber: string;
  amount: number;
  environment: MpesaEnvironment;
}

export interface UpdateTransactionData {
  status?: TransactionStatus;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  failureReason?: string;
  resultCode?: number;
  callbackData?: any;
  tabPaymentId?: string;   // Link to tab_payments record
}

export class TransactionService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new M-PESA transaction for tab payment
   */
  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    const transactionData = {
      tab_id: data.tabId,        // Changed from order_id
      customer_id: data.customerId,
      phone_number: data.phoneNumber,
      amount: data.amount,
      environment: data.environment,
      status: 'pending' as TransactionStatus,
      currency: 'KES'
    };

    const { data: transaction, error } = await this.supabase
      .from('mpesa_transactions')
      .insert(transactionData as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return this.mapDatabaseToTransaction(transaction);
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction | null> {
    const { data: transaction, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get transaction: ${error.message}`);
    }

    return this.mapDatabaseToTransaction(transaction);
  }

  /**
   * Get transaction by checkout request ID
   */
  async getTransactionByCheckoutRequestId(checkoutRequestId: string): Promise<Transaction | null> {
    const { data: transaction, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get transaction by checkout request ID: ${error.message}`);
    }

    return this.mapDatabaseToTransaction(transaction);
  }

  /**
   * Find transaction by checkout request ID (alias for callback handler)
   */
  async findByCheckoutRequestId(checkoutRequestId: string): Promise<Transaction | null> {
    return this.getTransactionByCheckoutRequestId(checkoutRequestId);
  }

  /**
   * Update transaction status with additional data
   */
  async updateTransactionStatus(
    id: string, 
    status: TransactionStatus, 
    additionalData?: Partial<UpdateTransactionData>
  ): Promise<Transaction> {
    const updates: UpdateTransactionData = {
      status,
      ...additionalData
    };

    return this.updateTransaction(id, updates);
  }

  /**
   * Get transaction by tab ID (returns most recent transaction for the tab)
   */
  async getTransactionByTabId(tabId: string): Promise<Transaction | null> {
    const { data: transaction, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get transaction by tab ID: ${error.message}`);
    }

    return this.mapDatabaseToTransaction(transaction);
  }

  /**
   * Update transaction
   */
  async updateTransaction(id: string, updates: UpdateTransactionData): Promise<Transaction> {
    const updateData: any = {};

    // Map TypeScript fields to database fields
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.checkoutRequestId !== undefined) updateData.checkout_request_id = updates.checkoutRequestId;
    if (updates.merchantRequestId !== undefined) updateData.merchant_request_id = updates.merchantRequestId;
    if (updates.mpesaReceiptNumber !== undefined) updateData.mpesa_receipt_number = updates.mpesaReceiptNumber;
    if (updates.transactionDate !== undefined) updateData.transaction_date = updates.transactionDate;
    if (updates.failureReason !== undefined) updateData.failure_reason = updates.failureReason;
    if (updates.resultCode !== undefined) updateData.result_code = updates.resultCode;
    if (updates.callbackData !== undefined) updateData.callback_data = updates.callbackData;

    const { data: transaction, error } = await this.supabase
      .from('mpesa_transactions')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update transaction: ${error.message}`);
    }

    return this.mapDatabaseToTransaction(transaction);
  }

  /**
   * Get transactions by status
   */
  async getTransactionsByStatus(status: TransactionStatus, limit = 100): Promise<Transaction[]> {
    const { data: transactions, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get transactions by status: ${error.message}`);
    }

    return transactions.map(this.mapDatabaseToTransaction);
  }

  /**
   * Get transactions for a specific tab
   */
  async getTransactionsForTab(tabId: string): Promise<Transaction[]> {
    const { data: transactions, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get transactions for tab: ${error.message}`);
    }

    return transactions.map(this.mapDatabaseToTransaction);
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(limit = 50): Promise<Transaction[]> {
    const { data: transactions, error } = await this.supabase
      .from('mpesa_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent transactions: ${error.message}`);
    }

    return transactions.map(this.mapDatabaseToTransaction);
  }

  /**
   * Handle transaction timeout - update sent transactions older than 5 minutes
   */
  async handleTransactionTimeouts(): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('handle_transaction_timeouts');

    if (error) {
      throw new Error(`Failed to handle transaction timeouts: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Delete transaction (for testing/cleanup only)
   */
  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('mpesa_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(environment?: MpesaEnvironment): Promise<{
    total: number;
    pending: number;
    sent: number;
    completed: number;
    failed: number;
    cancelled: number;
    timeout: number;
  }> {
    let query = this.supabase
      .from('mpesa_transactions')
      .select('status');

    if (environment) {
      query = query.eq('environment', environment);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to get transaction stats: ${error.message}`);
    }

    const stats = {
      total: transactions.length,
      pending: 0,
      sent: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      timeout: 0
    };

    transactions.forEach((transaction: any) => {
      stats[transaction.status as keyof typeof stats]++;
    });

    return stats;
  }

  /**
   * Map database record to Transaction interface
   */
  private mapDatabaseToTransaction(dbRecord: any): Transaction {
    return {
      id: dbRecord.id,
      tabId: dbRecord.tab_id,           // Changed from orderId
      customerId: dbRecord.customer_id,
      phoneNumber: dbRecord.phone_number,
      amount: parseFloat(dbRecord.amount),
      currency: dbRecord.currency,
      status: dbRecord.status,
      checkoutRequestId: dbRecord.checkout_request_id,
      mpesaReceiptNumber: dbRecord.mpesa_receipt_number,
      transactionDate: dbRecord.transaction_date ? new Date(dbRecord.transaction_date) : undefined,
      failureReason: dbRecord.failure_reason,
      resultCode: dbRecord.result_code,
      environment: dbRecord.environment,
      tabPaymentId: dbRecord.tab_payment_id,  // New field
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
      callbackData: dbRecord.callback_data
    };
  }
}

/**
 * Transaction validation utilities
 */
export class TransactionValidator {
  /**
   * Validate phone number format (254XXXXXXXX)
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^254[0-9]{9}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Validate amount (positive number, max 2 decimal places)
   */
  static validateAmount(amount: number): boolean {
    if (amount <= 0) return false;
    if (amount > 999999.99) return false; // Max amount
    
    // Check decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }

  /**
   * Validate transaction data before creation
   */
  static validateCreateTransactionData(data: CreateTransactionData): string[] {
    const errors: string[] = [];

    if (!data.tabId) {
      errors.push('Tab ID is required');
    }

    if (!data.phoneNumber) {
      errors.push('Phone number is required');
    } else if (!this.validatePhoneNumber(data.phoneNumber)) {
      errors.push('Phone number must be in format 254XXXXXXXX');
    }

    if (!data.amount) {
      errors.push('Amount is required');
    } else if (!this.validateAmount(data.amount)) {
      errors.push('Amount must be positive and have at most 2 decimal places');
    }

    if (!data.environment || !['sandbox', 'production'].includes(data.environment)) {
      errors.push('Environment must be either sandbox or production');
    }

    return errors;
  }
}