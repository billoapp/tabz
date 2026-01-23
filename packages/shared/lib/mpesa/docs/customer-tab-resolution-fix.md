# Customer Tab Resolution Fix for M-Pesa Payments

## Problem Identified

Users were getting "Tab not found" errors when trying to make M-Pesa payments, even though they had active tabs and could see their tab numbers/nicknames. The issue was that the M-Pesa payment system was expecting a `tabId` (UUID), but customers are identified by their `tab_number` or `owner_identifier` (device-based key), not the internal UUID.

## Root Cause

The payment flow had a mismatch between:
- **Customer Context**: Users are identified by `owner_identifier` (format: `device_123_barId`) and see `tab_number`
- **Payment System**: Expected `tabId` (UUID) as input parameter
- **Missing Resolution**: No mechanism to resolve customer context to `tabId`

## Solution Implemented

### 1. Enhanced Tab Resolution Service

Added new methods to `TabResolutionService`:

```typescript
// New methods for customer-context resolution
resolveCustomerTabToTenant(barId: string, customerIdentifier: string): Promise<TenantInfo>;
findCustomerTab(barId: string, customerIdentifier: string): Promise<TabInfo>;
resolveTabByNumber(barId: string, tabNumber: number): Promise<TabInfo>;
```

### 2. Updated Payment API

Modified the customer payment endpoint to accept:
- `barId` - The bar where the customer has a tab
- `customerIdentifier` - The device-based identifier (format: `device_123_barId`)
- `phoneNumber` - Customer's phone number
- `amount` - Payment amount

Instead of requiring `tabId` directly.

### 3. Customer Context Resolution Flow

The new flow works as follows:

```
Customer Context (barId + customerIdentifier) 
    ↓
Find Customer's Tab (owner_identifier lookup)
    ↓
Resolve Tab to Tenant (bar_id → tenant credentials)
    ↓
M-Pesa Service Configuration
    ↓
STK Push Request
```

### 4. Service Factory Enhancement

Added new method to `ServiceFactory`:

```typescript
static async createServiceConfigFromCustomerContext(
  barId: string,
  customerIdentifier: string,
  tabResolutionService: TabResolutionService,
  credentialRetrievalService: CredentialRetrievalService,
  tenantConfigFactory: TenantMpesaConfigFactory,
  overrides?: Partial<ServiceConfig>
): Promise<ServiceConfig>
```

### 5. Customer Context Utilities

Created utility functions for customer identifier management:

```typescript
// Generate customer identifier from device ID and bar ID
generateCustomerIdentifier(deviceId: string, barId: string): string

// Parse customer identifier to extract components
parseCustomerIdentifier(customerIdentifier: string): { deviceId: string; barId: string } | null

// Validate customer identifier format
isValidCustomerIdentifier(customerIdentifier: string): boolean
```

## API Changes

### Before (Broken)
```json
POST /api/payments/mpesa/initiate
{
  "tabId": "uuid-that-customer-doesnt-know",
  "phoneNumber": "+254712345678",
  "amount": 1000
}
```

### After (Fixed)
```json
POST /api/payments/mpesa/initiate
{
  "barId": "bar-uuid",
  "customerIdentifier": "device_123_bar-uuid",
  "phoneNumber": "+254712345678", 
  "amount": 1000
}
```

## Customer App Integration

The customer app should:

1. **Get Device ID**: Use existing device identification system
2. **Get Bar Context**: Know which bar the customer is at
3. **Generate Customer Identifier**: `${deviceId}_${barId}`
4. **Call Payment API**: Use new API format

Example integration:
```typescript
import { generateCustomerIdentifier } from '@tabeza/shared/lib/mpesa/utils/customer-context';

// In customer app
const deviceId = getDeviceId(); // From existing system
const barId = getCurrentBarId(); // From current context
const customerIdentifier = generateCustomerIdentifier(deviceId, barId);

// Make payment
const result = await fetch('/api/payments/mpesa/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    barId,
    customerIdentifier,
    phoneNumber: '+254712345678',
    amount: 1000
  })
});
```

## Error Handling Improvements

Enhanced error messages for customer-specific scenarios:

- `CUSTOMER_TAB_NOT_FOUND`: "No open tab found. Please create a tab first."
- `ORPHANED_TAB`: "Tab is not available for payments"
- `INVALID_TAB_STATUS`: "Tab is not open for payments"
- `CREDENTIALS_NOT_FOUND`: "Payment service not configured for this location"

## Database Queries

The solution uses efficient database queries:

```sql
-- Find customer's tab
SELECT id, bar_id, tab_number, status, owner_identifier, opened_at, closed_at
FROM tabs 
WHERE bar_id = $1 
  AND owner_identifier = $2 
  AND status = 'open'

-- Resolve tab to tenant with bar info
SELECT t.*, b.name, b.active
FROM tabs t
INNER JOIN bars b ON t.bar_id = b.id
WHERE t.id = $1
```

## Backward Compatibility

The solution maintains backward compatibility:
- Existing `tabId`-based methods still work
- Staff app can continue using UUID-based lookups
- Customer app uses new customer-context methods

## Testing

Added comprehensive tests for:
- Customer tab resolution
- Customer identifier validation
- Error scenarios (no tab, inactive bar, etc.)
- Integration with existing tenant credential system

## Benefits

1. **Fixes Customer Payment Issues**: Customers can now make payments using their natural context
2. **Maintains Security**: Still uses tenant-specific credentials
3. **Improves UX**: No need for customers to know internal UUIDs
4. **Scalable**: Works across multiple bars and tenants
5. **Robust Error Handling**: Clear error messages for different scenarios

## Next Steps

1. **Update Customer App**: Integrate new payment API format
2. **Test with Real Data**: Validate with actual customer tabs
3. **Monitor Performance**: Ensure efficient database queries
4. **User Training**: Update any customer-facing documentation

The fix ensures that M-Pesa payments work seamlessly with the existing customer tab system while maintaining the security and multi-tenancy benefits of the tenant credential architecture.