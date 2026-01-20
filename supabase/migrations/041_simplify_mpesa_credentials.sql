-- Simplify M-Pesa credentials storage for STK Push
-- Remove encryption complexity - plain text storage is acceptable for STK Push credentials

-- Add plain text credential columns
ALTER TABLE bars 
ADD COLUMN mpesa_consumer_key TEXT,
ADD COLUMN mpesa_consumer_secret TEXT,
ADD COLUMN mpesa_passkey TEXT;

-- Update comments
COMMENT ON COLUMN bars.mpesa_consumer_key IS 'Daraja consumer key (plain text)';
COMMENT ON COLUMN bars.mpesa_consumer_secret IS 'Daraja consumer secret (plain text)';
COMMENT ON COLUMN bars.mpesa_passkey IS 'Daraja passkey (plain text)';

-- Note: We keep the encrypted columns for now to avoid breaking existing data
-- They can be dropped in a future migration once all data is migrated