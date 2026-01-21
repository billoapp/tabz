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

// Re-export commonly used types for convenience
export type {
  MpesaEnvironment,
  TransactionStatus,
  MpesaCredentials,
  Transaction,
  STKPushRequest,
  STKPushResponse,
  PaymentInitiationResult,
  PaymentStatus,
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