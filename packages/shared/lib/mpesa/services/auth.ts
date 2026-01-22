/**
 * M-PESA OAuth token generation and management service
 * Handles access token generation, caching, and refresh logic
 */

import { 
  MpesaCredentials,
  OAuthTokenResponse,
  MpesaAuthenticationError,
  MpesaNetworkError,
  MpesaError
} from '../types';
import { BaseService, Logger, HttpClient } from './base';
import { ServiceConfig } from '../types';

/**
 * Token cache entry
 */
interface TokenCacheEntry {
  token: string;
  expiresAt: number;
  environment: string;
  businessShortCode: string;
}

/**
 * M-PESA authentication service
 * Manages OAuth token generation, caching, and refresh logic
 */
export class MpesaAuthService extends BaseService {
  private tokenCache: Map<string, TokenCacheEntry> = new Map();
  private readonly TOKEN_BUFFER_MS = 60000; // Refresh 1 minute before expiry

  constructor(
    config: ServiceConfig,
    logger?: Logger,
    httpClient?: HttpClient
  ) {
    super(config, logger, httpClient);
    this.validateConfig();
  }

  /**
   * Generate OAuth access token using consumer key/secret
   * Implements caching and automatic refresh logic
   */
  public async generateAccessToken(): Promise<string> {
    const cacheKey = this.getCacheKey();
    const cached = this.tokenCache.get(cacheKey);

    // Return cached token if valid
    if (cached && this.isTokenValid(cached)) {
      this.logWithContext('debug', 'Using cached access token', {
        expiresAt: new Date(cached.expiresAt).toISOString(),
        businessShortCode: cached.businessShortCode
      });
      return cached.token;
    }

    // Generate new token
    return this.retry(
      () => this.requestNewToken(),
      'OAuth token generation'
    );
  }

  /**
   * Force refresh of access token
   * Bypasses cache and requests new token
   */
  public async refreshAccessToken(): Promise<string> {
    const cacheKey = this.getCacheKey();
    this.tokenCache.delete(cacheKey);
    
    this.logWithContext('info', 'Force refreshing access token');
    return this.generateAccessToken();
  }

  /**
   * Validate current access token
   * Makes a test request to verify token validity
   */
  public async validateAccessToken(token?: string): Promise<boolean> {
    const accessToken = token || await this.generateAccessToken();
    const config = this.getCurrentConfig();

    try {
      // Make a test request to STK Push query endpoint with invalid data
      // This will fail with authentication error if token is invalid
      const response = await this.httpClient.post(
        config.urls.stkQuery,
        {
          BusinessShortCode: '000000',
          Password: 'test',
          Timestamp: '20240101000000',
          CheckoutRequestID: 'test'
        },
        {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      );

      // If we get here without auth error, token is valid
      return true;
    } catch (error) {
      if (error instanceof MpesaNetworkError && error.statusCode === 401) {
        this.logWithContext('warn', 'Access token validation failed - token is invalid');
        return false;
      }
      
      // Other errors (like validation errors) mean token is valid but request was bad
      if (error instanceof MpesaNetworkError && error.statusCode !== 401) {
        return true;
      }
      
      // Network errors - assume token is valid
      this.logWithContext('warn', 'Token validation failed due to network error', {
        error: error instanceof Error ? error.message : error
      });
      return true;
    }
  }

  /**
   * Clear token cache
   * Useful for testing or when credentials change
   */
  public clearTokenCache(): void {
    this.tokenCache.clear();
    this.logWithContext('info', 'Token cache cleared');
  }

  /**
   * Get token cache statistics
   */
  public getTokenCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.tokenCache.values()) {
      if (this.isTokenValid(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.tokenCache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Request new token from M-PESA API
   */
  private async requestNewToken(): Promise<string> {
    const config = this.getCurrentConfig();
    const credentials = config.credentials;

    // Rate limiting check
    this.checkRateLimit(`auth_${credentials.businessShortCode}`);

    // Create basic auth header
    const auth = Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`
    ).toString('base64');

    this.logWithContext('info', 'Requesting new OAuth token', {
      businessShortCode: credentials.businessShortCode,
      environment: config.environment
    });

    try {
      const response = await this.httpClient.get(
        `${config.urls.oauth}?grant_type=client_credentials`,
        {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      );

      // Validate response structure
      if (!this.isValidTokenResponse(response)) {
        throw new MpesaAuthenticationError(
          'Invalid token response format from M-PESA API'
        );
      }

      const tokenResponse = response as OAuthTokenResponse;
      
      // Cache the token
      const expiresIn = parseInt(tokenResponse.expires_in) * 1000; // Convert to ms
      const expiresAt = Date.now() + expiresIn - this.TOKEN_BUFFER_MS;
      
      const cacheEntry: TokenCacheEntry = {
        token: tokenResponse.access_token,
        expiresAt,
        environment: config.environment,
        businessShortCode: credentials.businessShortCode
      };

      const cacheKey = this.getCacheKey();
      this.tokenCache.set(cacheKey, cacheEntry);

      this.logWithContext('info', 'OAuth token generated and cached successfully', {
        expiresAt: new Date(expiresAt).toISOString(),
        expiresInSeconds: Math.floor((expiresAt - Date.now()) / 1000)
      });

      return tokenResponse.access_token;

    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof MpesaNetworkError && error.statusCode === 401) {
        throw new MpesaAuthenticationError(
          'Invalid M-PESA credentials - check consumer key and secret'
        );
      }

      // Handle other network errors
      if (error instanceof MpesaNetworkError) {
        throw new MpesaNetworkError(
          `Failed to generate OAuth token: ${error.message}`,
          error.originalError
        );
      }

      // Re-throw M-PESA errors as-is
      if (error instanceof MpesaError) {
        throw error;
      }

      // Wrap other errors
      throw new MpesaError(
        `OAuth token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TOKEN_GENERATION_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Generate cache key for token storage
   */
  private getCacheKey(): string {
    const config = this.getCurrentConfig();
    return `${config.environment}_${config.credentials.businessShortCode}`;
  }

  /**
   * Check if cached token is still valid
   */
  private isTokenValid(entry: TokenCacheEntry): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Validate OAuth token response structure
   */
  private isValidTokenResponse(response: any): response is OAuthTokenResponse {
    return (
      response &&
      typeof response === 'object' &&
      typeof response.access_token === 'string' &&
      response.access_token.length > 0 &&
      typeof response.expires_in === 'string' &&
      !isNaN(parseInt(response.expires_in))
    );
  }

  /**
   * Clean up expired tokens from cache
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [key, entry] of this.tokenCache.entries()) {
      if (now >= entry.expiresAt) {
        this.tokenCache.delete(key);
      }
    }
  }

  /**
   * Periodic cleanup of expired tokens
   */
  public startTokenCleanup(intervalMs: number = 300000): NodeJS.Timeout {
    return setInterval(() => {
      this.cleanupExpiredTokens();
      this.cleanupRateLimits();
    }, intervalMs);
  }

  /**
   * Handle authentication errors gracefully
   */
  private handleAuthError(error: any, context: string): never {
    if (error instanceof MpesaAuthenticationError) {
      this.logWithContext('error', `Authentication failed: ${error.message}`, {
        context,
        code: error.code
      });
      throw error;
    }

    if (error instanceof MpesaNetworkError && error.statusCode === 401) {
      const authError = new MpesaAuthenticationError(
        'Invalid credentials or expired token'
      );
      this.logWithContext('error', `Authentication failed: ${authError.message}`, {
        context,
        originalError: error.message
      });
      throw authError;
    }

    // Use base class error handling for other errors
    this.handleError(error, context);
  }
}