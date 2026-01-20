-- Fix M-Pesa credentials implementation
-- Remove problematic view and ensure clean setup

-- Drop view if it exists (might be causing issues)
DROP VIEW IF EXISTS mpesa_credentials_safe;

-- Ensure mpesa_credentials table exists with correct structure
CREATE TABLE IF NOT EXISTS mpesa_credentials (
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

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_mpesa_credentials_tenant_id ON mpesa_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_credentials_environment ON mpesa_credentials(environment);
CREATE INDEX IF NOT EXISTS idx_mpesa_credentials_active ON mpesa_credentials(is_active);

-- Ensure RLS is enabled
ALTER TABLE mpesa_credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "tenant_insert_own_mpesa_creds" ON mpesa_credentials;
DROP POLICY IF EXISTS "tenant_cannot_read_mpesa_creds" ON mpesa_credentials;
DROP POLICY IF EXISTS "tenant_update_own_mpesa_creds" ON mpesa_credentials;
DROP POLICY IF EXISTS "tenant_delete_own_mpesa_creds" ON mpesa_credentials;

-- Recreate policies
CREATE POLICY "tenant_insert_own_mpesa_creds" ON mpesa_credentials
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

CREATE POLICY "tenant_cannot_read_mpesa_creds" ON mpesa_credentials
    FOR SELECT USING (false);

CREATE POLICY "tenant_update_own_mpesa_creds" ON mpesa_credentials
    FOR UPDATE USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

CREATE POLICY "tenant_delete_own_mpesa_creds" ON mpesa_credentials
    FOR DELETE USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Ensure audit table exists
CREATE TABLE IF NOT EXISTS mpesa_credential_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID REFERENCES mpesa_credentials(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'tested', 'rotated', 'deleted')),
    event_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit table
ALTER TABLE mpesa_credential_events ENABLE ROW LEVEL SECURITY;

-- Drop existing audit policies
DROP POLICY IF EXISTS "users_view_own_mpesa_audit" ON mpesa_credential_events;

-- Recreate audit policy
CREATE POLICY "users_view_own_mpesa_audit" ON mpesa_credential_events
    FOR SELECT USING (
        tenant_id IN (
            SELECT ub.bar_id 
            FROM user_bars ub 
            WHERE ub.user_id = auth.uid()
        )
    );

-- Ensure trigger function exists
CREATE OR REPLACE FUNCTION update_mpesa_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_mpesa_credentials_updated_at ON mpesa_credentials;

-- Recreate trigger
CREATE TRIGGER trigger_update_mpesa_credentials_updated_at
    BEFORE UPDATE ON mpesa_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_credentials_updated_at();