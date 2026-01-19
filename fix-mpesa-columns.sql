-- Fix M-Pesa columns in bars table
-- Run this manually in Supabase SQL editor if migration 040 wasn't applied

-- Check if columns exist first, then add them if missing
DO $$ 
BEGIN
    -- Add mpesa_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_enabled') THEN
        ALTER TABLE bars ADD COLUMN mpesa_enabled BOOLEAN DEFAULT false;
    END IF;
    
    -- Add mpesa_environment column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_environment') THEN
        ALTER TABLE bars ADD COLUMN mpesa_environment VARCHAR(20) DEFAULT 'sandbox';
        ALTER TABLE bars ADD CONSTRAINT bars_mpesa_environment_check CHECK (mpesa_environment IN ('sandbox', 'production'));
    END IF;
    
    -- Add mpesa_business_shortcode column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_business_shortcode') THEN
        ALTER TABLE bars ADD COLUMN mpesa_business_shortcode VARCHAR(20);
    END IF;
    
    -- Add mpesa_consumer_key_encrypted column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_consumer_key_encrypted') THEN
        ALTER TABLE bars ADD COLUMN mpesa_consumer_key_encrypted TEXT;
    END IF;
    
    -- Add mpesa_consumer_secret_encrypted column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_consumer_secret_encrypted') THEN
        ALTER TABLE bars ADD COLUMN mpesa_consumer_secret_encrypted TEXT;
    END IF;
    
    -- Add mpesa_passkey_encrypted column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_passkey_encrypted') THEN
        ALTER TABLE bars ADD COLUMN mpesa_passkey_encrypted TEXT;
    END IF;
    
    -- Add mpesa_callback_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_callback_url') THEN
        ALTER TABLE bars ADD COLUMN mpesa_callback_url TEXT;
    END IF;
    
    -- Add mpesa_setup_completed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_setup_completed') THEN
        ALTER TABLE bars ADD COLUMN mpesa_setup_completed BOOLEAN DEFAULT false;
    END IF;
    
    -- Add mpesa_last_test_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_last_test_at') THEN
        ALTER TABLE bars ADD COLUMN mpesa_last_test_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add mpesa_test_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_test_status') THEN
        ALTER TABLE bars ADD COLUMN mpesa_test_status VARCHAR(20) DEFAULT 'pending';
        ALTER TABLE bars ADD CONSTRAINT bars_mpesa_test_status_check CHECK (mpesa_test_status IN ('pending', 'success', 'failed'));
    END IF;
END $$;

-- Create M-Pesa transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES tab_payments(id) ON DELETE CASCADE,
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    
    -- M-Pesa specific transaction details
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100) UNIQUE,
    mpesa_receipt_number VARCHAR(50),
    
    -- Transaction data
    phone_number VARCHAR(20) NOT NULL,
    account_reference VARCHAR(100) NOT NULL, -- Format: bar_id|tab_id
    
    -- Status tracking (mirrors tab_payments.status)
    result_code INTEGER,
    result_desc TEXT,
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    callback_received_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    callback_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_payment_id ON mpesa_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_bar_id ON mpesa_transactions(bar_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_phone ON mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created_at ON mpesa_transactions(created_at);

-- Add RLS policies
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their bar's M-Pesa transactions" ON mpesa_transactions;
DROP POLICY IF EXISTS "System can insert M-Pesa transactions" ON mpesa_transactions;
DROP POLICY IF EXISTS "System can update M-Pesa transactions" ON mpesa_transactions;

-- Policy: Users can only see transactions for their bar
CREATE POLICY "Users can view their bar's M-Pesa transactions" ON mpesa_transactions
    FOR SELECT USING (
        bar_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Policy: System can insert transactions (for API endpoints)
CREATE POLICY "System can insert M-Pesa transactions" ON mpesa_transactions
    FOR INSERT WITH CHECK (true);

-- Policy: System can update transactions (for callbacks)
CREATE POLICY "System can update M-Pesa transactions" ON mpesa_transactions
    FOR UPDATE USING (true);

-- Add trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Add trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_mpesa_transactions_updated_at ON mpesa_transactions;
CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN bars.mpesa_enabled IS 'Whether M-Pesa payments are enabled for this bar';
COMMENT ON COLUMN bars.mpesa_environment IS 'Daraja environment: sandbox or production';
COMMENT ON COLUMN bars.mpesa_business_shortcode IS 'PayBill or Till shortcode from Daraja';
COMMENT ON COLUMN bars.mpesa_consumer_key_encrypted IS 'Encrypted Daraja consumer key';
COMMENT ON COLUMN bars.mpesa_consumer_secret_encrypted IS 'Encrypted Daraja consumer secret';
COMMENT ON COLUMN bars.mpesa_passkey_encrypted IS 'Encrypted Daraja passkey';
COMMENT ON COLUMN bars.mpesa_callback_url IS 'Auto-generated callback URL for this tenant';
COMMENT ON COLUMN bars.mpesa_setup_completed IS 'Whether M-Pesa setup and testing is complete';
COMMENT ON COLUMN bars.mpesa_last_test_at IS 'Last time STK Push test was performed';
COMMENT ON COLUMN bars.mpesa_test_status IS 'Status of last M-Pesa test';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%' 
ORDER BY column_name;