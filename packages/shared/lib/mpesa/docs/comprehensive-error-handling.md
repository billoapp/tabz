# Comprehensive Error Handling Implementation

## Overview

This document describes the comprehensive error handling system implemented for the M-Pesa tenant credentials fix. The system provides user-friendly error messages, proper error categorization and logging, and ensures no sensitive data exposure in error responses.

## Requirements Addressed

- **3.1**: User-friendly error messages for credential issues
- **3.2**: Proper error categorization and logging  
- **3.3**: No sensitive data exposure in error responses
- **3.4**: Comprehensive error handling for all failure scenarios
- **6.4**: User-friendly error messages without technical details

## Architecture

### Core Components

1. **TenantCredentialErrorHandler**: Enhanced error handler specifically for tenant credential operations
2. **Enhanced Error Categories**: Specific categories for tenant operations (TAB_RESOLUTION, CREDENTIAL_RETRIEVAL, etc.)
3. **Context Sanitization**: Automatic removal of sensitive data from error contexts
4. **User-Friendly Messages**: Mapping of technical errors to customer-facing messages
5. **Comprehensive Logging**: Detailed logging for administrators without exposing sensitive data

### Error Categories

The system defines specific error categories for tenant credential operations:

- `TAB_RESOLUTION`: Errors related to resolving tabs to tenants
- `CREDENTIAL_RETRIEVAL`: Errors fetching credentials from database
- `CREDENTIAL_DECRYPTION`: Errors decrypting stored credentials
- `CREDENTIAL_VALIDATION`: Errors validating credential formats
- `TENANT_CONFIGURATION`: Errors in tenant configuration
- `PAYMENT_INITIATION`: Errors during payment processing

### Error Severity Levels

- `CRITICAL`: System-level failures (missing KMS keys, etc.)
- `HIGH`: Service failures that require immediate attention
- `MEDIUM`: Configuration or data issues
- `LOW`: User input validation errors

## Implementation Details

### 1. Enhanced Error Service

```typescript
// packages/shared/lib/mpesa/services/error-handling.ts
export class TenantCredentialErrorHandler {
  // Handles tenant-specific errors with enhanced context
  handleTenantError(error: any, context: {...}): TenantErrorInfo
  
  // Creates standardized API responses
  createErrorResponse(errorInfo: TenantErrorInfo): ErrorResponse
  
  // Sanitizes sensitive data from contexts
  private sanitizeTenantContext(context: Record<string, any>): Record<string, any>
}
```

### 2. User-Friendly Error Messages

The system maps technical error codes to user-friendly messages:

```typescript
const TENANT_USER_MESSAGES: Record<string, string> = {
  'TAB_NOT_FOUND': 'The selected tab could not be found. Please refresh and try again.',
  'CREDENTIALS_NOT_FOUND': 'Payment service is not configured for this location. Please contact the establishment.',
  'DECRYPTION_FAILED': 'Unable to access payment credentials. Please try again later.',
  // ... more mappings
};
```

### 3. Admin Messages for Debugging

Technical details are provided in admin messages for debugging:

```typescript
const TENANT_ADMIN_MESSAGES: Record<string, string> = {
  'TAB_NOT_FOUND': 'Tab ID not found in database - check tab existence and permissions',
  'CREDENTIALS_NOT_FOUND': 'No M-Pesa credentials found for tenant in specified environment',
  'DECRYPTION_FAILED': 'AES decryption failed - check key validity',
  // ... more mappings
};
```

### 4. Context Sanitization

Sensitive data is automatically removed from error contexts:

```typescript
private sanitizeTenantContext(context: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential', 'passkey',
    'consumerKey', 'consumerSecret', 'phoneNumber', 'encryptedData',
    'decryptedData', 'masterKey', 'kmsKey'
  ];
  
  // Remove sensitive fields completely
  // Mask IDs in sandbox mode for debugging
}
```

### 5. Service Integration

All existing services have been updated to use the enhanced error handling:

