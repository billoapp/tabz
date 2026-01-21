/**
 * Rate limiting and abuse prevention middleware for M-PESA payments
 * Implements per-customer payment rate limiting, IP-based throttling, and suspicious activity detection
 */

import { createClient } from '@supabase/supabase-js';

// Rate limiting configuration
export interface RateLimitConfig {
  // Per-customer limits
  customerPaymentsPerMinute: number;
  customerPaymentsPerHour: number;
  customerPaymentsPerDay: number;
  
  // IP-based limits
  ipRequestsPerMinute: number;
  ipRequestsPerHour: number;
  
  // Suspicious activity thresholds
  maxFailedAttemptsPerHour: number;
  maxDuplicatePhoneNumbers: number;
  maxAmountVariationPercent: number;
  
  // Blocking durations (in minutes)
  customerBlockDuration: number;
  ipBlockDuration: number;
  suspiciousActivityBlockDuration: number;
}

// Default rate limiting configuration
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  customerPaymentsPerMinute: 3,
  customerPaymentsPerHour: 10,
  customerPaymentsPerDay: 50,
  
  ipRequestsPerMinute: 10,
  ipRequestsPerHour: 100,
  
  maxFailedAttemptsPerHour: 5,
  maxDuplicatePhoneNumbers: 3,
  maxAmountVariationPercent: 500, // 500% variation triggers suspicion
  
  customerBlockDuration: 60, // 1 hour
  ipBlockDuration: 30,       // 30 minutes
  suspiciousActivityBlockDuration: 120 // 2 hours
};

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds until next attempt allowed
  remainingAttempts?: number;
  resetTime?: Date;
}

// Suspicious activity detection result
export interface SuspiciousActivityResult {
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100, higher is more suspicious
  recommendedAction: 'allow' | 'warn' | 'block';
}

