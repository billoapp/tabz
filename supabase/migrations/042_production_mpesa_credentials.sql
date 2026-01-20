-- Production-grade M-Pesa credentials storage with proper encryption and RLS
-- Following multi-tenant security best practices

-- Create dedicated M-Pesa credentials table
CREATE TABLE mpesa_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
    business_shortcode TEXT NOT NULL,
    
    -- Encrypted fields (bytea for binary encrypted data)
    consumer_key_enc BYTEA NOT NULL,
    consumer_secret_enc BYTEA NOT NULL,
    passkey_enc BYTEA NOT NULL,
    
    -- Optional (for future B2C/B2B APIs)
    initiator_name TEXT,
    security_credential_enc BYTEA,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One credential set per tenant per environment
    UNIQUE (tenant_id, environment)
);

-- Add indexes for performance
CREATE INDEX idx_mpesa_credentials_tenant_id ON mpesa_credentials(tenant_id);
CREATE INDEX idx_mpesa_credentials_environment ON mpesa_credentials(environment);
CREATE INDEX idx_mpesa_credentials_active ON mpesa_credentials(is_active);

-- Enable Row Level Security (MANDATORY)
ALTER TABLE mpesa_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant can insert their own credentials
CREATE POLICY "tenant_insert_own_mpesa_creds" ON mpesa_credentials
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Policy: Tenant CANNOT select secrets (frontend cannot read)
CREATE POLICY "tenant_cannot_read_mpesa_creds" ON mpesa_credentials
    FOR SELECT USING (false);

-- Policy: Tenant can update their own credentials (for rotation)
CREATE POLICY "tenant_update_own_mpesa_creds" ON mpesa_credentials
    FOR UPDATE USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Policy: Tenant can delete their own credentials
CREATE POLICY "tenant_delete_own_mpesa_creds" ON mpesa_credentials
    FOR DELETE USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Note: Backend service role bypasses RLS and can do everything

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mpesa_credentials_updated_at
    BEFORE UPDATE ON mpesa_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_credentials_updated_at();

-- Add audit table for credential events (optional but recommended)
CREATE TABLE mpesa_credential_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES mpesa_credentials(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'tested', 'rotated', 'deleted')),
    event_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit table
ALTER TABLE mpesa_credential_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit events for their bars
CREATE POLICY "users_view_own_mpesa_audit" ON mpesa_credential_events
    FOR SELECT USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE mpesa_credentials IS 'Encrypted M-Pesa credentials per tenant per environment';
COMMENT ON COLUMN mpesa_credentials.tenant_id IS 'Reference to bars table (tenant)';
COMMENT ON COLUMN mpesa_credentials.environment IS 'Daraja environment: sandbox or production';
COMMENT ON COLUMN mpesa_credentials.business_shortcode IS 'PayBill or Till shortcode from Daraja';
COMMENT ON COLUMN mpesa_credentials.consumer_key_enc IS 'AES-256-GCM encrypted Daraja consumer key';
COMMENT ON COLUMN mpesa_credentials.consumer_secret_enc IS 'AES-256-GCM encrypted Daraja consumer secret';
COMMENT ON COLUMN mpesa_credentials.passkey_enc IS 'AES-256-GCM encrypted Daraja passkey';
COMMENT ON COLUMN mpesa_credentials.security_credential_enc IS 'Encrypted SecurityCredential for B2C/B2B APIs';
COMMENT ON COLUMN mpesa_credentials.is_active IS 'Whether these credentials are currently active';

-- Add helper view for frontend (shows only non-sensitive data)
CREATE VIEW mpesa_credentials_safe AS
SELECT 
    id,
    tenant_id,
    environment,
    business_shortcode,
    initiator_name,
    is_active,
    created_at,
    updated_at,
    -- Indicate presence of credentials without exposing them
    (consumer_key_enc IS NOT NULL) as has_consumer_key,
    (consumer_secret_enc IS NOT NULL) as has_consumer_secret,
    (passkey_enc IS NOT NULL) as has_passkey,
    (security_credential_enc IS NOT NULL) as has_security_credential
FROM mpesa_credentials;

-- Note: Views don't support RLS policies directly
-- Instead, we'll use a function for secure access