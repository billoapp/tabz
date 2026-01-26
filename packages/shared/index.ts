// Export all shared types and utilities
export * from './types';
export * from './tokens-service';
export * from './utils';
export * from './lib/response-time';

// Export M-PESA payment integration infrastructure
export * from './lib/mpesa';

// Export M-PESA sync manager with explicit naming to avoid conflicts
export {
  MpesaSyncManager,
  type SyncResult,
  type SyncValidationResult,
  type RepairResult
} from './lib/mpesa-sync-manager';

// Export phone validation utilities
export * from './lib/phoneValidation';

// Export simplified phone validation for M-Pesa payments
export * from './lib/services/phoneValidation';

// Export simplified M-Pesa configuration loader
export * from './lib/services/mpesa-config';

// Export simplified M-Pesa OAuth token service
export * from './lib/services/mpesa-oauth';

// Export simplified M-Pesa STK Push service
export * from './lib/services/mpesa-stk-push';

// Export diagnostic services
export * from './lib/diagnostics/environment-validator';
export * from './lib/diagnostics/mpesa-diagnostic';

// Note: React hooks and components are not exported here to avoid server-side import issues
// Import them directly from their specific paths when needed in client components:
// - './hooks/useRealtimeSubscription'
// - './components/ConnectionStatus'
