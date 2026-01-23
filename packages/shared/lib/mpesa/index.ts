/**
 * M-PESA Payment Integration - Core Infrastructure
 * 
 * This module provides the foundational infrastructure for M-PESA payment processing,
 * including TypeScript interfaces, environment configuration management, and base
 * service classes with dependency injection.
 */

// Export all types and interfaces
export * from './types';

// Export configuration management
export * from './config';

// Export base services and dependency injection interfaces
export * from './services/base';

// Export tenant-specific services
export * from './services/tab-resolution';
export * from './services/credential-retrieval';
export * from './services/kms-decryption';
export * from './services/tenant-config-factory';

// Export core services
export * from './services/auth';
export * from './services/stkpush';
export * from './services/transaction';
export * from './services/callback';
export * from './services/state-machine';
export * from './services/order-sync';

// Export middleware
export * from './middleware/error-handler';
export * from './middleware/retry-manager';
export * from './middleware/rate-limiter';
export * from './middleware/audit-logger';

// Export testing utilities
export * from './testing/sandbox-utilities';

// Re-export commonly used types for convenience
export type {
  MpesaEnvironment,
  TransactionStatus,
  MpesaCredentials,
  Transaction,
  STKPushRequest,
  STKPushResponse,
  PaymentInitiationResult,
  MpesaPaymentStatus,
  EnvironmentConfig,
  ServiceConfig,
  ValidationResult
} from './types';

// Re-export error classes
export {
  MpesaError,
  MpesaValidationError,
  MpesaNetworkError,
  MpesaAuthenticationError
} from './types';