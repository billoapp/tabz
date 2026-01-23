# ServiceFactory Integration with Tenant Credentials

This document explains how the ServiceFactory has been enhanced to support tenant-specific credentials while maintaining backward compatibility.

## Overview

The ServiceFactory now supports three ways to create service configurations:

1. **Legacy Method**: Using environment variables (backward compatible)
2. **Tenant Method**: Using pre-resolved tenant configurations
3. **Auto-Resolution Method**: Automatically resolving from tab ID to service configuration

## Usage Examples

### 1. Legacy Method (Backward Compatible)

```typescript
import { ServiceFactory } from '@tabeza/shared';

// This continues to work exactly as before
const serviceConfig = ServiceFactory.createServiceConfig(
  'sandbox',
  {
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE!,
    passkey: process.env.MPESA_PASSKEY!,
    callbackUrl: process.env.MPESA_CALLBACK_URL!,
    environment: 'sandbox',
    encryptedAt: new Date()
  }
);
```

### 2. Tenant Method (Recommended)

```typescript
import { ServiceFactory, TenantMpesaConfigFactory } from '@tabeza/shared';

// Create tenant configuration
const tenantConfigFactory = new TenantMpesaConfigFactory();
const tenantConfig = tenantConfigFactory.createTenantConfig(
  tenantInfo,
  decryptedCredentials
);

// Create service configuration from tenant config
const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig);
```

### 3. Auto-Resolution Method (Most Convenient)

```typescript
import { 
  ServiceFactory, 
  TabResolutionService, 
  CredentialRetrievalService,
  TenantMpesaConfigFactory 
} from '@tabeza/shared';

// Create service configuration directly from tab ID
const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
  tabId,
  tabResolutionService,
  credentialRetrievalService,
  tenantConfigFactory
);
```

## Migration Guide

### Before (Using Environment Variables)

```typescript
// OLD: Payment initiation endpoint
export async function POST(request: NextRequest) {
  // ... validation code ...

  // Create service configuration from environment variables
  const serviceConfig = ServiceFactory.createServiceConfig(
    (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    {
      consumerKey: process.env.MPESA_CONSUMER_KEY!,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
      businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE!,
      passkey: process.env.MPESA_PASSKEY!,
      callbackUrl: process.env.MPESA_CALLBACK_URL!,
      environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      encryptedAt: new Date()
    }
  );

  const stkPushService = new STKPushService(serviceConfig);
  // ... rest of payment logic ...
}
```

### After (Using Tenant Credentials)

```typescript
// NEW: Payment initiation endpoint with tenant credentials
export async function POST(request: NextRequest) {
  // ... validation code ...

  // Initialize tenant services
  const tabResolutionService = new TabResolutionService(supabaseUrl, supabaseKey);
  const credentialRetrievalService = new CredentialRetrievalService(supabaseUrl, supabaseKey);
  const tenantConfigFactory = new TenantMpesaConfigFactory();

  try {
    // Create service configuration from tab ID (automatic tenant resolution)
    const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
      tabId,
      tabResolutionService,
      credentialRetrievalService,
      tenantConfigFactory
    );

    const stkPushService = new STKPushService(serviceConfig);
    // ... rest of payment logic ...

  } catch (error) {
    // Handle tenant-specific errors
    if (error instanceof MpesaError) {
      switch (error.code) {
        case 'TAB_NOT_FOUND':
          return NextResponse.json({ error: 'Tab not found' }, { status: 404 });
        case 'CREDENTIALS_NOT_FOUND':
          return NextResponse.json({ 
            error: 'Payment service not configured for this location' 
          }, { status: 503 });
        default:
          return NextResponse.json({ 
            error: 'Payment service temporarily unavailable' 
          }, { status: 503 });
      }
    }
    // ... handle other errors ...
  }
}
```

## Error Handling

The enhanced ServiceFactory provides detailed error handling:

### Configuration Errors

```typescript
try {
  const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig);
} catch (error) {
  if (error instanceof MpesaError) {
    switch (error.code) {
      case 'INVALID_TENANT_CONFIG':
        // Handle invalid tenant configuration
        break;
      case 'MISSING_CREDENTIALS':
        // Handle missing credentials
        break;
      case 'INVALID_ENVIRONMENT':
        // Handle invalid environment
        break;
    }
  }
}
```

### Resolution Errors

```typescript
try {
  const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
    tabId,
    tabResolutionService,
    credentialRetrievalService,
    tenantConfigFactory
  );
} catch (error) {
  if (error instanceof MpesaError) {
    switch (error.code) {
      case 'TAB_NOT_FOUND':
        // Handle tab not found
        break;
      case 'CREDENTIALS_NOT_FOUND':
        // Handle credentials not found
        break;
      case 'TENANT_CONFIG_CREATION_ERROR':
        // Handle tenant config creation failure
        break;
    }
  }
}
```

## Batch Operations

For processing multiple tenants:

```typescript
// Create service configurations for multiple tenants
const serviceConfigs = ServiceFactory.createBatchServiceConfigs(tenantConfigs);

// Create services for each configuration
const stkPushServices = serviceConfigs.map(config => 
  new STKPushService(config)
);
```

## Configuration Overrides

All methods support configuration overrides:

```typescript
// Override timeout and retry settings
const serviceConfig = ServiceFactory.createTenantServiceConfig(
  tenantConfig,
  {
    timeoutMs: 45000,
    retryAttempts: 5
  }
);
```

## Best Practices

### 1. Use Auto-Resolution for Payment Endpoints

```typescript
// Recommended pattern for payment endpoints
const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
  tabId,
  tabResolutionService,
  credentialRetrievalService,
  tenantConfigFactory
);
```

### 2. Cache Service Instances

```typescript
// Cache services per tenant to avoid repeated resolution
const serviceCache = new Map<string, STKPushService>();

async function getSTKPushService(tabId: string): Promise<STKPushService> {
  if (!serviceCache.has(tabId)) {
    const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
      tabId,
      tabResolutionService,
      credentialRetrievalService,
      tenantConfigFactory
    );
    serviceCache.set(tabId, new STKPushService(serviceConfig));
  }
  return serviceCache.get(tabId)!;
}
```

### 3. Handle Errors Gracefully

```typescript
// Provide user-friendly error messages
try {
  const service = await getSTKPushService(tabId);
  // ... use service ...
} catch (error) {
  if (error instanceof MpesaError && error.code === 'CREDENTIALS_NOT_FOUND') {
    return { error: 'Payment service not configured for this location' };
  }
  return { error: 'Payment service temporarily unavailable' };
}
```

## Testing

The enhanced ServiceFactory is fully tested with:

- Unit tests for each method
- Integration tests with mock services
- Error handling tests
- Backward compatibility tests
- Batch operation tests

See `service-factory-integration.test.ts` for comprehensive test examples.

## Requirements Satisfied

This integration satisfies the following requirements:

- **5.4**: Database Schema Compliance - Works with existing mpesa_credentials table
- **6.1**: Payment Flow Integration - Maintains existing API interface and response format
- **Backward Compatibility**: Existing code continues to work unchanged
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Multi-tenant Support**: Full support for tenant-specific credentials