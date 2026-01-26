# M-Pesa Configuration Loader

A simple, environment variable-based configuration loader for M-Pesa payments that replaces the over-engineered database credential storage system.

## Features

- ✅ Load credentials from environment variables
- ✅ Support both sandbox and production environments
- ✅ Clear error messages for missing configuration
- ✅ Comprehensive validation on startup
- ✅ Simple API with TypeScript types

## Requirements Satisfied

- **Requirement 4.1**: THE System SHALL read M-Pesa credentials from environment variables
- **Requirement 4.2**: THE System SHALL support both sandbox and production environments via configuration
- **Requirement 4.4**: WHEN environment variables are missing, THE System SHALL return clear configuration error messages
- **Requirement 4.5**: THE System SHALL validate all required M-Pesa configuration on startup

## Usage

### Basic Configuration Loading

```typescript
import { loadMpesaConfig, MpesaConfigurationError } from '@tabeza/shared';

try {
  const config = loadMpesaConfig();
  console.log(`Environment: ${config.environment}`);
  console.log(`Business Shortcode: ${config.businessShortcode}`);
} catch (error) {
  if (error instanceof MpesaConfigurationError) {
    console.error('Configuration Error:', error.message);
  }
}
```

### Conditional Feature Enablement

```typescript
import { isMpesaConfigured } from '@tabeza/shared';

if (isMpesaConfigured()) {
  // Enable M-Pesa payment options
  console.log('M-Pesa is available');
} else {
  // Disable M-Pesa payment options
  console.log('M-Pesa is not configured');
}
```

### Startup Validation

```typescript
import { loadMpesaConfig } from '@tabeza/shared';

// Validate configuration on application startup
try {
  const config = loadMpesaConfig();
  console.log('✅ M-Pesa configuration is valid');
} catch (error) {
  console.error('❌ M-Pesa configuration is invalid:', error.message);
  process.exit(1);
}
```

## Required Environment Variables

### All Environments

```env
MPESA_ENVIRONMENT=sandbox|production
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

### Sandbox Example

```env
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=9v38Dtu5u2BpsITPmLcXNWGMsjZRWSTG
MPESA_CONSUMER_SECRET=bclwIPkcRqw61yUt
MPESA_BUSINESS_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

### Production Example

```env
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_BUSINESS_SHORTCODE=123456
MPESA_PASSKEY=your_production_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

## Configuration Object

The `loadMpesaConfig()` function returns a `MpesaConfig` object:

```typescript
interface MpesaConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  businessShortcode: string;
  passkey: string;
  callbackUrl: string;
  oauthUrl: string;      // Auto-generated based on environment
  stkPushUrl: string;    // Auto-generated based on environment
}
```

## Validation Rules

### Business Shortcode
- Must be 5-7 digits
- PayBill format (Till numbers not supported for STK Push)

### Consumer Key & Secret
- Must be at least 10 characters each

### Passkey
- Must be at least 10 characters

### Callback URL
- Must be a valid URL
- Must use HTTPS in production environment
- Can use HTTP in sandbox environment (for localhost testing)

### Environment
- Must be either "sandbox" or "production" (case-insensitive)

## Error Handling

The configuration loader throws `MpesaConfigurationError` with clear messages:

```typescript
// Missing environment variables
throw new MpesaConfigurationError(
  'Missing required M-Pesa environment variables: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET',
  ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET']
);

// Invalid environment
throw new MpesaConfigurationError(
  'Invalid MPESA_ENVIRONMENT: "invalid". Must be "sandbox" or "production"'
);

// Validation errors
throw new MpesaConfigurationError(
  'Invalid M-Pesa configuration: MPESA_BUSINESS_SHORTCODE must be 5-7 digits'
);
```

## Migration from Over-Engineered System

This simple configuration loader replaces:

- ❌ `mpesa_credentials` database table
- ❌ `CredentialRetrievalService` class
- ❌ `TenantMpesaConfigFactory` class
- ❌ Complex encryption/decryption logic
- ❌ Database-based credential storage

With:

- ✅ Simple environment variable loading
- ✅ Clear validation and error messages
- ✅ TypeScript types and interfaces
- ✅ ~100 lines of code vs 2000+ lines

## Testing

The configuration loader includes comprehensive unit tests covering:

- Valid sandbox and production configurations
- Missing environment variable detection
- Invalid environment value handling
- Business shortcode format validation
- Consumer key/secret length validation
- Callback URL format validation
- HTTPS requirement in production
- Case-insensitive environment handling
- Edge cases and error conditions

Run tests with:

```bash
cd packages/shared
pnpm test mpesa-config.test.ts
```