// M-Pesa utility functions for multi-tenant setup
// Following production-grade security practices

import crypto from 'crypto';

// Environment configuration
export const MPESA_CONFIG = {
  SANDBOX_BASE_URL: 'https://sandbox.safaricom.co.ke',
  PRODUCTION_BASE_URL: 'https://api.safaricom.co.ke',
  OAUTH_ENDPOINT: '/oauth/v1/generate?grant_type=client_credentials',
  STK_PUSH_ENDPOINT: '/mpesa/stkpush/v1/processrequest',
  CALLBACK_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.tabeza.co.ke',
} as const;

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.MPESA_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

/**
 * Encrypt sensitive M-Pesa credentials using AES-256-GCM
 */
export function encryptCredential(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const cipher = crypto.createCipher('aes-256-gcm', key);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, authTag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt M-Pesa credentials
 */
export function decryptCredential(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate M-Pesa OAuth token for a specific tenant
 */
export async function generateMpesaToken(
  consumerKey: string,
  consumerSecret: string,
  environment: 'sandbox' | 'production'
): Promise<string> {
  const baseUrl = environment === 'production' 
    ? MPESA_CONFIG.PRODUCTION_BASE_URL 
    : MPESA_CONFIG.SANDBOX_BASE_URL;
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(`${baseUrl}${MPESA_CONFIG.OAUTH_ENDPOINT}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate M-Pesa token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Generate M-Pesa password for STK Push
 */
export function generateMpesaPassword(
  businessShortCode: string,
  passkey: string,
  timestamp: string
): string {
  const concatenated = businessShortCode + passkey + timestamp;
  return Buffer.from(concatenated).toString('base64');
}

/**
 * Generate timestamp in M-Pesa format (YYYYMMDDHHMMSS)
 */
export function generateMpesaTimestamp(): string {
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
 * Generate callback URL for a specific tenant
 */
export function generateCallbackUrl(): string {
  return `${MPESA_CONFIG.CALLBACK_BASE_URL}/api/payments/mpesa/callback`;
}

/**
 * Generate account reference for multi-tenant identification
 * Format: bar_id|tab_id (simplified since we only use tabs)
 */
export function generateAccountReference(
  barId: string,
  tabId: string
): string {
  return `${barId}|${tabId}`;
}

/**
 * Parse account reference to extract tenant and tab info
 */
export function parseAccountReference(accountReference: string): {
  barId: string;
  tabId: string;
} {
  const parts = accountReference.split('|');
  if (parts.length !== 2) {
    throw new Error('Invalid account reference format');
  }
  
  return {
    barId: parts[0],
    tabId: parts[1]
  };
}

/**
 * Validate M-Pesa phone number format
 */
export function validateMpesaPhoneNumber(phoneNumber: string): boolean {
  // Remove any spaces, dashes, or plus signs
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  
  // Must be 12 digits starting with 254 (Kenya country code)
  // Or 10 digits starting with 07 (local format)
  const kenyanFormat = /^254[17]\d{8}$/;
  const localFormat = /^07\d{8}$/;
  
  return kenyanFormat.test(cleaned) || localFormat.test(cleaned);
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
export function formatMpesaPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  
  if (cleaned.startsWith('254')) {
    return cleaned;
  } else if (cleaned.startsWith('07')) {
    return '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '254' + cleaned;
  } else {
    throw new Error('Invalid phone number format');
  }
}

/**
 * STK Push request interface
 */
export interface StkPushRequest {
  businessShortCode: string;
  password: string;
  timestamp: string;
  transactionType: 'CustomerPayBillOnline';
  amount: number;
  partyA: string; // Phone number
  partyB: string; // Business shortcode
  phoneNumber: string;
  callBackURL: string;
  accountReference: string;
  transactionDesc: string;
}

/**
 * STK Push response interface
 */
export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * M-Pesa callback interface
 */
export interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: any;
        }>;
      };
    };
  };
}

/**
 * Validate M-Pesa credentials format
 */
export function validateMpesaCredentials(credentials: {
  businessShortCode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Business shortcode should be 5-7 digits
  if (!/^\d{5,7}$/.test(credentials.businessShortCode)) {
    errors.push('Business shortcode must be 5-7 digits');
  }
  
  // Consumer key should be alphanumeric and reasonable length
  if (!credentials.consumerKey || credentials.consumerKey.length < 10) {
    errors.push('Consumer key is required and must be at least 10 characters');
  }
  
  // Consumer secret should be alphanumeric and reasonable length
  if (!credentials.consumerSecret || credentials.consumerSecret.length < 10) {
    errors.push('Consumer secret is required and must be at least 10 characters');
  }
  
  // Passkey should be reasonable length
  if (!credentials.passkey || credentials.passkey.length < 10) {
    errors.push('Passkey is required and must be at least 10 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}