/**
 * M-Pesa STK Push Query Service
 * Checks the status of STK Push payments using Daraja API
 */

import { getOAuthToken, MpesaOAuthError } from './mpesa-oauth';
import { type MpesaConfig } from './mpesa-config';

export interface STKQueryRequest {
  checkoutRequestId: string;
}

export interface STKQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

export class STKQueryError extends Error {
  constructor(
    message: string,
    public responseCode?: string,
    public responseDescription?: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'STKQueryError';
  }
}

/**
 * Query STK Push payment status from Safaricom API
 */
export async function querySTKPushStatus(request: STKQueryRequest, config: MpesaConfig): Promise<STKQueryResponse> {
  try {
    // Get OAuth token
    const accessToken = await getOAuthToken(config);
    
    // Generate password and timestamp
    const timestamp = generateTimestamp();
    const password = generatePassword(config.businessShortcode, config.passkey, timestamp);
    
    // Prepare STK Query payload
    const payload = {
      BusinessShortCode: config.businessShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: request.checkoutRequestId
    };
    
    // Get query URL
    const queryUrl = getQueryUrl(config.environment);
    
    // Make STK Query request
    const response = await fetch(queryUrl, {
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
      let errorData: any = null;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Response is not JSON
      }
      
      throw new STKQueryError(
        `STK Query request failed: ${response.status} ${response.statusText}`,
        errorData?.ResponseCode,
        errorData?.ResponseDescription || errorText,
        response.status,
        errorData
      );
    }
    
    const responseData = await response.json() as any;
    
    // Validate response format
    if (!responseData.ResponseCode || !responseData.CheckoutRequestID) {
      throw new STKQueryError(
        'Invalid STK Query response format from Safaricom API',
        responseData.ResponseCode,
        responseData.ResponseDescription,
        undefined,
        responseData
      );
    }
    
    return responseData as STKQueryResponse;
    
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new STKQueryError('Network error: Failed to query payment status');
    }
    
    // Handle OAuth errors
    if (error instanceof MpesaOAuthError) {
      throw new STKQueryError(
        `Authentication failed: ${error.message}`,
        undefined,
        undefined,
        error.statusCode,
        error
      );
    }
    
    // Re-throw STKQueryError as-is
    if (error instanceof STKQueryError) {
      throw error;
    }
    
    // Wrap other errors
    throw new STKQueryError(
      `STK Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      undefined,
      error
    );
  }
}

/**
 * Generate timestamp in the format required by Safaricom API
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
 * Generate password for STK Query request
 */
function generatePassword(businessShortcode: string, passkey: string, timestamp: string): string {
  const concatenated = `${businessShortcode}${passkey}${timestamp}`;
  return Buffer.from(concatenated).toString('base64');
}

/**
 * Get environment-specific query URL
 */
function getQueryUrl(environment: 'sandbox' | 'production'): string {
  const baseUrl = environment === 'sandbox' 
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';

  return `${baseUrl}/mpesa/stkpushquery/v1/query`;
}

/**
 * Add query URL to config for easy access
 */
export function getSTKQueryUrl(environment: 'sandbox' | 'production'): string {
  return getQueryUrl(environment);
}

/**
 * Parse STK Query result into payment status
 */
export function parsePaymentStatus(queryResponse: STKQueryResponse): {
  status: 'completed' | 'failed' | 'cancelled' | 'pending';
  message: string;
} {
  // Check if query was successful
  if (queryResponse.ResponseCode !== '0') {
    return {
      status: 'failed',
      message: queryResponse.ResponseDescription || 'Query failed'
    };
  }

  // Parse result code
  switch (queryResponse.ResultCode) {
    case '0':
      return {
        status: 'completed',
        message: 'Payment completed successfully'
      };
    case '1032':
      return {
        status: 'cancelled',
        message: 'Payment cancelled by user'
      };
    case '1037':
      return {
        status: 'failed',
        message: 'Payment timeout - no response from user'
      };
    case '1':
      return {
        status: 'failed',
        message: 'Insufficient funds'
      };
    case '26':
      return {
        status: 'failed',
        message: 'System busy, try again'
      };
    default:
      return {
        status: 'failed',
        message: queryResponse.ResultDesc || `Payment failed with code ${queryResponse.ResultCode}`
      };
  }
}