```typescript
// Tab Resolution Service
async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
  return withTenantErrorHandling(
    async () => {
      // Service logic here
    },
    this.errorHandler,
    { tabId, operation: 'resolveTabToTenant' }
  );
}
```

## Error Response Format

### Production Environment

```json
{
  "success": false,
  "error": {
    "code": "CREDENTIALS_NOT_FOUND",
    "message": "Payment service is not configured for this location. Please contact the establishment.",
    "shouldRetry": false
  }
}
```

### Sandbox Environment (with debug info)

```json
{
  "success": false,
  "error": {
    "code": "CREDENTIALS_NOT_FOUND",
    "message": "Payment service is not configured for this location. Please contact the establishment.",
    "shouldRetry": false
  },
  "debug": {
    "category": "CREDENTIAL_RETRIEVAL",
    "severity": "MEDIUM",
    "adminMessage": "No M-Pesa credentials found for tenant in specified environment",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "tenantId": "tenant-123",
    "barId": "bar-456"
  }
}
```

## Error Handling by Category

### Tab Resolution Errors

| Error Code | User Message | Status Code | Retry |
|------------|--------------|-------------|-------|
| `TAB_NOT_FOUND` | "The selected tab could not be found. Please refresh and try again." | 404 | No |
| `ORPHANED_TAB` | "This tab is not properly configured. Please contact support." | 400 | No |
| `INACTIVE_BAR` | "This location is temporarily unavailable for payments." | 400 | No |
| `INVALID_TAB_STATUS` | "This tab is not available for payments at this time." | 400 | No |

### Credential Retrieval Errors

| Error Code | User Message | Status Code | Retry |
|------------|--------------|-------------|-------|
| `CREDENTIALS_NOT_FOUND` | "Payment service is not configured for this location. Please contact the establishment." | 503 | No |
| `CREDENTIALS_INACTIVE` | "Payment service is temporarily unavailable at this location." | 503 | No |
| `CREDENTIALS_INCOMPLETE` | "Payment service configuration is incomplete. Please contact support." | 503 | No |
| `DATABASE_ERROR` | "Service temporarily unavailable. Please try again in a few moments." | 503 | Yes |

### Decryption Errors

| Error Code | User Message | Status Code | Retry |
|------------|--------------|-------------|-------|
| `KMS_KEY_MISSING` | "Payment service is temporarily unavailable. Please try again later." | 500 | No |
| `DECRYPTION_FAILED` | "Unable to access payment credentials. Please try again later." | 500 | No |
| `CORRUPTED_ENCRYPTED_DATA` | "Payment configuration error. Please contact support." | 500 | No |

### Validation Errors

| Error Code | User Message | Status Code | Retry |
|------------|--------------|-------------|-------|
| `CREDENTIALS_INVALID` | "Payment service configuration is invalid. Please contact support." | 500 | No |
| `VALIDATION_ERROR` | "Payment configuration validation failed. Please contact support." | 500 | No |

## Security Features

### 1. Sensitive Data Protection

- **No Logging**: Sensitive fields (keys, secrets, phone numbers) are never logged
- **Context Sanitization**: Automatic removal of sensitive data from error contexts
- **Masked IDs**: In sandbox mode, IDs are partially masked for debugging
- **Environment Awareness**: Different behavior for production vs sandbox

### 2. Information Disclosure Prevention

- **Generic User Messages**: Technical details are hidden from end users
- **Admin-Only Details**: Technical information only available to administrators
- **No Stack Traces**: Stack traces only included in sandbox mode
- **Sanitized Logging**: All logs are sanitized before writing

### 3. Error Response Consistency

- **Standardized Format**: All error responses follow the same structure
- **Environment-Specific**: Debug information only in sandbox
- **Status Code Mapping**: Appropriate HTTP status codes for each error type
- **Retry Guidance**: Clear indication of whether operations should be retried

## Usage Examples

### 1. Basic Error Handling

