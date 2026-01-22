# M-PESA Tab-Level Payment Architecture Fix

## Summary of Changes Made

### 1. Database Schema (Migration 046)
- ✅ Changed `mpesa_transactions.order_id` → `mpesa_transactions.tab_id`
- ✅ Added `tab_payment_id` field to link to `tab_payments` table
- ✅ Created helper functions `complete_mpesa_payment()` and `fail_mpesa_payment()`
- ✅ Updated RLS policies to work with tab-based isolation

### 2. TypeScript Types
- ✅ Updated `Transaction` interface: `orderId` → `tabId`
- ✅ Added `tabPaymentId` field to Transaction interface
- ✅ Updated `CreateTransactionData` interface

### 3. Transaction Service
- ✅ Updated `createTransaction()` to use `tab_id`
- ✅ Renamed `getTransactionByOrderId()` → `getTransactionByTabId()`
- ✅ Renamed `getTransactionsForOrder()` → `getTransactionsForTab()`
- ✅ Updated `mapDatabaseToTransaction()` for new fields

### 4. State Machine
- ✅ Updated `TransactionContext` interface: `orderId` → `tabId`
- ✅ Added `tabPaymentId` to context handling
- ✅ Updated context building and data mapping

## Still Need to Fix

### 5. Property-Based Tests
The tests still reference the old order-based model and need updating:

```typescript
// Need to update all test files:
// - transaction-persistence.property.test.ts
// - state-transitions.property.test.ts

// Change all references:
// orderId → tabId
// getTransactionByOrderId → getTransactionByTabId  
// getTransactionsForOrder → getTransactionsForTab
```

### 6. Integration Points
When implementing the customer UI and callback handling:

1. **Customer Payment Flow:**
   ```typescript
   // Customer pays against their tab balance, not individual orders
   const transaction = await transactionService.createTransaction({
     tabId: customerTab.id,
     phoneNumber: '254712345678',
     amount: 500, // Partial payment toward tab balance
     environment: 'sandbox'
   });
   ```

2. **Callback Processing:**
   ```typescript
   // When payment completes, create tab_payments record
   await complete_mpesa_payment(
     transactionId,
     mpesaReceiptNumber,
     transactionDate
   );
   ```

3. **Tab Balance Updates:**
   ```typescript
   // Tab balance is calculated from:
   // - Total orders amount
   // - Minus total payments (including M-PESA)
   const tabBalance = totalOrders - totalPayments;
   ```

## Benefits of This Architecture

1. **Aligns with Business Logic**: Customers pay against tab balance, not individual orders
2. **Supports Partial Payments**: Customer can pay any amount up to tab balance
3. **Integrates with Existing System**: Works with existing `tab_payments` table
4. **Maintains Audit Trail**: Full transaction history linked to both M-PESA and tab payments
5. **Flexible Payment Amounts**: Not constrained to exact order amounts

## Next Steps

1. Update the property-based tests to use tab-based model
2. Run the database migration to update the schema
3. Test the integration with existing tab/payment flows
4. Update any remaining references to order-based payments