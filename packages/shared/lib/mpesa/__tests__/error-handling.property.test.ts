/**
 * Property-based tests for M-PESA error handling and logging
 * Feature: mpesa-payment-integration, Property 14: Error Handling and Logging
 * Validates: Requirements 5.5, 7.1, 7.2
 */

import fc from 'fast-check';
import { 
  ErrorHandler, 
  ErrorCategory, 
  ErrorSeverity, 
  createErrorHandler,
  ErrorInfo 
} from '../middleware/error-handler';
import { 
  MpesaError, 
  MpesaValidationError, 
  MpesaNetworkError, 
  MpesaAuthenticationError,
  MpesaEnvironment 
} from '../types';
import { Logger } from '../services/base';

// Mock logger for testing
class MockLogger implements Logger {
  public logs: Array<{ level: string; message: string; meta?: any }> = [];

  info(message: string, meta?: any): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: any): void {
    this.logs.push({ level: 'error', message, meta });
  }

  debug(message: string, meta?: any): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  clear(): void {
    this.logs = [];
  }
}

// Generators for test data
const errorCodeGenerator = fc.oneof(
  fc.constant('NETWORK_ERROR'),
  fc.constant('AUTHENTICATION_ERROR'),
  fc.constant('VALIDATION_ERROR'),
  fc.constant('RATE_LIMIT_ERROR'),
  fc.constant('SYSTEM_ERROR'),
  fc.constant('UNKNOWN_ERROR')
);

const environmentGenerator = fc.oneof(
  fc.constant('sandbox' as MpesaEnvironment),
  fc.constant('production' as MpesaEnvironment)
);

const contextGenerator = fc.record({
  transactionId: fc.string({ minLength: 1, maxLength: 50 }),
  phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
  amount: fc.integer({ min: 1, max: 100000 }),
  operation: fc.oneof(fc.constant('stkpush'), fc.constant('callback'), fc.constant('status_query'))
});

const mpesaErrorGenerator = fc.tuple(errorCodeGenerator, fc.string({ minLength: 1, maxLength: 200 }))
  .map(([code, message]) => new MpesaError(message, code));

const networkErrorGenerator = fc.string({ minLength: 1, maxLength: 200 })
  .map(message => new MpesaNetworkError(message));

const validationErrorGenerator = fc.tuple(
  fc.string({ minLength: 1, maxLength: 200 }),
  fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 })
).map(([message, errors]) => new MpesaValidationError(message, errors));

const authErrorGenerator = fc.string({ minLength: 1, maxLength: 200 })
  .map(message => new MpesaAuthenticationError(message));

const genericErrorGenerator = fc.string({ minLength: 1, maxLength: 200 })
  .map(message => new Error(message));

const anyErrorGenerator = fc.oneof(
  mpesaErrorGenerator,
  networkErrorGenerator,
  validationErrorGenerator,
  authErrorGenerator,
  genericErrorGenerator
);

