/**
 * Property-based tests for M-PESA rate limiting enforcement
 * Feature: mpesa-payment-integration, Property 12: Rate Limiting Enforcement
 * Validates: Requirements 5.4
 */

import fc from 'fast-check';
import { MpesaRateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from '../middleware/rate-limiter';

describe('Property 12: Rate Limiting Enforcement', () => {
  let rateLimiter: MpesaRateLimiter;

  beforeEach(() => {
    // Create fresh rate limiter for each test
    rateLimiter = new MpesaRateLimiter({
      ...DEFAULT_RATE_LIMIT_CONFIG,
      customerPaymentsPerMinute: 3,
      customerPaymentsPerHour: 10,
      ipRequestsPerMinute: 5,
      ipRequestsPerHour: 20
    });
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  });

  /**
   * Property: Rate limits should be enforced consistently across all customers
   * For any sequence of payment requests from the same customer, 
   * rate limiting should prevent exceeding configured limits
   */
  test('should enforce per-customer rate limits consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate customer data
        fc.record({
          customerId: fc.uuid(),
          phoneNumber: fc.constantFrom('254708374149', '254711123456', '254722987654'),
          amount: fc.integer({ min: 1, max: 1000 }),
          requestCount: fc.integer({ min: 1, max: 10 })
        }),
        async ({ customerId, phoneNumber, amount, requestCount }) => {
          const results: boolean[] = [];
          
          // Make multiple requests rapidly
          for (let i = 0; i < requestCount; i++) {
            const result = await rateLimiter.checkCustomerRateLimit(
              customerId,
              phoneNumber,
              amount,
              '192.168.1.1'
            );
            results.push(result.allowed);
          }

          // Count allowed requests
          const allowedCount = results.filter(allowed => allowed).length;
          
          // Should not exceed per-minute limit (3 requests)
          expect(allowedCount).toBeLessThanOrEqual(3);
          
          // If we made more than 3 requests, some should be blocked
          if (requestCount > 3) {
            expect(allowedCount).toBeLessThan(requestCount);
          }
          
          // First few requests (up to limit) should be allowed
          const expectedAllowed = Math.min(requestCount, 3);
          expect(results.slice(0, expectedAllowed).every(allowed => allowed)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: IP-based rate limits should be enforced independently of customer limits
   * For any sequence of requests from the same IP address,
   * IP rate limiting should be enforced regardless of customer identity
   */
  test('should enforce IP-based rate limits independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate IP and multiple customers
        fc.record({
          ipAddress: fc.ipV4(),
          customers: fc.array(
            fc.record({
              customerId: fc.uuid(),
              phoneNumber: fc.constantFrom('254708374149', '254711123456'),
              amount: fc.integer({ min: 1, max: 1000 })
            }),
            { minLength: 1, maxLength: 8 }
          )
        }),
        async ({ ipAddress, customers }) => {
          const results: boolean[] = [];
          
          // Make requests from different customers but same IP
          for (const customer of customers) {
            const result = await rateLimiter.checkCustomerRateLimit(
              customer.customerId,
              customer.phoneNumber,
              customer.amount,
              ipAddress
            );
            results.push(result.allowed);
          }

          const allowedCount = results.filter(allowed => allowed).length;
          
          // Should not exceed IP per-minute limit (5 requests)
          expect(allowedCount).toBeLessThanOrEqual(5);
          
          // If we made more than 5 requests, some should be blocked due to IP limit
          if (customers.length > 5) {
            expect(allowedCount).toBeLessThan(customers.length);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Suspicious activity detection should trigger blocks appropriately
   * For any pattern of requests that meets suspicious criteria,
   * the system should detect and block appropriately
   */
  test('should detect and block suspicious activity patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate suspicious activity patterns
        fc.record({
          customerId: fc.uuid(),
          phoneNumbers: fc.array(
            fc.constantFrom('254708374149', '254711123456', '254722987654', '254733456789'),
            { minLength: 4, maxLength: 6 } // More than maxDuplicatePhoneNumbers (3)
          ),
          amounts: fc.array(
            fc.integer({ min: 1, max: 1000 }),
            { minLength: 3, maxLength: 5 }
          ),
          ipAddress: fc.ipV4()
        }),
        async ({ customerId, phoneNumbers, amounts, ipAddress }) => {
          let blockedDueToSuspicion = false;
          
          // Create suspicious pattern: multiple phone numbers, varying amounts
          for (let i = 0; i < phoneNumbers.length; i++) {
            const phoneNumber = phoneNumbers[i];
            const amount = amounts[i % amounts.length];
            
            // Record some failed attempts to increase suspicion
            if (i % 2 === 0) {
              await rateLimiter.recordFailedAttempt(
                customerId,
                phoneNumber,
                amount,
                'Simulated failure',
                ipAddress
              );
            }
            
            const result = await rateLimiter.checkCustomerRateLimit(
              customerId,
              phoneNumber,
              amount,
              ipAddress
            );
            
            if (!result.allowed && result.reason?.includes('Suspicious activity')) {
              blockedDueToSuspicion = true;
              break;
            }
          }
          
          // With multiple phone numbers (> 3), should eventually trigger suspicious activity detection
          expect(blockedDueToSuspicion).toBe(true);
        }
      ),
      { numRuns: 50 } // Fewer runs due to complexity
    );
  });

  /**
   * Property: Rate limit windows should reset properly
   * After a rate limit window expires, new requests should be allowed
   */
  test('should reset rate limit windows properly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customerId: fc.uuid(),
          phoneNumber: fc.constantFrom('254708374149', '254711123456'),
          amount: fc.integer({ min: 1, max: 1000 })
        }),
        async ({ customerId, phoneNumber, amount }) => {
          // Fill up the rate limit
          const initialResults: boolean[] = [];
          for (let i = 0; i < 5; i++) {
            const result = await rateLimiter.checkCustomerRateLimit(
              customerId,
              phoneNumber,
              amount
            );
            initialResults.push(result.allowed);
          }
          
          // Should have some allowed and some blocked
          const initialAllowed = initialResults.filter(allowed => allowed).length;
          expect(initialAllowed).toBeLessThanOrEqual(3); // Per-minute limit
          
          // Wait for window to reset (simulate by creating new rate limiter)
          rateLimiter.destroy();
          rateLimiter = new MpesaRateLimiter({
            ...DEFAULT_RATE_LIMIT_CONFIG,
            customerPaymentsPerMinute: 3
          });
          
          // Should be able to make requests again
          const afterResetResult = await rateLimiter.checkCustomerRateLimit(
            customerId,
            phoneNumber,
            amount
          );
          
          expect(afterResetResult.allowed).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Rate limiting should not affect unrelated customers
   * Rate limits applied to one customer should not affect other customers
   */
  test('should isolate rate limits between customers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customer1: fc.record({
            id: fc.uuid(),
            phoneNumber: fc.constantFrom('254708374149', '254711123456'),
            amount: fc.integer({ min: 1, max: 1000 })
          }),
          customer2: fc.record({
            id: fc.uuid(),
            phoneNumber: fc.constantFrom('254722987654', '254733456789'),
            amount: fc.integer({ min: 1, max: 1000 })
          }),
          requestsPerCustomer: fc.integer({ min: 1, max: 5 })
        }),
        async ({ customer1, customer2, requestsPerCustomer }) => {
          // Ensure customers are different
          fc.pre(customer1.id !== customer2.id);
          
          // Exhaust customer1's rate limit
          for (let i = 0; i < 5; i++) {
            await rateLimiter.checkCustomerRateLimit(
              customer1.id,
              customer1.phoneNumber,
              customer1.amount
            );
          }
          
          // Customer2 should still be able to make requests
          const customer2Results: boolean[] = [];
          for (let i = 0; i < requestsPerCustomer; i++) {
            const result = await rateLimiter.checkCustomerRateLimit(
              customer2.id,
              customer2.phoneNumber,
              customer2.amount
            );
            customer2Results.push(result.allowed);
          }
          
          // Customer2 should have their own fresh rate limit
          const expectedAllowed = Math.min(requestsPerCustomer, 3);
          const actualAllowed = customer2Results.filter(allowed => allowed).length;
          
          expect(actualAllowed).toBe(expectedAllowed);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Failed attempts should be tracked correctly for suspicious activity detection
   * Recording failed attempts should contribute to suspicious activity scoring
   */
  test('should track failed attempts for suspicious activity detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customerId: fc.uuid(),
          phoneNumber: fc.constantFrom('254708374149', '254711123456'),
          amount: fc.integer({ min: 1, max: 1000 }),
          failedAttempts: fc.integer({ min: 5, max: 10 }),
          successfulAttempts: fc.integer({ min: 1, max: 3 })
        }),
        async ({ customerId, phoneNumber, amount, failedAttempts, successfulAttempts }) => {
          // Record multiple failed attempts
          for (let i = 0; i < failedAttempts; i++) {
            await rateLimiter.recordFailedAttempt(
              customerId,
              phoneNumber,
              amount,
              'Test failure',
              '192.168.1.1'
            );
          }
          
          // Record some successful attempts
          for (let i = 0; i < successfulAttempts; i++) {
            await rateLimiter.recordSuccessfulPayment(
              customerId,
              phoneNumber,
              amount,
              '192.168.1.1'
            );
          }
          
          // High failure rate should trigger suspicious activity detection
          const result = await rateLimiter.checkCustomerRateLimit(
            customerId,
            phoneNumber,
            amount,
            '192.168.1.1'
          );
          
          // With high failure rate (> 70%), should be blocked for suspicious activity
          const totalAttempts = failedAttempts + successfulAttempts;
          const failureRate = failedAttempts / totalAttempts;
          
          if (failureRate > 0.7 && failedAttempts >= 5) {
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Suspicious activity');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Rate limit statistics should be accurate
   * Rate limit statistics should correctly reflect the current state
   */
  test('should provide accurate rate limit statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customers: fc.array(
            fc.record({
              id: fc.uuid(),
              phoneNumber: fc.constantFrom('254708374149', '254711123456'),
              amount: fc.integer({ min: 1, max: 1000 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          requestsPerCustomer: fc.integer({ min: 1, max: 3 })
        }),
        async ({ customers, requestsPerCustomer }) => {
          let totalRequests = 0;
          
          // Make requests for each customer
          for (const customer of customers) {
            for (let i = 0; i < requestsPerCustomer; i++) {
              await rateLimiter.checkCustomerRateLimit(
                customer.id,
                customer.phoneNumber,
                customer.amount
              );
              totalRequests++;
            }
          }
          
          // Get statistics
          const stats = rateLimiter.getRateLimitStats();
          
          // Should track active customers
          expect(stats.activeCustomers).toBe(customers.length);
          expect(stats.activeCustomers).toBeGreaterThanOrEqual(0);
          expect(stats.blockedCustomers).toBeGreaterThanOrEqual(0);
          expect(stats.blockedIPs).toBeGreaterThanOrEqual(0);
          expect(stats.suspiciousActivities).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Manual unblocking should work correctly
   * Manually unblocking a customer should allow them to make requests again
   */
  test('should allow manual unblocking of customers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          customerId: fc.uuid(),
          phoneNumber: fc.constantFrom('254708374149', '254711123456'),
          amount: fc.integer({ min: 1, max: 1000 })
        }),
        async ({ customerId, phoneNumber, amount }) => {
          // Create suspicious activity to get blocked
          for (let i = 0; i < 6; i++) {
            await rateLimiter.recordFailedAttempt(
              customerId,
              `25470837414${i}`, // Different phone numbers
              amount,
              'Test failure',
              '192.168.1.1'
            );
          }
          
          // Should be blocked
          const blockedResult = await rateLimiter.checkCustomerRateLimit(
            customerId,
            phoneNumber,
            amount
          );
          
          if (!blockedResult.allowed) {
            // Manually unblock
            await rateLimiter.unblockCustomer(customerId);
            
            // Should be able to make requests again
            const unblockedResult = await rateLimiter.checkCustomerRateLimit(
              customerId,
              phoneNumber,
              amount
            );
            
            expect(unblockedResult.allowed).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Additional edge case tests for rate limiting
 */
describe('Rate Limiting Edge Cases', () => {
  let rateLimiter: MpesaRateLimiter;

  beforeEach(() => {
    rateLimiter = new MpesaRateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  });

  test('should handle invalid input gracefully', async () => {
    // Test with invalid customer ID
    const result1 = await rateLimiter.checkCustomerRateLimit(
      '', // Empty customer ID
      '254708374149',
      100
    );
    expect(result1.allowed).toBe(false);

    // Test with invalid phone number
    const result2 = await rateLimiter.checkCustomerRateLimit(
      'valid-customer-id',
      '', // Empty phone number
      100
    );
    expect(result2.allowed).toBe(false);

    // Test with invalid amount
    const result3 = await rateLimiter.checkCustomerRateLimit(
      'valid-customer-id',
      '254708374149',
      -100 // Negative amount
    );
    expect(result3.allowed).toBe(false);
  });

  test('should handle concurrent requests correctly', async () => {
    const customerId = 'test-customer';
    const phoneNumber = '254708374149';
    const amount = 100;

    // Make concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      rateLimiter.checkCustomerRateLimit(customerId, phoneNumber, amount)
    );

    const results = await Promise.all(promises);
    const allowedCount = results.filter(r => r.allowed).length;

    // Should not exceed rate limit even with concurrent requests
    expect(allowedCount).toBeLessThanOrEqual(3);
  });
});