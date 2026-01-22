-- Create M-PESA transactions table for transaction state management
-- This table tracks all M-PESA payment transactions and their states

-- Create transaction status enum
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'pending',
        'sent', 
        'completed',
        'failed',
        'cancelled',
        'timeout'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create M-PESA transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core transaction data
    order_id UUID NOT NULL REFERENCES tab_orders(id) ON DELETE CASCADE,
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
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(checkout_request_id), -- Prevent duplicate checkout requests
    UNIQUE(mpesa_receipt_number) -- Prevent duplicate receipts
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_order_id ON mpesa_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_phone ON mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_receipt ON mpesa_transactions(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created ON mpesa_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_environment ON mpesa_transactions(environment);

-- Enable RLS
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - transactions are isolated by bar through order relationship
CREATE POLICY "bar_isolation_mpesa_transactions" ON mpesa_transactions
    FOR ALL
    USING (
        order_id IN (
            SELECT o.id 
            FROM tab_orders o
            JOIN tabs t ON o.tab_id = t.id
            WHERE t.bar_id = current_setting('app.current_bar_id', true)::UUID
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Create transaction state transition validation function
CREATE OR REPLACE FUNCTION validate_transaction_state_transition()
RETURNS TRIGGER AS $
DECLARE
    old_status transaction_status;
    new_status transaction_status;
BEGIN
    -- Allow all transitions for INSERT
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    old_status := OLD.status;
    new_status := NEW.status;
    
    -- If status hasn't changed, allow update
    IF old_status = new_status THEN
        RETURN NEW;
    END IF;
    
    -- Define valid state transitions
    CASE old_status
        WHEN 'pending' THEN
            -- From pending: can go to sent
            IF new_status NOT IN ('sent') THEN
                RAISE EXCEPTION 'Invalid state transition from % to %', old_status, new_status;
            END IF;
            
        WHEN 'sent' THEN
            -- From sent: can go to completed, failed, cancelled, or timeout
            IF new_status NOT IN ('completed', 'failed', 'cancelled', 'timeout') THEN
                RAISE EXCEPTION 'Invalid state transition from % to %', old_status, new_status;
            END IF;
            
        WHEN 'failed', 'cancelled', 'timeout' THEN
            -- From failed/cancelled/timeout: can go back to pending for retry
            IF new_status NOT IN ('pending') THEN
                RAISE EXCEPTION 'Invalid state transition from % to %', old_status, new_status;
            END IF;
            
        WHEN 'completed' THEN
            -- Completed transactions cannot change state
            RAISE EXCEPTION 'Cannot change state of completed transaction from % to %', old_status, new_status;
            
        ELSE
            RAISE EXCEPTION 'Unknown transaction status: %', old_status;
    END CASE;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create state transition validation trigger
CREATE TRIGGER trigger_validate_transaction_state_transition
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_transaction_state_transition();

-- Create function to handle transaction timeouts
CREATE OR REPLACE FUNCTION handle_transaction_timeouts()
RETURNS INTEGER AS $
DECLARE
    timeout_count INTEGER := 0;
BEGIN
    -- Update transactions that have been in 'sent' status for more than 5 minutes
    UPDATE mpesa_transactions
    SET 
        status = 'timeout',
        failure_reason = 'Transaction timed out after 5 minutes',
        updated_at = NOW()
    WHERE 
        status = 'sent' 
        AND created_at < NOW() - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS timeout_count = ROW_COUNT;
    
    RETURN timeout_count;
END;
$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE mpesa_transactions IS 'M-PESA payment transactions with state management';
COMMENT ON COLUMN mpesa_transactions.status IS 'Transaction state: pending -> sent -> (completed|failed|cancelled|timeout)';
COMMENT ON COLUMN mpesa_transactions.checkout_request_id IS 'Unique ID from M-PESA STK Push response';
COMMENT ON COLUMN mpesa_transactions.mpesa_receipt_number IS 'Receipt number from successful M-PESA payment';
COMMENT ON COLUMN mpesa_transactions.callback_data IS 'Raw callback data from M-PESA for debugging';
COMMENT ON FUNCTION validate_transaction_state_transition() IS 'Enforces valid state transitions for transactions';
COMMENT ON FUNCTION handle_transaction_timeouts() IS 'Updates sent transactions to timeout after 5 minutes';

-- Verify table creation
SELECT 'M-PESA transactions table created successfully!' AS status;