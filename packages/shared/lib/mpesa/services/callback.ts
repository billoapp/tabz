/**
 * M-PESA Callback Handler Service
 * Handles STK Push callbacks with proper validation, authentication, and processing
 */

import { 
  STKCallbackData, 
  SuccessfulPaymentData, 
  FailedPaymentData,
  Transaction,
  TransactionStatus,
  MpesaError,
  MpesaValidationError
} from '../types';
import { BaseService, Logger, HttpClient } from './base';
import { TransactionService } from './transaction';
import { OrderStatusUpdateService } from './order-sync';
import { TabAutoCloseService, createTabAutoCloseService } from './tab-auto-close';
import { ServiceConfig } from '../types';
import { getAuditLogger } from '../middleware/audit-logger';

/**
 * Callback validation result
 */
export interface CallbackValidationResult {
  isValid: boolean;
  errors: string[];
  checkoutRequestId?: string;
  merchantRequestId?: string;
}

/**
 * Callback processing result
 */
export interface CallbackProcessingResult {
  success: boolean;
  transactionId?: string;
  status?: TransactionStatus;
  error?: string;
}

/**
 * Callback authentication interface
 */
export interface CallbackAuthenticator {
  validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean>;
}

/**
 * Default callback authenticator (basic validation)
 */
export class DefaultCallbackAuthenticator implements CallbackAuthenticator {
  constructor(private logger: Logger) {}

  async validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean> {
    try {
      // Basic structure validation
      if (!callbackData?.Body?.stkCallback) {
        this.logger.warn('Invalid callback structure - missing stkCallback');
        return false;
      }

      const stkCallback = callbackData.Body.stkCallback;
      
      // Required fields validation
      const requiredFields = ['MerchantRequestID', 'CheckoutRequestID', 'ResultCode', 'ResultDesc'];
      for (const field of requiredFields) {
        if (!(field in stkCallback)) {
          this.logger.warn(`Invalid callback - missing required field: ${field}`);
          return false;
        }
      }

      // Additional security checks can be added here
      // For example: IP whitelist, signature validation, etc.
      
      return true;
    } catch (error) {
      this.logger.error('Callback authentication error', { error });
      return false;
    }
  }
}

/**
 * M-PESA Callback Handler Service
 */
export class CallbackHandler extends BaseService {
  private transactionService: TransactionService;
  private orderSyncService: OrderStatusUpdateService;
  private tabAutoCloseService: TabAutoCloseService;
  private authenticator: CallbackAuthenticator;

  constructor(
    config: ServiceConfig,
    transactionService: TransactionService,
    orderSyncService: OrderStatusUpdateService,
    authenticator?: CallbackAuthenticator,
    logger?: Logger,
    httpClient?: HttpClient
  ) {
    super(config, logger, httpClient);
    this.transactionService = transactionService;
    this.orderSyncService = orderSyncService;
    this.tabAutoCloseService = createTabAutoCloseService(
      config.supabaseUrl || '',
      config.supabaseServiceKey || '',
      logger
    );
    this.authenticator = authenticator || new DefaultCallbackAuthenticator(this.logger);
    this.validateConfig();
  }

