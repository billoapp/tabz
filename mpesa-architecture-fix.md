# M-PESA Architecture Fix

## Current Issue
The M-PESA transactions table links to `order_id`, but customers actually pay against their tab balance, not individual orders.

## Recommended Changes

### 1. Change M-PESA Transaction Model
```sql
-- Change from order_id to tab_id
ALTER TABLE mpesa_transactions 
DROP COLUMN order_id,
ADD COLUMN tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX idx_mpesa_transactions_order_id;
CREATE INDEX idx_mpesa_transactions_tab_id ON mpesa_transactions(tab_id);
```

### 2. Update Function Names and Logic
- `getTransactionByOrderId` → `getTransactionByTabId`
- `getTransactionsForOrder` → `getTransactionsForTab`

### 3. Payment Flow Integration
When M-PESA payment completes:
1. Create/update record in `tab_payments` table
2. Link M-PESA transaction to the tab payment
3. Update tab balance accordingly

### 4. Revised Transaction Model
```typescript
interface Transaction {
  id: string;
  tabId: string;        // Changed from orderId
  customerId: string;
  phoneNumber: string;
  amount: number;       // Amount customer is paying toward tab
  // ... rest remains same
}
```

## Benefits
- Aligns with existing payment model
- Supports partial payments
- Supports paying for multiple orders at once
- Maintains consistency with tab_payments table