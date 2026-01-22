/**
 * Core M-PESA TypeScript interfaces and types
 * Defines all data models for M-PESA payment integration
 */

// Environment types
export type MpesaEnvironment = 'sandbox' | 'production';

// Transaction status types
export type TransactionStatus = 
  | 'pending' 
  | 'sent' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'timeout';

// M-PESA API URLs by environment
export const MPESA_URLS = {
  sandbox: {
    oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
    stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  },
  production: {
    oauth: 'https://api.safaricom.co.ke/oauth/v1/generate',
    stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  }
} as const;

// M-PESA credentials interface
export interface MpesaCredentials {
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  environment: MpesaEnvironment;
  callbackUrl: string;
  timeoutUrl?: string;
  encryptedAt: Date;
  lastValidated?: Date;
}

// Transaction model - linked to tabs for tab-level payments
export interface Transaction {
  id: string;
  tabId: string;           // Changed from orderId - payments are against tabs
  customerId: string;
  phoneNumber: string;
  amount: number;          // Amount being paid toward tab balance
  currency: 'KES';
  status: TransactionStatus;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  failureReason?: string;
  resultCode?: number;
  environment: MpesaEnvironment;
  tabPaymentId?: string;   // Link to tab_payments record when completed
  createdAt: Date;
  updatedAt: Date;
  callbackData?: any;
}

// STK Push request model
export interface STKPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: number;
  PartyA: string; // Customer phone number
  PartyB: string; // Organization shortcode
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string; // Max 12 chars
  TransactionDesc: string; // Max 13 chars
}

// STK Push response model
export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

// OAuth token response model
export interface OAuthTokenResponse {
  access_token: string;
  expires_in: string;
}

// Callback data models
export interface STKCallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export interface SuccessfulPaymentData {
  mpesaReceiptNumber: string;
  transactionDate: string;
  amount: number;
  phoneNumber: string;
}

export interface FailedPaymentData {
  resultCode: number;
  resultDesc: string;
}

// Payment initiation result
export interface PaymentInitiationResult {
  success: boolean;
  transactionId: string;
  checkoutRequestId?: string;
  customerMessage?: string;
  error?: string;
}

// Payment status result
export interface MpesaPaymentStatus {
  transactionId: string;
  status: TransactionStatus;
  amount: number;
  phoneNumber: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Environment configuration
export interface EnvironmentConfig {
  environment: MpesaEnvironment;
  urls: {
    oauth: string;
    stkPush: string;
    stkQuery: string;
  };
  credentials: MpesaCredentials;
  isProduction: boolean;
  validationRules: {
    maxAmount: number;
    minAmount: number;
    allowedPhoneNumbers?: string[];
  };
}

// Service configuration
export interface ServiceConfig {
  environment: MpesaEnvironment;
  credentials: MpesaCredentials;
  timeoutMs: number;
  retryAttempts: number;
  rateLimitPerMinute: number;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Error types
export class MpesaError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MpesaError';
  }
}

export class MpesaValidationError extends MpesaError {
  constructor(message: string, public validationErrors: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'MpesaValidationError';
  }
}

export class MpesaNetworkError extends MpesaError {
  constructor(message: string, originalError?: any) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
    this.name = 'MpesaNetworkError';
  }
}

export class MpesaAuthenticationError extends MpesaError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'MpesaAuthenticationError';
  }
}