  /**
   * Main callback handling method with enhanced transaction association
   */
  async handleSTKCallback(
    callbackData: STKCallbackData, 
    headers?: Record<string, string>
  ): Promise<CallbackProcessingResult> {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    
    try {
      this.logWithContext('info', 'Processing M-PESA callback', {
        merchantRequestId: callbackData.Body?.stkCallback?.MerchantRequestID,
        checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID
      });

      // Log callback received event
      await auditLogger.logEvent({
        eventType: 'callback_received',
        eventData: {
          merchantRequestId: callbackData.Body?.stkCallback?.MerchantRequestID,
          checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
          resultCode: callbackData.Body?.stkCallback?.ResultCode,
          receivedAt: new Date().toISOString()
        },
        sensitiveData: {
          callbackData: JSON.stringify(callbackData)
        },
        environment: this.config.environment,
        severity: 'info',
        category: 'payment'
      });

      // Step 1: Validate callback authenticity
      const isAuthentic = await this.authenticator.validateCallback(callbackData, headers);
      if (!isAuthentic) {
        await auditLogger.logEvent({
          eventType: 'callback_failed',
          eventData: {
            reason: 'Authentication failed',
            checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
            failedAt: new Date().toISOString()
          },
          environment: this.config.environment,
          severity: 'error',
          category: 'security'
        });
        throw new MpesaValidationError('Callback authentication failed', ['Invalid callback signature or structure']);
      }

      // Step 2: Validate callback structure
      const validation = this.validateCallback(callbackData);
      if (!validation.isValid) {
        await auditLogger.logEvent({
          eventType: 'callback_failed',
          eventData: {
            reason: 'Validation failed',
            errors: validation.errors,
            checkoutRequestId: validation.checkoutRequestId,
            failedAt: new Date().toISOString()
          },
          environment: this.config.environment,
          severity: 'error',
          category: 'payment'
        });
        throw new MpesaValidationError('Callback validation failed', validation.errors);
      }

      // Step 3: Check for existing transaction and handle duplicates/orphans
      const checkoutRequestId = validation.checkoutRequestId!;
      const existingTransaction = await this.transactionService.findByCheckoutRequestId(checkoutRequestId);
      
      if (!existingTransaction) {
        // Handle orphaned callback
        return await this.handleOrphanedCallback(callbackData);
      }

      // Check if this is a duplicate callback (transaction already processed)
      if (this.isTransactionAlreadyProcessed(existingTransaction)) {
        return await this.handleDuplicateCallback(checkoutRequestId);
      }

      // Step 4: Process callback based on result code
      const stkCallback = callbackData.Body.stkCallback;
      const isSuccess = stkCallback.ResultCode === 0;
      
      let result: CallbackProcessingResult;
      
      if (isSuccess) {
        result = await this.processSuccessfulPayment(callbackData);
      } else {
        result = await this.processFailedPayment(callbackData);
      }

      // Step 5: Update order status if transaction processing was successful
      if (result.success && result.transactionId) {
        await this.updateOrderStatus(result.transactionId, isSuccess);
      }

      // Step 6: Log processing result
      const processingTime = Date.now() - startTime;
      await auditLogger.logCallbackProcessing(
        result.transactionId || 'unknown',
        callbackData,
        result.success ? 'success' : 'failure',
        result.error
      );

      this.logWithContext('info', 'Callback processed successfully', {
        checkoutRequestId: validation.checkoutRequestId,
        success: result.success,
        status: result.status,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log callback processing failure
      await auditLogger.logCallbackProcessing(
        'unknown',
        callbackData,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      this.logWithContext('error', 'Callback processing failed', {
        error: error instanceof Error ? error.message : error,
        processingTimeMs: processingTime,
        callbackData: JSON.stringify(callbackData)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if transaction has already been processed (to detect duplicates)
   */
  private isTransactionAlreadyProcessed(transaction: Transaction): boolean {
    const finalStatuses: TransactionStatus[] = ['completed', 'failed', 'cancelled', 'timeout'];
    return finalStatuses.includes(transaction.status);
  }

  /**
   * Update order status based on payment result
   */
  private async updateOrderStatus(transactionId: string, paymentSuccessful: boolean): Promise<void> {
    try {
      // Get the transaction to find the associated tab
      const transaction = await this.transactionService.getTransaction(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found for order status update`);
      }

      // Validate transaction before processing
      const validation = await this.orderSyncService.validateTransactionForSync(transaction);
      if (!validation.isValid) {
        this.logWithContext('error', 'Transaction validation failed for order sync', {
          transactionId,
          errors: validation.errors
        });
        return;
      }

      let syncResult;
      
      if (paymentSuccessful) {
        // Handle successful payment
        if (!transaction.mpesaReceiptNumber || !transaction.transactionDate) {
          throw new Error('Missing receipt number or transaction date for successful payment');
        }
        
        syncResult = await this.orderSyncService.updateOrderStatusForSuccessfulPayment(
          transaction,
          transaction.mpesaReceiptNumber,
          transaction.transactionDate
        );
      } else {
        // Handle failed payment
        const failureReason = transaction.failureReason || 'Payment failed';
        syncResult = await this.orderSyncService.updateOrderStatusForFailedPayment(
          transaction,
          failureReason,
          transaction.resultCode
        );
      }

      if (syncResult.success) {
        this.logWithContext('info', 'Order status updated successfully', {
          transactionId,
          tabId: transaction.tabId,
          paymentSuccessful,
          amount: transaction.amount,
          tabPaymentId: syncResult.tabPaymentId
        });

        // Get updated tab balance info for logging
        try {
          const balanceInfo = await this.orderSyncService.getTabBalanceInfo(transaction.tabId);
          this.logWithContext('info', 'Tab balance after payment', {
            tabId: transaction.tabId,
            totalOrders: balanceInfo.totalOrders,
            totalPayments: balanceInfo.totalPayments,
            remainingBalance: balanceInfo.balance,
            paymentMethods: balanceInfo.paymentMethods
          });

          // Auto-close is now handled by database trigger on tab_payments table
          // No need for application-level auto-close logic here

        } catch (balanceError) {
          // Don't fail the whole process if balance info fails
          this.logWithContext('warn', 'Failed to get tab balance info', {
            tabId: transaction.tabId,
            error: balanceError instanceof Error ? balanceError.message : balanceError
          });
        }
      } else {
        this.logWithContext('error', 'Failed to sync order status', {
          transactionId,
          tabId: transaction.tabId,
          error: syncResult.error
        });
      }
      
    } catch (error) {
      this.logWithContext('error', 'Failed to update order status', {
        transactionId,
        paymentSuccessful,
        error: error instanceof Error ? error.message : error
      });
      // Don't throw here - callback processing should still succeed even if order update fails
    }
  }

  /**
   * Validate callback structure and extract key data with enhanced security checks
   */
  validateCallback(callbackData: STKCallbackData): CallbackValidationResult {
    const errors: string[] = [];

    try {
      // Check basic structure
      if (!callbackData?.Body?.stkCallback) {
        errors.push('Missing stkCallback in callback body');
        return { isValid: false, errors };
      }

      const stkCallback = callbackData.Body.stkCallback;

      // Validate and sanitize required fields
      const validationChecks = [
        {
          field: 'MerchantRequestID',
          value: stkCallback.MerchantRequestID,
          validator: this.validateMerchantRequestId.bind(this)
        },
        {
          field: 'CheckoutRequestID',
          value: stkCallback.CheckoutRequestID,
          validator: this.validateCheckoutRequestId.bind(this)
        },
        {
          field: 'ResultCode',
          value: stkCallback.ResultCode,
          validator: this.validateResultCode.bind(this)
        },
        {
          field: 'ResultDesc',
          value: stkCallback.ResultDesc,
          validator: this.validateResultDescription.bind(this)
        }
      ];

      for (const check of validationChecks) {
        try {
          if (!check.validator(check.value)) {
            errors.push(`Invalid ${check.field}: ${check.value}`);
          }
        } catch (error) {
          errors.push(`Validation error for ${check.field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // For successful payments, validate metadata
      if (stkCallback.ResultCode === 0) {
        const metadataErrors = this.validateCallbackMetadata(stkCallback.CallbackMetadata);
        errors.push(...metadataErrors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        checkoutRequestId: stkCallback.CheckoutRequestID,
        merchantRequestId: stkCallback.MerchantRequestID
      };

    } catch (error) {
      errors.push(`Callback validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Validate MerchantRequestID format and content
   */
  private validateMerchantRequestId(merchantRequestId: any): boolean {
    if (!merchantRequestId || typeof merchantRequestId !== 'string') {
      return false;
    }

    // M-PESA MerchantRequestID format validation
    const sanitized = merchantRequestId.trim();
    
    // Should be alphanumeric with possible hyphens/underscores, reasonable length
    if (!/^[a-zA-Z0-9\-_]{10,50}$/.test(sanitized)) {
      return false;
    }

    return true;
  }

  /**
   * Validate CheckoutRequestID format and content
   */
  private validateCheckoutRequestId(checkoutRequestId: any): boolean {
    if (!checkoutRequestId || typeof checkoutRequestId !== 'string') {
      return false;
    }

    // M-PESA CheckoutRequestID format validation
    const sanitized = checkoutRequestId.trim();
    
    // Should be alphanumeric with possible hyphens/underscores, reasonable length
    if (!/^[a-zA-Z0-9\-_]{10,50}$/.test(sanitized)) {
      return false;
    }

    return true;
  }

  /**
   * Validate ResultCode
   */
  private validateResultCode(resultCode: any): boolean {
    if (typeof resultCode !== 'number') {
      return false;
    }

    // M-PESA result codes are typically in specific ranges
    // 0 = success, 1xxx = various error codes
    if (resultCode < 0 || resultCode > 9999) {
      return false;
    }

    return true;
  }

  /**
   * Validate ResultDescription
   */
  private validateResultDescription(resultDesc: any): boolean {
    if (!resultDesc || typeof resultDesc !== 'string') {
      return false;
    }

    const sanitized = resultDesc.trim();
    
    // Should not be empty and should have reasonable length
    if (sanitized.length === 0 || sanitized.length > 500) {
      return false;
    }

    // Check for potentially malicious content
    if (/<script|javascript:|data:|vbscript:/i.test(sanitized)) {
      return false;
    }

    return true;
  }

  /**
   * Validate callback metadata for successful payments
   */
  private validateCallbackMetadata(callbackMetadata: any): string[] {
    const errors: string[] = [];

    if (!callbackMetadata?.Item || !Array.isArray(callbackMetadata.Item)) {
      errors.push('Missing or invalid CallbackMetadata for successful payment');
      return errors;
    }

    const metadata = callbackMetadata.Item;
    const requiredFields = ['MpesaReceiptNumber', 'Amount', 'PhoneNumber', 'TransactionDate'];
    
    for (const field of requiredFields) {
      const item = metadata.find((item: any) => item.Name === field);
      if (!item || item.Value === null || item.Value === undefined) {
        errors.push(`Missing required metadata: ${field}`);
        continue;
      }

      // Validate specific metadata fields
      try {
        switch (field) {
          case 'MpesaReceiptNumber':
            if (!this.validateReceiptNumberValue(item.Value)) {
              errors.push(`Invalid MpesaReceiptNumber format: ${item.Value}`);
            }
            break;
          case 'Amount':
            if (!this.validateAmountValue(item.Value)) {
              errors.push(`Invalid Amount format: ${item.Value}`);
            }
            break;
          case 'PhoneNumber':
            if (!this.validatePhoneNumberValue(item.Value)) {
              errors.push(`Invalid PhoneNumber format: ${item.Value}`);
            }
            break;
          case 'TransactionDate':
            if (!this.validateTransactionDateValue(item.Value)) {
              errors.push(`Invalid TransactionDate format: ${item.Value}`);
            }
            break;
        }
      } catch (error) {
        errors.push(`Validation error for ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return errors;
  }

  /**
   * Validate receipt number value
   */
  private validateReceiptNumberValue(value: any): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const sanitized = String(value).trim();
    return /^[A-Z0-9]{8,15}$/i.test(sanitized);
  }

  /**
   * Validate amount value
   */
  private validateAmountValue(value: any): boolean {
    const numericValue = Number(value);
    return !isNaN(numericValue) && numericValue > 0 && numericValue <= 999999.99;
  }

  /**
   * Validate phone number value
   */
  private validatePhoneNumberValue(value: any): boolean {
    if (!value) return false;
    
    const sanitized = String(value).replace(/[^0-9]/g, '');
    return sanitized.startsWith('254') && sanitized.length === 12;
  }

  /**
   * Validate transaction date value
   */
  private validateTransactionDateValue(value: any): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const sanitized = String(value).replace(/[^0-9]/g, '');
    return sanitized.length === 14; // YYYYMMDDHHmmss
  }

  /**
   * Process successful payment callback
   */
  async processSuccessfulPayment(callbackData: STKCallbackData): Promise<CallbackProcessingResult> {
    try {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      // Extract payment data from callback metadata
      const paymentData = this.extractSuccessfulPaymentData(stkCallback.CallbackMetadata!);

      // Find and update transaction
      const transaction = await this.transactionService.findByCheckoutRequestId(checkoutRequestId);
      if (!transaction) {
        throw new MpesaError(`Transaction not found for checkout request ID: ${checkoutRequestId}`, 'TRANSACTION_NOT_FOUND');
      }

      // Update transaction with success data
      const updatedTransaction = await this.transactionService.updateTransactionStatus(
        transaction.id,
        'completed',
        {
          mpesaReceiptNumber: paymentData.mpesaReceiptNumber,
          transactionDate: new Date(paymentData.transactionDate),
          callbackData: callbackData,
          resultCode: stkCallback.ResultCode
        }
      );

      this.logWithContext('info', 'Successful payment processed', {
        transactionId: transaction.id,
        mpesaReceiptNumber: paymentData.mpesaReceiptNumber,
        amount: paymentData.amount,
        phoneNumber: paymentData.phoneNumber
      });

      return {
        success: true,
        transactionId: transaction.id,
        status: 'completed'
      };

    } catch (error) {
      this.handleError(error, 'Processing successful payment callback');
    }
  }

  /**
   * Process failed payment callback with enhanced error handling
   */
  async processFailedPayment(callbackData: STKCallbackData): Promise<CallbackProcessingResult> {
    try {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      // Extract and validate failure data
      const failureData = this.extractFailedPaymentData(stkCallback);

      // Find and update transaction
      const transaction = await this.transactionService.findByCheckoutRequestId(checkoutRequestId);
      if (!transaction) {
        throw new MpesaError(`Transaction not found for checkout request ID: ${checkoutRequestId}`, 'TRANSACTION_NOT_FOUND');
      }

      // Determine failure status based on result code and error category
      let status: TransactionStatus = 'failed';
      if (failureData.errorCategory === 'user_cancelled') {
        status = 'cancelled';
      } else if (failureData.errorCategory === 'timeout') {
        status = 'timeout';
      }

      // Update transaction with failure data
      const updatedTransaction = await this.transactionService.updateTransactionStatus(
        transaction.id,
        status,
        {
          failureReason: failureData.resultDesc,
          callbackData: callbackData,
          resultCode: failureData.resultCode
        }
      );

      this.logWithContext('info', 'Failed payment processed', {
        transactionId: transaction.id,
        resultCode: failureData.resultCode,
        resultDesc: failureData.resultDesc,
        errorCategory: failureData.errorCategory,
        status
      });

      return {
        success: true,
        transactionId: transaction.id,
        status
      };

    } catch (error) {
      this.handleError(error, 'Processing failed payment callback');
    }
  }

  /**
   * Extract successful payment data from callback metadata with enhanced validation and sanitization
   */
  private extractSuccessfulPaymentData(callbackMetadata: { Item: Array<{ Name: string; Value: string | number }> }): SuccessfulPaymentData {
    const data: Partial<SuccessfulPaymentData> = {};

    for (const item of callbackMetadata.Item) {
      switch (item.Name) {
        case 'MpesaReceiptNumber':
          data.mpesaReceiptNumber = this.sanitizeReceiptNumber(String(item.Value));
          break;
        case 'TransactionDate':
          data.transactionDate = this.sanitizeTransactionDate(String(item.Value));
          break;
        case 'Amount':
          data.amount = this.sanitizeAmount(item.Value);
          break;
        case 'PhoneNumber':
          data.phoneNumber = this.sanitizePhoneNumber(String(item.Value));
          break;
      }
    }

    // Validate required fields
    if (!data.mpesaReceiptNumber || !data.transactionDate || !data.amount || !data.phoneNumber) {
      throw new MpesaValidationError('Incomplete payment data in callback', [
        'Missing required fields in callback metadata'
      ]);
    }

    // Additional validation
    this.validateExtractedPaymentData(data as SuccessfulPaymentData);

    return data as SuccessfulPaymentData;
  }

  /**
   * Sanitize M-PESA receipt number
   */
  private sanitizeReceiptNumber(receiptNumber: string): string {
    // Remove any non-alphanumeric characters except allowed ones
    const sanitized = receiptNumber.replace(/[^A-Z0-9]/gi, '');
    
    if (sanitized.length < 8 || sanitized.length > 15) {
      throw new MpesaValidationError('Invalid receipt number format', [
        `Receipt number length must be between 8-15 characters, got ${sanitized.length}`
      ]);
    }

    return sanitized;
  }

  /**
   * Sanitize transaction date
   */
  private sanitizeTransactionDate(dateString: string): string {
    // M-PESA date format: YYYYMMDDHHmmss
    const sanitized = dateString.replace(/[^0-9]/g, '');
    
    if (sanitized.length !== 14) {
      throw new MpesaValidationError('Invalid transaction date format', [
        `Expected YYYYMMDDHHmmss format, got ${dateString}`
      ]);
    }

    // Validate date components
    const year = parseInt(sanitized.substring(0, 4));
    const month = parseInt(sanitized.substring(4, 6));
    const day = parseInt(sanitized.substring(6, 8));
    const hour = parseInt(sanitized.substring(8, 10));
    const minute = parseInt(sanitized.substring(10, 12));
    const second = parseInt(sanitized.substring(12, 14));

    if (year < 2020 || year > 2030) {
      throw new MpesaValidationError('Invalid transaction year', [`Year ${year} is out of valid range`]);
    }

    if (month < 1 || month > 12) {
      throw new MpesaValidationError('Invalid transaction month', [`Month ${month} is invalid`]);
    }

    if (day < 1 || day > 31) {
      throw new MpesaValidationError('Invalid transaction day', [`Day ${day} is invalid`]);
    }

    if (hour > 23 || minute > 59 || second > 59) {
      throw new MpesaValidationError('Invalid transaction time', [`Time ${hour}:${minute}:${second} is invalid`]);
    }

    return sanitized;
  }

  /**
   * Sanitize amount value
   */
  private sanitizeAmount(amount: string | number): number {
    let numericAmount: number;

    if (typeof amount === 'string') {
      // Remove any non-numeric characters except decimal point
      const sanitized = amount.replace(/[^0-9.]/g, '');
      numericAmount = parseFloat(sanitized);
    } else {
      numericAmount = Number(amount);
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new MpesaValidationError('Invalid amount', [`Amount must be a positive number, got ${amount}`]);
    }

    if (numericAmount > 999999.99) {
      throw new MpesaValidationError('Amount too large', [`Amount ${numericAmount} exceeds maximum allowed`]);
    }

    // Round to 2 decimal places
    return Math.round(numericAmount * 100) / 100;
  }

  /**
   * Sanitize phone number
   */
  private sanitizePhoneNumber(phoneNumber: string): string {
    // Remove any non-numeric characters
    const sanitized = phoneNumber.replace(/[^0-9]/g, '');
    
    // Validate Kenyan phone number format
    if (!sanitized.startsWith('254') || sanitized.length !== 12) {
      throw new MpesaValidationError('Invalid phone number format', [
        `Phone number must be in format 254XXXXXXXXX, got ${phoneNumber}`
      ]);
    }

    return sanitized;
  }

  /**
   * Validate extracted payment data for consistency
   */
  private validateExtractedPaymentData(data: SuccessfulPaymentData): void {
    // Cross-validate amount format
    const amountStr = data.amount.toString();
    if (amountStr.includes('.') && amountStr.split('.')[1].length > 2) {
      throw new MpesaValidationError('Amount precision error', [
        `Amount has more than 2 decimal places: ${data.amount}`
      ]);
    }

    // Validate receipt number pattern (M-PESA receipts typically start with certain patterns)
    if (!/^[A-Z0-9]{8,15}$/i.test(data.mpesaReceiptNumber)) {
      throw new MpesaValidationError('Invalid receipt number pattern', [
        `Receipt number ${data.mpesaReceiptNumber} doesn't match expected pattern`
      ]);
    }

    // Validate transaction date is not in the future
    const transactionDate = this.parseTransactionDate(data.transactionDate);
    const now = new Date();
    if (transactionDate > now) {
      throw new MpesaValidationError('Future transaction date', [
        `Transaction date ${data.transactionDate} is in the future`
      ]);
    }

    // Validate transaction date is not too old (more than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    if (transactionDate < thirtyDaysAgo) {
      this.logWithContext('warn', 'Old transaction date detected', {
        transactionDate: data.transactionDate,
        receiptNumber: data.mpesaReceiptNumber
      });
    }
  }

  /**
   * Parse M-PESA transaction date string to Date object
   */
  private parseTransactionDate(dateString: string): Date {
    // Format: YYYYMMDDHHmmss
    const year = parseInt(dateString.substring(0, 4));
    const month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateString.substring(6, 8));
    const hour = parseInt(dateString.substring(8, 10));
    const minute = parseInt(dateString.substring(10, 12));
    const second = parseInt(dateString.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Extract and validate failed payment data with enhanced error code mapping
   */
  private extractFailedPaymentData(stkCallback: any): FailedPaymentData & { errorCategory: string } {
    const resultCode = stkCallback.ResultCode;
    const resultDesc = this.sanitizeErrorDescription(stkCallback.ResultDesc);

    // Map M-PESA error codes to categories for better handling
    const errorCategory = this.categorizeErrorCode(resultCode);

    return {
      resultCode,
      resultDesc,
      errorCategory
    };
  }

  /**
   * Sanitize error description to prevent injection attacks
   */
  private sanitizeErrorDescription(description: string): string {
    if (!description || typeof description !== 'string') {
      return 'Unknown error';
    }

    // Remove potentially dangerous characters and limit length
    const sanitized = description
      .replace(/[<>\"'&]/g, '') // Remove HTML/script injection characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length

    return sanitized || 'Unknown error';
  }

  /**
   * Categorize M-PESA error codes for better error handling
   */
  private categorizeErrorCode(resultCode: number): string {
    const errorCategories: Record<number, string> = {
      0: 'success',
      1: 'insufficient_funds',
      1032: 'user_cancelled',
      1037: 'timeout',
      2001: 'invalid_initiator',
      // Add more error codes as needed
    };

    return errorCategories[resultCode] || 'unknown_error';
  }

  /**
   * Handle duplicate callbacks (idempotent processing)
   */
  async handleDuplicateCallback(checkoutRequestId: string): Promise<CallbackProcessingResult> {
    try {
      const transaction = await this.transactionService.findByCheckoutRequestId(checkoutRequestId);
      
      if (!transaction) {
        throw new MpesaError(`Transaction not found for duplicate callback: ${checkoutRequestId}`, 'TRANSACTION_NOT_FOUND');
      }

      this.logWithContext('info', 'Duplicate callback detected - returning existing status', {
        transactionId: transaction.id,
        checkoutRequestId,
        currentStatus: transaction.status,
        mpesaReceiptNumber: transaction.mpesaReceiptNumber
      });

      // Return the existing transaction status without processing again
      return {
        success: true,
        transactionId: transaction.id,
        status: transaction.status
      };

    } catch (error) {
      this.handleError(error, 'Handling duplicate callback');
    }
  }

  /**
   * Handle orphaned callbacks (callbacks without matching transactions)
   */
  async handleOrphanedCallback(callbackData: STKCallbackData): Promise<CallbackProcessingResult> {
    const stkCallback = callbackData.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    
    this.logWithContext('warn', 'Orphaned callback detected - no matching transaction found', {
      checkoutRequestId,
      merchantRequestId,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc
    });

    // Store orphaned callback for manual review and debugging
    await this.storeOrphanedCallback(callbackData);

    // Check if this might be a very delayed callback for an old transaction
    const possibleReasons = await this.analyzeOrphanedCallback(callbackData);
    
    this.logWithContext('info', 'Orphaned callback analysis', {
      checkoutRequestId,
      possibleReasons
    });

    return {
      success: false,
      error: 'No matching transaction found for callback'
    };
  }

  /**
   * Store orphaned callback for manual review
   */
  private async storeOrphanedCallback(callbackData: STKCallbackData): Promise<void> {
    try {
      // This could be implemented as a separate table or logging mechanism
      // For now, we'll use enhanced logging
      this.logWithContext('warn', 'ORPHANED_CALLBACK_STORED', {
        timestamp: new Date().toISOString(),
        checkoutRequestId: callbackData.Body.stkCallback.CheckoutRequestID,
        merchantRequestId: callbackData.Body.stkCallback.MerchantRequestID,
        resultCode: callbackData.Body.stkCallback.ResultCode,
        resultDesc: callbackData.Body.stkCallback.ResultDesc,
        fullCallbackData: JSON.stringify(callbackData)
      });

      // In a production system, you might want to:
      // 1. Store in a separate orphaned_callbacks table
      // 2. Send alerts to administrators
      // 3. Queue for manual review
      
    } catch (error) {
      this.logWithContext('error', 'Failed to store orphaned callback', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Analyze orphaned callback to determine possible causes
   */
  private async analyzeOrphanedCallback(callbackData: STKCallbackData): Promise<string[]> {
    const reasons: string[] = [];
    const stkCallback = callbackData.Body.stkCallback;
    
    try {
      // Check if there are any transactions with similar checkout request IDs (typos, etc.)
      const similarTransactions = await this.findSimilarTransactions(stkCallback.CheckoutRequestID);
      if (similarTransactions.length > 0) {
        reasons.push(`Found ${similarTransactions.length} transactions with similar checkout request IDs`);
      }

      // Check if this is a very old callback
      if (stkCallback.CallbackMetadata?.Item) {
        const transactionDateItem = stkCallback.CallbackMetadata.Item.find(item => item.Name === 'TransactionDate');
        if (transactionDateItem) {
          const transactionDate = this.parseTransactionDate(String(transactionDateItem.Value));
          const now = new Date();
          const ageInHours = (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60);
          
          if (ageInHours > 24) {
            reasons.push(`Callback is ${Math.round(ageInHours)} hours old`);
          }
        }
      }

      // Check if this is from a different environment
      const currentEnv = this.config.environment;
      reasons.push(`Current environment: ${currentEnv}`);

      // Check result code patterns
      if (stkCallback.ResultCode === 0) {
        reasons.push('Successful payment callback without matching transaction - possible system issue');
      } else {
        reasons.push(`Failed payment callback (${stkCallback.ResultCode}) - transaction may have been cleaned up`);
      }

    } catch (error) {
      reasons.push(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return reasons;
  }

  /**
   * Find transactions with similar checkout request IDs (for debugging orphaned callbacks)
   */
  private async findSimilarTransactions(checkoutRequestId: string): Promise<Transaction[]> {
    try {
      // This is a simplified implementation - in practice, you might want more sophisticated matching
      const recentTransactions = await this.transactionService.getRecentTransactions(100);
      
      return recentTransactions.filter(transaction => {
        if (!transaction.checkoutRequestId) return false;
        
        // Check for similar patterns (same length, similar characters, etc.)
        const similarity = this.calculateStringSimilarity(checkoutRequestId, transaction.checkoutRequestId);
        return similarity > 0.8; // 80% similarity threshold
      });
      
    } catch (error) {
      this.logWithContext('error', 'Failed to find similar transactions', {
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Calculate string similarity (simple Levenshtein-based approach)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Process tab auto-close after successful payment
   * Checks if overdue tab is paid in full and auto-closes it
   */
  private async processTabAutoClose(tabId: string, paymentAmount: number): Promise<void> {
    try {
      this.logWithContext('info', 'Processing tab auto-close after payment', {
        tabId,
        paymentAmount
      });

      const autoCloseResult = await this.tabAutoCloseService.processTabAfterPayment(tabId, paymentAmount);

      if (autoCloseResult.success) {
        this.logWithContext('info', 'Tab auto-close processing completed', {
          tabId,
          tabClosed: autoCloseResult.tabClosed,
          shouldCreateNewTab: autoCloseResult.shouldCreateNewTab,
          message: autoCloseResult.message
        });

        // If tab was auto-closed, we could trigger additional notifications here
        if (autoCloseResult.tabClosed) {
          // TODO: Send notification to customer app about tab closure
          // TODO: Send notification to staff app about auto-closure
          this.logWithContext('info', 'Overdue tab auto-closed after full payment', {
            tabId,
            shouldOfferNewTab: autoCloseResult.shouldCreateNewTab
          });
        }
      } else {
        this.logWithContext('warn', 'Tab auto-close processing failed', {
          tabId,
          error: autoCloseResult.error,
          message: autoCloseResult.message
        });
      }

    } catch (error) {
      // Don't fail the callback processing if auto-close fails
      this.logWithContext('error', 'Error in tab auto-close processing', {
        tabId,
        paymentAmount,
        error: error instanceof Error ? error.message : error
      });
    }
  }
}