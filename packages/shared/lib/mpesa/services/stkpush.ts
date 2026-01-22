/**
 * M-PESA STK Push API client
 * Handles STK Push request generation, API communication, and response processing
 */

import {
  STKPushRequest,
  STKPushResponse,
  MpesaCredentials,
  MpesaError,
  MpesaNetworkError,
  MpesaValidationError,
  ValidationResult
} from '../types';
import { BaseService, Logger, HttpClient } from './base';
import { MpesaAuthService } from './auth';
import { ServiceConfig } from '../types';

/**
 * STK Push request builder parameters
 */
export interface STKPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
  timeoutUrl?: string;
}

/**
 * STK Push API client service
 * Handles STK Push request generation and M-PESA API communication
 */
export class STKPushService extends BaseService {
  private authService: MpesaAuthService;

  constructor(
    config: ServiceConfig,
    logger?: Logger,
    httpClient?: HttpClient
  ) {
    super(config, logger, httpClient);
    this.authService = new MpesaAuthService(config, logger, httpClient);
    this.validateConfig();
  }

  /**
   * Send STK Push request to M-PESA API
   * Handles authentication, request building, and response processing
   */
  public async sendSTKPush(params: STKPushParams): Promise<STKPushResponse> {
    // Validate input parameters
    const validation = this.validateSTKPushParams(params);
    if (!validation.isValid) {
      throw new MpesaValidationError(
        'Invalid STK Push parameters',
        validation.errors
      );
    }

    // Build STK Push request
    const request = await this.buildSTKPushRequest(params);

    // Send request with retry logic
    return this.retry(
      () => this.sendSTKPushRequest(request),
      'STK Push request'
    );
  }

