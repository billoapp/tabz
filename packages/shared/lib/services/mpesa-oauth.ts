/**
 * Simple M-Pesa OAuth Token Service
 * Replaces over-engineered auth service with simple token management
 * Requirements: 2.1
 */

import { type MpesaConfig, loadMpesaConfig } from './mpesa-config';

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface CachedToken {
  token: string;
  expiresAt: number;
}

export class MpesaOAuthError extends Error {
  constructor(message: string, public statusCode?: number, public originalError?: any) {
    super(message);
    this.name = 'MpesaOAuthError';
  }
}

// Simple in-memory token cache
const tokenCache = new Map<string, CachedToken>();

/**
 * Get OAuth access token from Safaricom
 * Handles token caching and refresh logic
 * Requirement 2.1: WHEN a customer enters a valid phone number and amount, THE System SHALL initiate an STK Push request to Safaricom
 */
export async function getOAuthToken(config: MpesaConfig): Promise<string> {
  const cacheKey = getCacheKey(config);
  
  // Check if we have a valid cached token
  const cached = tokenCache.get(cacheKey);
  if (cached && isTokenValid(cached)) {
    return cached.token;
  }

  // Request new token
  return await requestNewToken(config, cacheKey);
}

/**
 * Force refresh of OAuth token
 * Bypasses cache and requests new token
 */
export async function refreshOAuthToken(config: MpesaConfig): Promise<string> {
  const cacheKey = getCacheKey(config);
  
  // Clear cached token
  tokenCache.delete(cacheKey);
  
  // Request new token
  return await requestNewToken(config, cacheKey);
}

/**
 * Clear token cache (useful for testing)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Request new OAuth token from Safaricom API
 */
async function requestNewToken(config: MpesaConfig, cacheKey: string): Promise<string> {
  try {
    // Create basic auth header
    const auth = Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`
    ).toString('base64');

    // Make OAuth request
    const response = await fetch(config.oauthUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'No response received';
      throw new MpesaOAuthError(
        `OAuth request failed: ${response?.status || 'unknown'} ${response?.statusText || 'unknown error'}`,
        response?.status,
        errorText
      );
    }

    const tokenResponse = await response.json() as OAuthTokenResponse;

    // Validate response
    if (!tokenResponse.access_token || !tokenResponse.expires_in) {
      throw new MpesaOAuthError('Invalid token response format from Safaricom API');
    }

    // Cache the token (with 1 minute buffer before expiry)
    const expiresInMs = parseInt(tokenResponse.expires_in) * 1000;
    const bufferMs = 60000; // 1 minute buffer
    const expiresAt = Date.now() + expiresInMs - bufferMs;

    const cachedToken: CachedToken = {
      token: tokenResponse.access_token,
      expiresAt,
    };

    tokenCache.set(cacheKey, cachedToken);

    return tokenResponse.access_token;

  } catch (error) {
    // Handle fetch errors (network issues) - these are thrown before response checking
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new MpesaOAuthError(
        'Network error while requesting OAuth token',
        undefined,
        error
      );
    }

    // Re-throw MpesaOAuthError as-is
    if (error instanceof MpesaOAuthError) {
      throw error;
    }

    // Wrap other errors
    throw new MpesaOAuthError(
      `OAuth token request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Generate cache key for token storage
 */
function getCacheKey(config: MpesaConfig): string {
  return `${config.environment}_${config.businessShortcode}`;
}

/**
 * Check if cached token is still valid
 */
function isTokenValid(cached: CachedToken): boolean {
  return Date.now() < cached.expiresAt;
}

/**
 * Get token cache statistics (useful for monitoring)
 */
export function getTokenCacheStats(): {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
} {
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of tokenCache.values()) {
    if (isTokenValid(entry)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: tokenCache.size,
    validEntries,
    expiredEntries,
  };
}

/**
 * Clean up expired tokens from cache
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, entry] of tokenCache.entries()) {
    if (now >= entry.expiresAt) {
      tokenCache.delete(key);
    }
  }
}