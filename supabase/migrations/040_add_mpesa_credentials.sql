-- Add M-Pesa credentials table for multi-tenant setup
-- Each bar (tenant) stores their own Daraja credentials

-- Add M-Pesa configuration columns to bars table
ALTER TABLE bars 
ADD COLUMN mpesa_enabled BOOLEAN DEFAULT false,
ADD COLUMN mpesa_environment VARCHAR(20) DEFAULT 'sandbox' CHECK (mpesa_environment IN ('sandbox', 'production')),
ADD COLUMN mpesa_business_shortcode VARCHAR(20),
ADD COLUMN mpesa_consumer_key_encrypted TEXT,
ADD COLUMN mpesa_consumer_secret_encrypted TEXT,
ADD COLUMN mpesa_passkey_encrypted TEXT,
ADD COLUMN mpesa_callback_url TEXT,
ADD COLUMN mpesa_setup_completed BOOLEAN DEFAULT false,
ADD COLUMN mpesa_last_test_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN mpesa_test_status VARCHAR(20) DEFAULT 'pending' CHECK (mpesa_test_status IN ('pending', 'success', 'failed'));

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

-- Create M-Pesa transactions table for tracking M-Pesa specific data
-- This links to the existing tab_payments table
CREATE TABLE mpesa_transactions (
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

-- Add indexes for performance
CREATE INDEX idx_mpesa_transactions_payment_id ON mpesa_transactions(payment_id);
CREATE INDEX idx_mpesa_transactions_bar_id ON mpesa_transactions(bar_id);
CREATE INDEX idx_mpesa_transactions_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_phone ON mpesa_transactions(phone_number);
CREATE INDEX idx_mpesa_transactions_created_at ON mpesa_transactions(created_at);

-- Add RLS policies
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

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

-- Update RLS policies for bars table to allow reading M-Pesa config
-- (The existing RLS policies should already cover the new columns)

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mpesa_transactions_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at();