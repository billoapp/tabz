-- Fix M-PESA transactions to work with tab-level payments instead of order-level
-- This aligns with the existing payment model where customers pay against their tab balance

-- Drop the existing mpesa_transactions table and recreate with correct structure
DROP TABLE IF EXISTS mpesa_transactions CASCADE;

-- Recreate with tab-level payments
CREATE TABLE mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core transaction data - linked to tab, not order
    tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    customer_id TEXT, -- Phone hash or identifier  
    phone_number TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
    
    -- Transaction state
    status transaction_status NOT NULL DEFAULT 'pending',
    
    -- M-PESA specific data
    checkout_request_id TEXT, -- From STK Push response
    merchant_request_id TEXT, -- From STK Push response
    mpesa_receipt_number TEXT, -- From successful callback
    transaction_date TIMESTAMPTZ, -- From callback
    
    -- Error handling
    failure_reason TEXT, -- From failed callback
    result_code INTEGER, -- M-PESA result code
    
    -- Environment and metadata
    environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
    callback_data JSONB, -- Raw callback data for debugging
    
    -- Link to tab_payments table when payment completes
    tab_payment_id UUID REFERENCES tab_payments(id) ON DELETE SET NULL,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(checkout_request_id), -- Prevent duplicate checkout requests
    UNIQUE(mpesa_receipt_number) -- Prevent duplicate receipts
);

-- Create indexes for performance
CREATE INDEX idx_mpesa_transactions_tab_id ON mpesa_transactions(tab_id);
CREATE INDEX idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX idx_mpesa_transactions_phone ON mpesa_transactions(phone_number);
CREATE INDEX idx_mpesa_transactions_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_receipt ON mpesa_transactions(mpesa_receipt_number);
CREATE INDEX idx_mpesa_transactions_created ON mpesa_transactions(created_at DESC);
CREATE INDEX idx_mpesa_transactions_environment ON mpesa_transactions(environment);
CREATE INDEX idx_mpesa_transactions_payment ON mpesa_transactions(tab_payment_id);

-- Enable RLS
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - transactions are isolated by bar through tab relationship
CREATE POLICY "bar_isolation_mpesa_transactions" ON mpesa_transactions
    FOR ALL
    USING (
        tab_id IN (
            SELECT t.id 
            FROM tabs t
            WHERE t.bar_id = current_setting('app.current_bar_id', true)::UUID
        )
    );

-- Create updated_at trigger
CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Create state transition validation trigger
CREATE TRIGGER trigger_validate_transaction_state_transition
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_transaction_state_transition();

-- Create function to handle successful M-PESA payment completion
CREATE OR REPLACE FUNCTION complete_mpesa_payment(
    p_transaction_id UUID,
    p_mpesa_receipt_number TEXT,
    p_transaction_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $
DECLARE
    v_tab_id UUID;
    v_amount NUMERIC(10,2);
    v_payment_id UUID;
BEGIN
    -- Get transaction details
    SELECT tab_id, amount INTO v_tab_id, v_amount
    FROM mpesa_transactions
    WHERE id = p_transaction_id AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or not in sent status';
    END IF;
    
    -- Create payment record in tab_payments
    INSERT INTO tab_payments (
        tab_id,
        amount,
        method,
        status,
        reference,
        metadata
    ) VALUES (
        v_tab_id,
        v_amount,
        'mpesa',
        'success',
        p_mpesa_receipt_number,
        jsonb_build_object(
            'mpesa_transaction_id', p_transaction_id,
            'mpesa_receipt_number', p_mpesa_receipt_number,
            'transaction_date', p_transaction_date
        )
    ) RETURNING id INTO v_payment_id;
    
    -- Update M-PESA transaction
    UPDATE mpesa_transactions
    SET 
        status = 'completed',
        mpesa_receipt_number = p_mpesa_receipt_number,
        transaction_date = p_transaction_date,
        tab_payment_id = v_payment_id,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    RETURN v_payment_id;
END;
$ LANGUAGE plpgsql;

-- Create function to handle failed M-PESA payments
CREATE OR REPLACE FUNCTION fail_mpesa_payment(
    p_transaction_id UUID,
    p_failure_reason TEXT,
    p_result_code INTEGER DEFAULT NULL
)
RETURNS VOID AS $
BEGIN
    -- Update M-PESA transaction to failed status
    UPDATE mpesa_transactions
    SET 
        status = 'failed',
        failure_reason = p_failure_reason,
        result_code = p_result_code,
        updated_at = NOW()
    WHERE id = p_transaction_id AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or not in sent status';
    END IF;
END;
$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE mpesa_transactions IS 'M-PESA payment transactions linked to tabs (not individual orders)';
COMMENT ON COLUMN mpesa_transactions.tab_id IS 'Tab that this payment is for - customers pay against tab balance';
COMMENT ON COLUMN mpesa_transactions.amount IS 'Amount customer is paying toward their tab (can be partial payment)';
COMMENT ON COLUMN mpesa_transactions.tab_payment_id IS 'Link to tab_payments record created when payment completes';
COMMENT ON FUNCTION complete_mpesa_payment IS 'Completes M-PESA payment and creates tab_payments record';
COMMENT ON FUNCTION fail_mpesa_payment IS 'Marks M-PESA payment as failed with reason';

-- Verify table creation
SELECT 'M-PESA transactions table fixed for tab-level payments!' AS status;