/**
 * Simple M-Pesa STK Push Service
 * Handles sending STK Push requests to Safaricom API with proper formatting and error handling
 * Requirements: 2.1, 8.5
 */

import { getOAuthToken, MpesaOAuthError } from './mpesa-oauth';
import { type MpesaConfig } from './mpesa-config';
import { validateKenyanPhoneNumber } from './phoneValidation';

export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface STKPushResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
}

export interface STKPushErrorResponse {
  ResponseCode: string;
  ResponseDescription: string;
  errorCode?: string;
  errorMessage?: string;
}

export class STKPushError extends Error {
  constructor(
    message: string,
    public responseCode?: string,
    public responseDescription?: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'STKPushError';
  }
}

/**
 * Send STK Push request to Safaricom API
 * Requirement 2.1: WHEN a customer enters a valid phone number and amount, THE System SHALL initiate an STK Push request to Safaricom
 * Requirement 8.5: THE System SHALL retry failed API calls up to 3 times with exponential backoff
 */
export async function sendSTKPush(request: STKPushRequest, config: MpesaConfig): Promise<STKPushResponse> {
  // Check if mock mode is enabled
  if (process.env.MPESA_MOCK_MODE === 'true') {
    console.log('🧪 M-Pesa Mock Mode: Simulating STK Push request');
    
    // Validate inputs even in mock mode
    validateSTKPushRequest(request);
    
    // Normalize phone number
    const phoneValidation = validateKenyanPhoneNumber(request.phoneNumber);
    if (!phoneValidation.isValid) {
      throw new STKPushError(`Invalid phone number: ${phoneValidation.error}`);
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock successful response
    const mockResponse: STKPushResponse = {
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      MerchantRequestID: `mock_merchant_${Date.now()}`,
      CheckoutRequestID: `mock_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    console.log('🧪 Mock STK Push successful:', mockResponse);
    return mockResponse;
  }

  // Validate inputs
  validateSTKPushRequest(request);
  
  // Normalize phone number
  const phoneValidation = validateKenyanPhoneNumber(request.phoneNumber);
  if (!phoneValidation.isValid) {
    throw new STKPushError(`Invalid phone number: ${phoneValidation.error}`);
  }
  
  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await attemptSTKPush(request, phoneValidation.normalized!, config);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors or client errors (4xx)
      if (error instanceof STKPushError) {
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        // Don't retry on Safaricom API errors (ResponseCode !== '0')
        if (error.responseCode && error.responseCode !== '0') {
          throw error;
        }
        // Don't retry on invalid response format errors
        if (error.message.includes('Invalid STK Push response format')) {
          throw error;
        }
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // All retries failed - wrap the last error appropriately
  if (lastError instanceof TypeError && lastError.message.includes('Failed to fetch')) {
    throw new STKPushError(
      `Network error: STK Push failed after ${maxRetries} attempts`,
      undefined,
      undefined,
      undefined,
      lastError
    );
  }
  
  throw new STKPushError(
    `STK Push failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    undefined,
    undefined,
    undefined,
    lastError
  );
}

/**
 * Attempt a single STK Push request
 */
async function attemptSTKPush(
  request: STKPushRequest,
  normalizedPhone: string,
  config: MpesaConfig
): Promise<STKPushResponse> {
  try {
    // Get OAuth token
    const accessToken = await getOAuthToken(config);
    
    // Generate password and timestamp
    const timestamp = generateTimestamp();
    const password = generatePassword(config.businessShortcode, config.passkey, timestamp);
    
    // Prepare STK Push payload
    const payload = {
      BusinessShortCode: config.businessShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(request.amount), // Ensure integer amount
      PartyA: normalizedPhone,
      PartyB: config.businessShortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: config.callbackUrl,
      AccountReference: request.accountReference,
      TransactionDesc: request.transactionDesc
    };
    
    // Make STK Push request
    const response = await fetch(config.stkPushUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      let errorData: STKPushErrorResponse | null = null;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Response is not JSON
      }
      
      throw new STKPushError(
        `STK Push request failed: ${response.status} ${response.statusText}`,
        errorData?.ResponseCode,
        errorData?.ResponseDescription || errorText,
        response.status,
        errorData
      );
    }
    
    const responseData = await response.json() as any;
    
    // Validate response format
    if (!responseData.ResponseCode || !responseData.CheckoutRequestID) {
      throw new STKPushError(
        'Invalid STK Push response format from Safaricom API',
        responseData.ResponseCode,
        responseData.ResponseDescription,
        undefined,
        responseData
      );
    }
    
    // Check if the response indicates an error
    if (responseData.ResponseCode !== '0') {
      throw new STKPushError(
        `STK Push rejected by Safaricom: ${responseData.ResponseDescription}`,
        responseData.ResponseCode,
        responseData.ResponseDescription,
        undefined,
        responseData
      );
    }
    
    return responseData as STKPushResponse;
    
  } catch (error) {
    // Handle network errors - these should be retried
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw error; // Let the retry logic handle this
    }
    
    // Handle OAuth errors
    if (error instanceof MpesaOAuthError) {
      throw new STKPushError(
        `Authentication failed: ${error.message}`,
        undefined,
        undefined,
        error.statusCode,
        error
      );
    }
    
    // Re-throw STKPushError as-is
    if (error instanceof STKPushError) {
      throw error;
    }
    
    // Wrap other errors
    throw new STKPushError(
      `STK Push request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      undefined,
      error
    );
  }
}

/**
 * Validate STK Push request parameters
 */
function validateSTKPushRequest(request: STKPushRequest): void {
  const errors: string[] = [];
  
  if (!request.phoneNumber || typeof request.phoneNumber !== 'string') {
    errors.push('Phone number is required');
  }
  
  if (!request.amount || typeof request.amount !== 'number' || request.amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  if (request.amount > 999999) {
    errors.push('Amount cannot exceed 999,999 KES');
  }
  
  if (!request.accountReference || typeof request.accountReference !== 'string') {
    errors.push('Account reference is required');
  }
  
  if (request.accountReference.length > 12) {
    errors.push('Account reference cannot exceed 12 characters');
  }
  
  if (!request.transactionDesc || typeof request.transactionDesc !== 'string') {
    errors.push('Transaction description is required');
  }
  
  if (request.transactionDesc.length > 13) {
    errors.push('Transaction description cannot exceed 13 characters');
  }
  
  if (errors.length > 0) {
    throw new STKPushError(`Invalid STK Push request: ${errors.join(', ')}`);
  }
}

/**
 * Generate timestamp in the format required by Safaricom API
 * Format: YYYYMMDDHHMMSS
 */
function generateTimestamp(): string {
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
 * Generate password for STK Push request
 * Password = Base64(BusinessShortCode + Passkey + Timestamp)
 */
function generatePassword(businessShortcode: string, passkey: string, timestamp: string): string {
  const concatenated = `${businessShortcode}${passkey}${timestamp}`;
  return Buffer.from(concatenated).toString('base64');
}

/**
 * Utility function to check if an error is retryable
 * Used internally for retry logic
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true;
  }
  
  // Server errors (5xx) are retryable
  if (error instanceof STKPushError && error.statusCode && error.statusCode >= 500) {
    return true;
  }
  
  // OAuth errors might be retryable (token might have expired)
  if (error instanceof MpesaOAuthError) {
    return true;
  }
  
  // STK Push errors with response codes (Safaricom API errors) are not retryable
  if (error instanceof STKPushError && error.responseCode) {
    return false;
  }
  
  // Client errors (4xx) are not retryable
  if (error instanceof STKPushError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  
  // Unknown errors are not retryable by default (changed from true to false for safety)
  return false;
}

/**
 * Get STK Push service statistics (useful for monitoring)
 */
export interface STKPushStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

// Simple in-memory statistics (reset on service restart)
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
};

/**
 * Get STK Push service statistics
 */
export function getSTKPushStats(): STKPushStats {
  return {
    totalRequests: stats.totalRequests,
    successfulRequests: stats.successfulRequests,
    failedRequests: stats.failedRequests,
    averageResponseTime: stats.totalRequests > 0 ? stats.totalResponseTime / stats.totalRequests : 0,
  };
}

/**
 * Reset STK Push service statistics
 */
export function resetSTKPushStats(): void {
  stats.totalRequests = 0;
  stats.successfulRequests = 0;
  stats.failedRequests = 0;
  stats.totalResponseTime = 0;
}

/**
 * Wrapper function that includes statistics tracking
 */
export async function sendSTKPushWithStats(request: STKPushRequest, config: MpesaConfig): Promise<STKPushResponse> {
  const startTime = Date.now();
  stats.totalRequests++;
  
  try {
    const result = await sendSTKPush(request, config);
    stats.successfulRequests++;
    return result;
  } catch (error) {
    stats.failedRequests++;
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;
    stats.totalResponseTime += responseTime;
  }
}