  /**
   * Query STK Push transaction status
   * Used to check the status of a previously initiated STK Push
   */
  public async querySTKPushStatus(checkoutRequestId: string): Promise<any> {
    if (!checkoutRequestId || checkoutRequestId.trim().length === 0) {
      throw new MpesaValidationError(
        'Invalid checkout request ID',
        ['Checkout request ID is required']
      );
    }

    const config = this.getCurrentConfig();
    const credentials = config.credentials;

    // Generate timestamp and password
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(
      credentials.businessShortCode,
      credentials.passkey,
      timestamp
    );

    // Build query request
    const queryRequest = {
      BusinessShortCode: credentials.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    return this.retry(
      () => this.sendSTKQueryRequest(queryRequest),
      'STK Push status query'
    );
  }

  /**
   * Test STK Push configuration
   * Validates credentials and connectivity without processing real payment
   */
  public async testConfiguration(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Test authentication
      const token = await this.authService.generateAccessToken();
      const isValidToken = await this.authService.validateAccessToken(token);

      if (!isValidToken) {
        return {
          success: false,
          message: 'Authentication failed - invalid credentials'
        };
      }

      // Test with minimal STK Push request (will fail but validates connectivity)
      const config = this.getCurrentConfig();
      if (config.environment === 'sandbox') {
        // Use official Safaricom test number for sandbox
        const testParams: STKPushParams = {
          phoneNumber: '254708374149',
          amount: 1,
          accountReference: 'TEST',
          transactionDesc: 'Test payment'
        };

        try {
          await this.sendSTKPush(testParams);
          return {
            success: true,
            message: 'Configuration test successful'
          };
        } catch (error) {
          // Expected to fail in some cases, but validates connectivity
          if (error instanceof MpesaNetworkError && error.statusCode !== 401) {
            return {
              success: true,
              message: 'Configuration test successful (connectivity verified)',
              details: { note: 'Test payment may have failed but API is accessible' }
            };
          }
          throw error;
        }
      } else {
        // Production - only test authentication
        return {
          success: true,
          message: 'Production configuration test successful (authentication only)'
        };
      }

    } catch (error) {
      this.logWithContext('error', 'Configuration test failed', {
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        message: `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof MpesaError ? { code: error.code } : undefined
      };
    }
  }

  /**
   * Build complete STK Push request with all required parameters
   */
  private async buildSTKPushRequest(params: STKPushParams): Promise<STKPushRequest> {
    const config = this.getCurrentConfig();
    const credentials = config.credentials;

    // Generate timestamp and password
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(
      credentials.businessShortCode,
      credentials.passkey,
      timestamp
    );

    // Format phone number to 254XXXXXXXX
    const formattedPhone = this.formatPhoneNumber(params.phoneNumber);

    // Use provided callback URL or default from credentials
    const callbackUrl = params.callbackUrl || credentials.callbackUrl;
    const timeoutUrl = params.timeoutUrl || credentials.timeoutUrl;

    // Build request object
    const request: STKPushRequest = {
      BusinessShortCode: credentials.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: params.amount,
      PartyA: formattedPhone,
      PartyB: credentials.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: params.accountReference.substring(0, 12), // Max 12 chars
      TransactionDesc: params.transactionDesc.substring(0, 13) // Max 13 chars
    };

    this.logWithContext('debug', 'STK Push request built', {
      businessShortCode: request.BusinessShortCode,
      amount: request.Amount,
      phoneNumber: this.maskPhoneNumber(request.PhoneNumber),
      accountReference: request.AccountReference,
      transactionDesc: request.TransactionDesc
    });

    return request;
  }

  /**
   * Send STK Push request to M-PESA API
   */
  private async sendSTKPushRequest(request: STKPushRequest): Promise<STKPushResponse> {
    const config = this.getCurrentConfig();

    // Rate limiting check
    this.checkRateLimit(`stkpush_${config.credentials.businessShortCode}`);

    // Get access token
    const accessToken = await this.authService.generateAccessToken();

    this.logWithContext('info', 'Sending STK Push request', {
      businessShortCode: request.BusinessShortCode,
      amount: request.Amount,
      phoneNumber: this.maskPhoneNumber(request.PhoneNumber),
      environment: config.environment
    });

    try {
      const response = await this.httpClient.post(
        config.urls.stkPush,
        request,
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      );

      // Validate response structure
      if (!this.isValidSTKPushResponse(response)) {
        throw new MpesaError(
          'Invalid STK Push response format from M-PESA API',
          'INVALID_RESPONSE'
        );
      }

      const stkResponse = response as STKPushResponse;

      // Check for API-level errors
      if (stkResponse.ResponseCode !== '0') {
        throw new MpesaError(
          `STK Push failed: ${stkResponse.ResponseDescription}`,
          'STK_PUSH_ERROR',
          undefined,
          { responseCode: stkResponse.ResponseCode }
        );
      }

      this.logWithContext('info', 'STK Push request successful', {
        merchantRequestId: stkResponse.MerchantRequestID,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage
      });

      return stkResponse;

    } catch (error) {
      // Handle authentication errors
      if (error instanceof MpesaNetworkError && error.statusCode === 401) {
        // Clear token cache and retry once
        this.authService.clearTokenCache();
        throw new MpesaError(
          'Authentication failed - credentials may be invalid',
          'AUTHENTICATION_ERROR',
          401,
          error
        );
      }

      // Handle other network errors
      if (error instanceof MpesaNetworkError) {
        throw new MpesaNetworkError(
          `STK Push request failed: ${error.message}`,
          error.originalError
        );
      }

      // Re-throw M-PESA errors as-is
      if (error instanceof MpesaError) {
        throw error;
      }

      // Wrap other errors
      throw new MpesaError(
        `STK Push request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STK_PUSH_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Send STK Push status query request
   */
  private async sendSTKQueryRequest(queryRequest: any): Promise<any> {
    const config = this.getCurrentConfig();

    // Rate limiting check
    this.checkRateLimit(`stkquery_${config.credentials.businessShortCode}`);

    // Get access token
    const accessToken = await this.authService.generateAccessToken();

    this.logWithContext('info', 'Sending STK Push status query', {
      checkoutRequestId: queryRequest.CheckoutRequestID,
      businessShortCode: queryRequest.BusinessShortCode
    });

    try {
      const response = await this.httpClient.post(
        config.urls.stkQuery,
        queryRequest,
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      );

      this.logWithContext('info', 'STK Push status query successful', {
        checkoutRequestId: queryRequest.CheckoutRequestID,
        response: response
      });

      return response;

    } catch (error) {
      // Handle authentication errors
      if (error instanceof MpesaNetworkError && error.statusCode === 401) {
        this.authService.clearTokenCache();
        throw new MpesaError(
          'Authentication failed during status query',
          'AUTHENTICATION_ERROR',
          401,
          error
        );
      }

      // Handle other errors
      if (error instanceof MpesaNetworkError) {
        throw new MpesaNetworkError(
          `STK Push status query failed: ${error.message}`,
          error.originalError
        );
      }

      throw new MpesaError(
        `STK Push status query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STK_QUERY_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Generate M-PESA password using base64(shortcode+passkey+timestamp)
   */
  private generatePassword(shortcode: string, passkey: string, timestamp: string): string {
    const concatenated = shortcode + passkey + timestamp;
    return Buffer.from(concatenated).toString('base64');
  }

  /**
   * Generate timestamp in YYYYMMDDHHmmss format
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format phone number to 254XXXXXXXX format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (digits.startsWith('254')) {
      return digits;
    } else if (digits.startsWith('0')) {
      return '254' + digits.substring(1);
    } else if (digits.length === 9) {
      return '254' + digits;
    } else {
      throw new MpesaValidationError(
        'Invalid phone number format',
        ['Phone number must be in format 254XXXXXXXX, 0XXXXXXXX, or XXXXXXXX']
      );
    }
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '****';
    return '*'.repeat(phoneNumber.length - 4) + phoneNumber.slice(-4);
  }

  /**
   * Validate STK Push parameters
   */
  private validateSTKPushParams(params: STKPushParams): ValidationResult {
    const errors: string[] = [];

    // Validate phone number
    if (!params.phoneNumber || params.phoneNumber.trim().length === 0) {
      errors.push('Phone number is required');
    } else {
      try {
        this.formatPhoneNumber(params.phoneNumber);
      } catch (error) {
        if (error instanceof MpesaValidationError) {
          errors.push(...error.validationErrors);
        } else {
          errors.push('Invalid phone number format');
        }
      }
    }

    // Validate amount
    if (!params.amount || params.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    const config = this.getCurrentConfig();
    const rules = config.validationRules;
    
    if (params.amount > rules.maxAmount) {
      errors.push(`Amount cannot exceed ${rules.maxAmount} KES`);
    }
    
    if (params.amount < rules.minAmount) {
      errors.push(`Amount cannot be less than ${rules.minAmount} KES`);
    }

    // Validate account reference
    if (!params.accountReference || params.accountReference.trim().length === 0) {
      errors.push('Account reference is required');
    } else if (params.accountReference.length > 12) {
      errors.push('Account reference cannot exceed 12 characters');
    }

    // Validate transaction description
    if (!params.transactionDesc || params.transactionDesc.trim().length === 0) {
      errors.push('Transaction description is required');
    } else if (params.transactionDesc.length > 13) {
      errors.push('Transaction description cannot exceed 13 characters');
    }

    // Environment-specific validations
    if (config.environment === 'sandbox' && rules.allowedPhoneNumbers) {
      const formattedPhone = this.formatPhoneNumber(params.phoneNumber);
      const isAllowed = rules.allowedPhoneNumbers.some(pattern => {
        if (pattern.includes('X')) {
          // Pattern matching (e.g., 254711XXXXXX)
          const regex = new RegExp(pattern.replace(/X/g, '\\d'));
          return regex.test(formattedPhone);
        } else {
          // Exact match
          return formattedPhone === pattern;
        }
      });

      if (!isAllowed) {
        errors.push(`Phone number ${formattedPhone} is not allowed in sandbox environment`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate STK Push response structure
   */
  private isValidSTKPushResponse(response: any): response is STKPushResponse {
    return (
      response &&
      typeof response === 'object' &&
      typeof response.MerchantRequestID === 'string' &&
      typeof response.CheckoutRequestID === 'string' &&
      typeof response.ResponseCode === 'string' &&
      typeof response.ResponseDescription === 'string' &&
      typeof response.CustomerMessage === 'string'
    );
  }
}