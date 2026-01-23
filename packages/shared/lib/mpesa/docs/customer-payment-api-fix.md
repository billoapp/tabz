# Customer Payment API Fix

## Problem
The customer app was getting "Missing required fields: barId, customerIdentifier, phoneNumber, amount" error when trying to make M-Pesa payments. This was because the customer app was still using the old API format while the backend had been updated to use the new customer-context format.

## Root Cause
The M-Pesa payment components in the customer app were still sending:
```json
{
  "tabId": "uuid-that-customer-doesnt-know",
  "phoneNumber": "+254712345678",
  "amount": 1000
}
```

But the updated payment endpoint expected:
```json
{
  "barId": "bar-uuid",
  "customerIdentifier": "device_123_bar-uuid",
  "phoneNumber": "+254712345678",
  "amount": 1000
}
```

## Files Fixed

### 1. `apps/customer/components/MpesaPayment.tsx`
- **Changed**: Updated `initiatePayment()` function to use new API format
- **Added**: Logic to get `barId` from session storage (`currentTab`)
- **Added**: Logic to get `deviceId` from localStorage
- **Added**: Generation of `customerIdentifier` using format `${deviceId}_${barId}`
- **Removed**: `tabId` prop dependency
- **Added**: Debug logging to help troubleshoot context issues

### 2. `apps/customer/components/MpesaPaymentTab.tsx`
- **Removed**: `tabId` prop from interface and component
- **Updated**: Component to not pass `tabId` to `MpesaPayment`

### 3. `apps/customer/app/payment/page.tsx`
- **Removed**: `tabId` prop when rendering `MpesaPaymentTab`

## How It Works Now

1. **Customer Context Resolution**:
   - Get current tab data from `sessionStorage.getItem('currentTab')`
   - Extract `bar_id` from tab data
   - Get device ID from localStorage (`tabeza_device_id_v2` or `Tabeza_device_id`)
   - Generate customer identifier: `${deviceId}_${barId}`

2. **API Call**:
   ```typescript
   const response = await fetch('/api/payments/mpesa/initiate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       barId,
       customerIdentifier,
       phoneNumber: internationalPhone,
       amount
     })
   });
   ```

3. **Backend Processing**:
   - Payment endpoint receives customer context
   - Uses `TabResolutionService.findCustomerTab()` to find the customer's tab
   - Resolves to tenant credentials
   - Processes M-Pesa payment

## Error Handling

Added better error messages for common issues:
- **No active tab**: "No active tab found. Please refresh and try again."
- **Device not registered**: "Device not registered. Please refresh and try again."
- **Tab resolution fails**: Backend returns user-friendly messages like "No open tab found. Please create a tab first."

## Debug Information

Added console logging to help troubleshoot:
```typescript
console.log('Payment context:', { 
  barId, 
  customerIdentifier, 
  deviceId, 
  tabData: currentTab 
});
```

This helps identify issues with:
- Missing session data
- Incorrect device ID
- Malformed customer identifier

## Testing

To test the fix:
1. Ensure customer has an active tab
2. Check browser storage for required data:
   - `sessionStorage`: `currentTab` with `bar_id`
   - `localStorage`: `tabeza_device_id_v2` or `Tabeza_device_id`
3. Attempt M-Pesa payment
4. Check browser console for debug information
5. Verify API call uses correct format

## Backward Compatibility

The fix maintains backward compatibility:
- Staff app can still use UUID-based lookups
- Existing tab resolution methods still work
- Only customer payment flow uses new customer-context resolution

## Next Steps

1. **Remove Debug Logging**: Once confirmed working, remove console.log statements
2. **Monitor Performance**: Ensure session/localStorage access doesn't impact performance
3. **Error Analytics**: Track common error patterns to improve UX
4. **Documentation**: Update customer app documentation with new flow

The fix ensures customers can make M-Pesa payments using their natural context (device + bar) without needing to know internal UUIDs, while maintaining the security and multi-tenancy benefits of the tenant credential system.