// Rate limit entry for tracking
interface RateLimitEntry {
  key: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

// Activity pattern for suspicious activity detection
interface ActivityPattern {
  customerId: string;
  phoneNumbers: Set<string>;
  amounts: number[];
  failedAttempts: number;
  successfulPayments: number;
  timePattern: Date[];
  ipAddresses: Set<string>;
}

/**
 * Rate limiter and abuse prevention service
 */
export class MpesaRateLimiter {
  private config: RateLimitConfig;
  private supabase: any;
  private rateLimitCache: Map<string, RateLimitEntry> = new Map();
  private activityPatterns: Map<string, ActivityPattern> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
    supabaseUrl?: string,
    supabaseServiceKey?: string
  ) {
    this.config = config;
    
    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if a customer payment request should be allowed
   */
  public async checkCustomerRateLimit(
    customerId: string,
    phoneNumber: string,
    amount: number,
    ipAddress?: string
  ): Promise<RateLimitResult> {
    // Check customer-specific rate limits
    const customerResult = await this.checkCustomerLimits(customerId);
    if (!customerResult.allowed) {
      return customerResult;
    }

    // Check IP-based rate limits if IP provided
    if (ipAddress) {
      const ipResult = await this.checkIpLimits(ipAddress);
      if (!ipResult.allowed) {
        return ipResult;
      }
    }

    // Check for suspicious activity
    const suspiciousResult = await this.checkSuspiciousActivity(
      customerId,
      phoneNumber,
      amount,
      ipAddress
    );

    if (suspiciousResult.isSuspicious && suspiciousResult.recommendedAction === 'block') {
      await this.blockCustomer(customerId, this.config.suspiciousActivityBlockDuration);
      return {
        allowed: false,
        reason: `Suspicious activity detected: ${suspiciousResult.reasons.join(', ')}`,
        retryAfter: this.config.suspiciousActivityBlockDuration * 60
      };
    }

    // Update rate limit counters
    await this.updateRateLimitCounters(customerId, ipAddress);

    return {
      allowed: true,
      remainingAttempts: this.getRemainingAttempts(customerId),
      resetTime: this.getResetTime(customerId)
    };
  }

  /**
   * Record a failed payment attempt for suspicious activity tracking
   */
  public async recordFailedAttempt(
    customerId: string,
    phoneNumber: string,
    amount: number,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    const pattern = this.getOrCreateActivityPattern(customerId);
    pattern.failedAttempts++;
    pattern.phoneNumbers.add(phoneNumber);
    pattern.amounts.push(amount);
    pattern.timePattern.push(new Date());
    
    if (ipAddress) {
      pattern.ipAddresses.add(ipAddress);
    }

    // Log failed attempt to database if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('mpesa_rate_limit_logs')
          .insert({
            customer_id: customerId,
            phone_number: phoneNumber,
            amount: amount,
            ip_address: ipAddress,
            event_type: 'failed_attempt',
            reason: reason,
            created_at: new Date().toISOString()
          });
      } catch (error) {
        console.error('Failed to log rate limit event:', error);
      }
    }
  }

  /**
   * Record a successful payment for activity tracking
   */
  public async recordSuccessfulPayment(
    customerId: string,
    phoneNumber: string,
    amount: number,
    ipAddress?: string
  ): Promise<void> {
    const pattern = this.getOrCreateActivityPattern(customerId);
    pattern.successfulPayments++;
    pattern.phoneNumbers.add(phoneNumber);
    pattern.amounts.push(amount);
    pattern.timePattern.push(new Date());
    
    if (ipAddress) {
      pattern.ipAddresses.add(ipAddress);
    }

    // Log successful payment to database if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('mpesa_rate_limit_logs')
          .insert({
            customer_id: customerId,
            phone_number: phoneNumber,
            amount: amount,
            ip_address: ipAddress,
            event_type: 'successful_payment',
            created_at: new Date().toISOString()
          });
      } catch (error) {
        console.error('Failed to log rate limit event:', error);
      }
    }
  }

  /**
   * Check customer-specific rate limits
   */
  private async checkCustomerLimits(customerId: string): Promise<RateLimitResult> {
    const now = new Date();
    
    // Check if customer is currently blocked
    const blockKey = `customer_block:${customerId}`;
    const blockEntry = this.rateLimitCache.get(blockKey);
    if (blockEntry && blockEntry.blocked && blockEntry.blockedUntil && blockEntry.blockedUntil > now) {
      const retryAfter = Math.ceil((blockEntry.blockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        reason: 'Customer temporarily blocked due to rate limiting',
        retryAfter
      };
    }

    // Check per-minute limit
    const minuteResult = this.checkTimeWindow(
      `customer_minute:${customerId}`,
      this.config.customerPaymentsPerMinute,
      60 * 1000 // 1 minute
    );
    if (!minuteResult.allowed) {
      return minuteResult;
    }

    // Check per-hour limit
    const hourResult = this.checkTimeWindow(
      `customer_hour:${customerId}`,
      this.config.customerPaymentsPerHour,
      60 * 60 * 1000 // 1 hour
    );
    if (!hourResult.allowed) {
      return hourResult;
    }

    // Check per-day limit
    const dayResult = this.checkTimeWindow(
      `customer_day:${customerId}`,
      this.config.customerPaymentsPerDay,
      24 * 60 * 60 * 1000 // 1 day
    );
    if (!dayResult.allowed) {
      return dayResult;
    }

    return { allowed: true };
  }

  /**
   * Check IP-based rate limits
   */
  private async checkIpLimits(ipAddress: string): Promise<RateLimitResult> {
    const now = new Date();
    
    // Check if IP is currently blocked
    const blockKey = `ip_block:${ipAddress}`;
    const blockEntry = this.rateLimitCache.get(blockKey);
    if (blockEntry && blockEntry.blocked && blockEntry.blockedUntil && blockEntry.blockedUntil > now) {
      const retryAfter = Math.ceil((blockEntry.blockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        reason: 'IP address temporarily blocked due to rate limiting',
        retryAfter
      };
    }

    // Check per-minute limit
    const minuteResult = this.checkTimeWindow(
      `ip_minute:${ipAddress}`,
      this.config.ipRequestsPerMinute,
      60 * 1000 // 1 minute
    );
    if (!minuteResult.allowed) {
      return minuteResult;
    }

    // Check per-hour limit
    const hourResult = this.checkTimeWindow(
      `ip_hour:${ipAddress}`,
      this.config.ipRequestsPerHour,
      60 * 60 * 1000 // 1 hour
    );
    if (!hourResult.allowed) {
      return hourResult;
    }

    return { allowed: true };
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(
    customerId: string,
    phoneNumber: string,
    amount: number,
    ipAddress?: string
  ): Promise<SuspiciousActivityResult> {
    const pattern = this.getOrCreateActivityPattern(customerId);
    const reasons: string[] = [];
    let riskScore = 0;

    // Check failed attempts ratio
    const totalAttempts = pattern.failedAttempts + pattern.successfulPayments;
    if (totalAttempts > 0) {
      const failureRate = pattern.failedAttempts / totalAttempts;
      if (failureRate > 0.7 && pattern.failedAttempts >= this.config.maxFailedAttemptsPerHour) {
        reasons.push('High failure rate detected');
        riskScore += 30;
      }
    }

    // Check for multiple phone numbers
    if (pattern.phoneNumbers.size > this.config.maxDuplicatePhoneNumbers) {
      reasons.push('Multiple phone numbers used');
      riskScore += 25;
    }

    // Check for unusual amount patterns
    if (pattern.amounts.length > 1) {
      const avgAmount = pattern.amounts.reduce((a, b) => a + b, 0) / pattern.amounts.length;
      const maxVariation = Math.max(...pattern.amounts.map(a => Math.abs(a - avgAmount) / avgAmount * 100));
      
      if (maxVariation > this.config.maxAmountVariationPercent) {
        reasons.push('Unusual amount variation detected');
        riskScore += 20;
      }
    }

    // Check for rapid-fire requests
    if (pattern.timePattern.length >= 5) {
      const recentRequests = pattern.timePattern
        .filter(time => Date.now() - time.getTime() < 60000) // Last minute
        .length;
      
      if (recentRequests >= 5) {
        reasons.push('Rapid-fire requests detected');
        riskScore += 35;
      }
    }

    // Check for multiple IP addresses
    if (pattern.ipAddresses.size > 3) {
      reasons.push('Multiple IP addresses used');
      riskScore += 15;
    }

    // Determine recommended action based on risk score
    let recommendedAction: 'allow' | 'warn' | 'block' = 'allow';
    if (riskScore >= 70) {
      recommendedAction = 'block';
    } else if (riskScore >= 40) {
      recommendedAction = 'warn';
    }

    return {
      isSuspicious: riskScore > 0,
      reasons,
      riskScore,
      recommendedAction
    };
  }

  /**
   * Check time window-based rate limits
   */
  private checkTimeWindow(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = new Date();
    const entry = this.rateLimitCache.get(key);

    if (!entry || now.getTime() > entry.windowEnd.getTime()) {
      // Create new window
      this.rateLimitCache.set(key, {
        key,
        count: 0,
        windowStart: now,
        windowEnd: new Date(now.getTime() + windowMs),
        blocked: false
      });
      return { allowed: true };
    }

    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.windowEnd.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter,
        remainingAttempts: 0,
        resetTime: entry.windowEnd
      };
    }

    return {
      allowed: true,
      remainingAttempts: limit - entry.count - 1,
      resetTime: entry.windowEnd
    };
  }

  /**
   * Update rate limit counters
   */
  private async updateRateLimitCounters(customerId: string, ipAddress?: string): Promise<void> {
    // Update customer counters
    this.incrementCounter(`customer_minute:${customerId}`);
    this.incrementCounter(`customer_hour:${customerId}`);
    this.incrementCounter(`customer_day:${customerId}`);

    // Update IP counters if provided
    if (ipAddress) {
      this.incrementCounter(`ip_minute:${ipAddress}`);
      this.incrementCounter(`ip_hour:${ipAddress}`);
    }
  }

  /**
   * Increment counter for a rate limit key
   */
  private incrementCounter(key: string): void {
    const entry = this.rateLimitCache.get(key);
    if (entry) {
      entry.count++;
    }
  }

  /**
   * Block a customer for specified duration
   */
  private async blockCustomer(customerId: string, durationMinutes: number): Promise<void> {
    const now = new Date();
    const blockedUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
    
    this.rateLimitCache.set(`customer_block:${customerId}`, {
      key: `customer_block:${customerId}`,
      count: 0,
      windowStart: now,
      windowEnd: blockedUntil,
      blocked: true,
      blockedUntil
    });

    // Log block event to database if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('mpesa_rate_limit_logs')
          .insert({
            customer_id: customerId,
            event_type: 'customer_blocked',
            reason: 'Suspicious activity detected',
            blocked_until: blockedUntil.toISOString(),
            created_at: now.toISOString()
          });
      } catch (error) {
        console.error('Failed to log block event:', error);
      }
    }
  }

  /**
   * Get or create activity pattern for customer
   */
  private getOrCreateActivityPattern(customerId: string): ActivityPattern {
    if (!this.activityPatterns.has(customerId)) {
      this.activityPatterns.set(customerId, {
        customerId,
        phoneNumbers: new Set(),
        amounts: [],
        failedAttempts: 0,
        successfulPayments: 0,
        timePattern: [],
        ipAddresses: new Set()
      });
    }
    return this.activityPatterns.get(customerId)!;
  }

  /**
   * Get remaining attempts for customer
   */
  private getRemainingAttempts(customerId: string): number {
    const entry = this.rateLimitCache.get(`customer_minute:${customerId}`);
    if (!entry) return this.config.customerPaymentsPerMinute;
    return Math.max(0, this.config.customerPaymentsPerMinute - entry.count);
  }

  /**
   * Get reset time for customer rate limit
   */
  private getResetTime(customerId: string): Date {
    const entry = this.rateLimitCache.get(`customer_minute:${customerId}`);
    return entry ? entry.windowEnd : new Date(Date.now() + 60000);
  }

  /**
   * Clean up expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    
    for (const [key, entry] of this.rateLimitCache.entries()) {
      if (now.getTime() > entry.windowEnd.getTime() && 
          (!entry.blockedUntil || now > entry.blockedUntil)) {
        this.rateLimitCache.delete(key);
      }
    }

    // Clean up old activity patterns (older than 24 hours)
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const [customerId, pattern] of this.activityPatterns.entries()) {
      const recentActivity = pattern.timePattern.filter(time => time > cutoff);
      if (recentActivity.length === 0) {
        this.activityPatterns.delete(customerId);
      } else {
        // Keep only recent activity
        pattern.timePattern = recentActivity;
      }
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  public getRateLimitStats(): {
    activeCustomers: number;
    blockedCustomers: number;
    blockedIPs: number;
    suspiciousActivities: number;
  } {
    let blockedCustomers = 0;
    let blockedIPs = 0;
    
    for (const [key, entry] of this.rateLimitCache.entries()) {
      if (entry.blocked) {
        if (key.startsWith('customer_block:')) {
          blockedCustomers++;
        } else if (key.startsWith('ip_block:')) {
          blockedIPs++;
        }
      }
    }

    const suspiciousActivities = Array.from(this.activityPatterns.values())
      .filter(pattern => {
        const totalAttempts = pattern.failedAttempts + pattern.successfulPayments;
        return totalAttempts > 0 && (pattern.failedAttempts / totalAttempts) > 0.5;
      }).length;

    return {
      activeCustomers: this.activityPatterns.size,
      blockedCustomers,
      blockedIPs,
      suspiciousActivities
    };
  }

  /**
   * Manually unblock a customer (for admin use)
   */
  public async unblockCustomer(customerId: string): Promise<void> {
    this.rateLimitCache.delete(`customer_block:${customerId}`);
    
    if (this.supabase) {
      try {
        await this.supabase
          .from('mpesa_rate_limit_logs')
          .insert({
            customer_id: customerId,
            event_type: 'customer_unblocked',
            reason: 'Manual unblock by admin',
            created_at: new Date().toISOString()
          });
      } catch (error) {
        console.error('Failed to log unblock event:', error);
      }
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimitCache.clear();
    this.activityPatterns.clear();
  }
}

/**
 * Utility function to extract IP address from request
 */
export function extractIpAddress(request: any): string | undefined {
  // Try various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to connection remote address (may not be available in serverless)
  return request.ip || request.connection?.remoteAddress;
}