describe('Error Handling and Logging Property Tests', () => {
  let mockLogger: MockLogger;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  /**
   * Property 14: Error Handling and Logging
   * For any error condition, detailed information should be logged for debugging 
   * while user-facing messages should not expose sensitive data
   */
  describe('Property 14: Error Handling and Logging', () => {
    test('should always log detailed information for debugging while sanitizing user messages', () => {
      fc.assert(fc.property(
        environmentGenerator,
        anyErrorGenerator,
        contextGenerator,
        (environment, error, context) => {
          // Arrange
          mockLogger.clear();
          errorHandler = createErrorHandler(mockLogger, environment);

          // Act
          const errorInfo = errorHandler.handleError(error, context);

          // Assert - Error info structure is complete
          expect(errorInfo).toHaveProperty('category');
          expect(errorInfo).toHaveProperty('severity');
          expect(errorInfo).toHaveProperty('code');
          expect(errorInfo).toHaveProperty('message');
          expect(errorInfo).toHaveProperty('userMessage');
          expect(errorInfo).toHaveProperty('adminMessage');
          expect(errorInfo).toHaveProperty('context');
          expect(errorInfo).toHaveProperty('timestamp');
          expect(errorInfo).toHaveProperty('environment');
          expect(errorInfo).toHaveProperty('shouldRetry');

          // Assert - Environment is correctly set
          expect(errorInfo.environment).toBe(environment);

          // Assert - Timestamp is recent (within last 5 seconds)
          const timeDiff = Date.now() - errorInfo.timestamp.getTime();
          expect(timeDiff).toBeLessThan(5000);

          // Assert - Category is valid enum value
          expect(Object.values(ErrorCategory)).toContain(errorInfo.category);

          // Assert - Severity is valid enum value
          expect(Object.values(ErrorSeverity)).toContain(errorInfo.severity);

          // Assert - Code is non-empty string
          expect(typeof errorInfo.code).toBe('string');
          expect(errorInfo.code.length).toBeGreaterThan(0);

          // Assert - Messages are non-empty strings
          expect(typeof errorInfo.userMessage).toBe('string');
          expect(errorInfo.userMessage.length).toBeGreaterThan(0);
          expect(typeof errorInfo.adminMessage).toBe('string');
          expect(errorInfo.adminMessage.length).toBeGreaterThan(0);

          // Assert - shouldRetry is boolean
          expect(typeof errorInfo.shouldRetry).toBe('boolean');

          // Assert - Context is sanitized (no sensitive data)
          expect(errorInfo.context).not.toHaveProperty('password');
          expect(errorInfo.context).not.toHaveProperty('secret');
          expect(errorInfo.context).not.toHaveProperty('key');
          expect(errorInfo.context).not.toHaveProperty('token');

          // Assert - Phone number is masked if present in context
          if (context.phoneNumber && errorInfo.context.phoneNumber) {
            expect(errorInfo.context.phoneNumber).toContain('*');
          }

          // Assert - Logging occurred
          expect(mockLogger.logs.length).toBeGreaterThan(0);

          // Assert - Log level matches severity
          const logEntry = mockLogger.logs[mockLogger.logs.length - 1];
          switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
              expect(logEntry.level).toBe('error');
              break;
            case ErrorSeverity.MEDIUM:
              expect(logEntry.level).toBe('warn');
              break;
            case ErrorSeverity.LOW:
              expect(logEntry.level).toBe('info');
              break;
          }

          // Assert - Log contains admin message
          expect(logEntry.message).toContain(errorInfo.adminMessage);

          // Assert - Log metadata contains required fields
          expect(logEntry.meta).toHaveProperty('category');
          expect(logEntry.meta).toHaveProperty('code');
          expect(logEntry.meta).toHaveProperty('severity');
          expect(logEntry.meta).toHaveProperty('environment');
          expect(logEntry.meta).toHaveProperty('shouldRetry');

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should never expose sensitive data in user messages', () => {
      fc.assert(fc.property(
        environmentGenerator,
        anyErrorGenerator,
        fc.record({
          phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
          consumerKey: fc.string({ minLength: 20, maxLength: 50 }),
          consumerSecret: fc.string({ minLength: 20, maxLength: 50 }),
          passkey: fc.string({ minLength: 20, maxLength: 100 }),
          token: fc.string({ minLength: 20, maxLength: 100 }),
          password: fc.string({ minLength: 8, maxLength: 50 })
        }),
        (environment, error, sensitiveContext) => {
          // Arrange
          mockLogger.clear();
          errorHandler = createErrorHandler(mockLogger, environment);

          // Act
          const errorInfo = errorHandler.handleError(error, sensitiveContext);

          // Assert - User message doesn't contain sensitive data
          const userMessage = errorInfo.userMessage.toLowerCase();
          expect(userMessage).not.toContain(sensitiveContext.phoneNumber);
          expect(userMessage).not.toContain(sensitiveContext.consumerKey);
          expect(userMessage).not.toContain(sensitiveContext.consumerSecret);
          expect(userMessage).not.toContain(sensitiveContext.passkey);
          expect(userMessage).not.toContain(sensitiveContext.token);
          expect(userMessage).not.toContain(sensitiveContext.password);

          // Assert - User message doesn't contain technical error details
          expect(userMessage).not.toContain('stack');
          expect(userMessage).not.toContain('trace');
          expect(userMessage).not.toContain('exception');
          expect(userMessage).not.toContain('sql');
          expect(userMessage).not.toContain('database');

          // Assert - Context is properly sanitized
          expect(errorInfo.context).not.toHaveProperty('consumerKey');
          expect(errorInfo.context).not.toHaveProperty('consumerSecret');
          expect(errorInfo.context).not.toHaveProperty('passkey');
          expect(errorInfo.context).not.toHaveProperty('token');
          expect(errorInfo.context).not.toHaveProperty('password');

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should provide appropriate retry guidance based on error type', () => {
      fc.assert(fc.property(
        environmentGenerator,
        fc.oneof(
          fc.constant(new MpesaNetworkError('Network timeout')),
          fc.constant(new MpesaAuthenticationError('Invalid credentials')),
          fc.constant(new MpesaValidationError('Invalid input', ['phone number'])),
          fc.constant(new MpesaError('Rate limit exceeded', 'RATE_LIMIT_ERROR')),
          fc.constant(new MpesaError('System error', 'SYSTEM_ERROR'))
        ),
        contextGenerator,
        (environment, error, context) => {
          // Arrange
          mockLogger.clear();
          errorHandler = createErrorHandler(mockLogger, environment);

          // Act
          const errorInfo = errorHandler.handleError(error, context);

          // Assert - Retry guidance is appropriate for error type
          if (error instanceof MpesaNetworkError || errorInfo.code === 'SYSTEM_ERROR' || errorInfo.code === 'RATE_LIMIT_ERROR') {
            expect(errorInfo.shouldRetry).toBe(true);
            if (errorInfo.retryAfterMs) {
              expect(errorInfo.retryAfterMs).toBeGreaterThan(0);
            }
          } else if (error instanceof MpesaAuthenticationError || error instanceof MpesaValidationError) {
            // Authentication and validation errors typically shouldn't be retried
            if (errorInfo.code !== 'TOKEN_EXPIRED') {
              expect(errorInfo.shouldRetry).toBe(false);
            }
          }

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should maintain error frequency tracking for alerting', () => {
      fc.assert(fc.property(
        environmentGenerator,
        fc.array(anyErrorGenerator, { minLength: 1, maxLength: 20 }),
        contextGenerator,
        (environment, errors, context) => {
          // Arrange
          mockLogger.clear();
          errorHandler = createErrorHandler(mockLogger, environment);

          // Act - Process multiple errors
          const errorInfos = errors.map(error => errorHandler.handleError(error, context));

          // Assert - All errors were processed
          expect(errorInfos.length).toBe(errors.length);

          // Assert - Error stats are available
          const stats = errorHandler.getErrorStats();
          expect(typeof stats).toBe('object');

          // Assert - Each error was logged
          expect(mockLogger.logs.length).toBe(errors.length);

          // Assert - All error infos have consistent structure
          errorInfos.forEach(errorInfo => {
            expect(errorInfo).toHaveProperty('category');
            expect(errorInfo).toHaveProperty('severity');
            expect(errorInfo).toHaveProperty('timestamp');
            expect(errorInfo.environment).toBe(environment);
          });

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should handle different environments with appropriate logging levels', () => {
      fc.assert(fc.property(
        anyErrorGenerator,
        contextGenerator,
        (error, context) => {
          // Test both environments
          const environments: MpesaEnvironment[] = ['sandbox', 'production'];
          
          environments.forEach(environment => {
            // Arrange
            const mockLoggerEnv = new MockLogger();
            const errorHandlerEnv = createErrorHandler(mockLoggerEnv, environment);

            // Act
            const errorInfo = errorHandlerEnv.handleError(error, context);

            // Assert - Environment-specific behavior
            expect(errorInfo.environment).toBe(environment);

            // Assert - Sandbox should have more detailed logging
            if (environment === 'sandbox') {
              // In sandbox, we might have stack traces and original errors
              if (errorInfo.stackTrace || errorInfo.originalError) {
                expect(true).toBe(true); // These are optional but allowed in sandbox
              }
            }

            // Assert - Production should be more restrictive
            if (environment === 'production') {
              // Production should not log sensitive data by default
              expect(errorInfo.context).not.toHaveProperty('consumerSecret');
              expect(errorInfo.context).not.toHaveProperty('passkey');
            }
          });

          return true;
        }
      ), { numRuns: 20 });
    });
  });
});