```typescript
import { createTenantCredentialErrorHandler } from '../services/error-handling';

const errorHandler = createTenantCredentialErrorHandler(logger, 'sandbox');

try {
  // Some operation that might fail
  await riskyOperation();
} catch (error) {
  const errorInfo = errorHandler.handleTenantError(error, {
    tenantId: 'tenant-123',
    operation: 'riskyOperation'
  });
  
  return NextResponse.json(
    errorHandler.createErrorResponse(errorInfo),
    { status: errorInfo.statusCode }
  );
}
```

### 2. Service Integration

```typescript
import { withTenantErrorHandling } from '../services/error-handling';

async someServiceMethod(tabId: string): Promise<Result> {
  return withTenantErrorHandling(
    async () => {
      // Service logic here
      return await performOperation(tabId);
    },
    this.errorHandler,
    {
      tabId,
      operation: 'someServiceMethod'
    }
  );
}
```

### 3. Payment Endpoint Integration

```typescript
export async function paymentEndpoint(request: NextRequest) {
  const errorHandler = createTenantCredentialErrorHandler(logger, environment);
  
  try {
    // Payment processing logic
    const result = await processPayment(request);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorInfo = errorHandler.handleTenantError(error, {
      operation: 'paymentEndpoint',
      environment
    });
    
    return NextResponse.json(
      errorHandler.createErrorResponse(errorInfo),
      { status: errorInfo.statusCode }
    );
  }
}
```

## Testing

The error handling system includes comprehensive tests covering:

- **Error Categorization**: Correct mapping of errors to categories
- **User Message Generation**: Appropriate user-friendly messages
- **Context Sanitization**: Removal of sensitive data
- **Response Format**: Correct API response structure
- **Environment Behavior**: Different behavior for production vs sandbox
- **Logging Verification**: Proper logging without sensitive data

### Running Tests

```bash
# Run all error handling tests
npm test -- --testPathPattern="error-handling"

# Run specific test file
npm test comprehensive-error-handling.test.ts
```

## Monitoring and Alerting

The error handling system provides:

- **Error Statistics**: Tracking of error frequency by category and severity
- **Alert Thresholds**: Configurable thresholds for different error types
- **Correlation IDs**: Request tracking for debugging
- **Performance Metrics**: Error handling performance monitoring

## Best Practices

### 1. Error Context

Always provide meaningful context when handling errors:

```typescript
const errorInfo = errorHandler.handleTenantError(error, {
  tenantId: tenant.id,
  barId: tenant.barId,
  tabId: request.tabId,
  operation: 'specificOperation',
  environment: 'sandbox'
});
```

### 2. Sensitive Data

Never include sensitive data in error contexts:

```typescript
// ❌ Bad - includes sensitive data
const context = {
  consumerKey: credentials.consumerKey,
  phoneNumber: request.phoneNumber
};

// ✅ Good - no sensitive data
const context = {
  tenantId: tenant.id,
  operation: 'validateCredentials'
};
```

### 3. Error Propagation

Use the wrapper function for consistent error handling:

```typescript
// ✅ Good - uses wrapper for consistent handling
return withTenantErrorHandling(
  () => performOperation(),
  errorHandler,
  context
);

// ❌ Bad - manual error handling
try {
  return await performOperation();
} catch (error) {
  // Manual error handling logic
}
```

## Future Enhancements

1. **Metrics Integration**: Integration with monitoring systems (Prometheus, DataDog)
2. **Alert Management**: Automated alert routing based on error severity
3. **Error Recovery**: Automatic retry mechanisms for transient errors
4. **User Feedback**: Collection of user feedback on error messages
5. **A/B Testing**: Testing different error message variations

## Conclusion

The comprehensive error handling system provides:

- **User-Friendly Experience**: Clear, actionable error messages for users
- **Security**: No exposure of sensitive data in any error response
- **Debugging Support**: Detailed information for administrators
- **Monitoring**: Comprehensive logging and statistics
- **Consistency**: Standardized error handling across all services

This implementation ensures that the M-Pesa tenant credentials system handles all error scenarios gracefully while maintaining security and providing excellent user experience.