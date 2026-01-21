-- Create M-PESA audit logging table with encryption support
-- This migration adds comprehensive audit logging infrastructure for compliance and security

-- Create audit logs table
CREATE TABLE IF NOT EXISTS mpesa_audit_logs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'payment_initiated',
        'payment_completed', 
        'payment_failed',
        'payment_cancelled',
        'payment_timeout',
        'callback_received',
        'callback_processed',
        'callback_failed',
        'credentials_accessed',
        'credentials_updated',
        'environment_switched',
        'rate_limit_triggered',
        'suspicious_activity',
        'admin_action',
        'system_error'
    )),
    
    -- Entity references
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    transaction_id TEXT,
    tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Staff user
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT,
    
    -- Event data (non-sensitive)
    event_data JSONB DEFAULT '{}',
    
    -- Sensitive data (encrypted)
    sensitive_data JSONB DEFAULT '{}',
    
    -- Environment and context
    environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Classification
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    category TEXT NOT NULL CHECK (category IN ('payment', 'security', 'admin', 'system')),
    
    -- Compliance and retention
    retention_period INTEGER DEFAULT 2555, -- Days to retain (default 7 years)
    compliance_flags TEXT[] DEFAULT '{}',
    
    -- Encryption metadata
    encryption_version TEXT,
    encrypted_fields TEXT[] DEFAULT '{}',
    
    -- Audit trail integrity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    hash_signature TEXT -- For tamper detection
);

-- Create indexes for efficient querying
CREATE INDEX idx_mpesa_audit_logs_event_type ON mpesa_audit_logs(event_type);
CREATE INDEX idx_mpesa_audit_logs_customer_id ON mpesa_audit_logs(customer_id);
CREATE INDEX idx_mpesa_audit_logs_transaction_id ON mpesa_audit_logs(transaction_id);
CREATE INDEX idx_mpesa_audit_logs_user_id ON mpesa_audit_logs(user_id);
CREATE INDEX idx_mpesa_audit_logs_timestamp ON mpesa_audit_logs(timestamp);
CREATE INDEX idx_mpesa_audit_logs_severity ON mpesa_audit_logs(severity);
CREATE INDEX idx_mpesa_audit_logs_category ON mpesa_audit_logs(category);
CREATE INDEX idx_mpesa_audit_logs_environment ON mpesa_audit_logs(environment);
CREATE INDEX idx_mpesa_audit_logs_ip_address ON mpesa_audit_logs(ip_address);

-- Create composite indexes for common queries
CREATE INDEX idx_mpesa_audit_logs_customer_activity 
ON mpesa_audit_logs(customer_id, event_type, timestamp);

CREATE INDEX idx_mpesa_audit_logs_transaction_trail 
ON mpesa_audit_logs(transaction_id, timestamp);

CREATE INDEX idx_mpesa_audit_logs_security_events 
ON mpesa_audit_logs(category, severity, timestamp) 
WHERE category = 'security';

CREATE INDEX idx_mpesa_audit_logs_payment_events 
ON mpesa_audit_logs(category, event_type, timestamp) 
WHERE category = 'payment';

-- Create index for compliance queries
CREATE INDEX idx_mpesa_audit_logs_compliance 
ON mpesa_audit_logs USING GIN(compliance_flags);

-- Create index for retention cleanup
CREATE INDEX idx_mpesa_audit_logs_retention 
ON mpesa_audit_logs(created_at, retention_period);

-- Enable Row Level Security
ALTER TABLE mpesa_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit logs
-- Service role has full access (for system operations)
CREATE POLICY "Service role can manage audit logs" ON mpesa_audit_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Staff can view audit logs for their bar (read-only)
CREATE POLICY "Staff can view audit logs" ON mpesa_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_bars ub 
            WHERE ub.user_id = auth.uid() 
            AND ub.role IN ('owner', 'manager')
        )
    );

-- Customers can view their own payment audit logs (limited fields)
CREATE POLICY "Customers can view own payment logs" ON mpesa_audit_logs
    FOR SELECT USING (
        customer_id = auth.uid() 
        AND category = 'payment'
        AND event_type IN ('payment_initiated', 'payment_completed', 'payment_failed')
    );

-- Create function to generate hash signature for audit integrity
CREATE OR REPLACE FUNCTION generate_audit_hash(
    audit_id TEXT,
    event_type TEXT,
    timestamp TIMESTAMPTZ,
    event_data JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Generate SHA-256 hash of key audit fields for integrity verification
    RETURN encode(
        digest(
            audit_id || event_type || timestamp::TEXT || event_data::TEXT,
            'sha256'
        ),
        'hex'
    );
END;
$$;

-- Create trigger to automatically generate hash signature
CREATE OR REPLACE FUNCTION set_audit_hash_signature()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.hash_signature := generate_audit_hash(
        NEW.id,
        NEW.event_type,
        NEW.timestamp,
        NEW.event_data
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_audit_hash_signature
    BEFORE INSERT OR UPDATE ON mpesa_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_hash_signature();

-- Create function to verify audit log integrity
CREATE OR REPLACE FUNCTION verify_audit_integrity(audit_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_record RECORD;
    expected_hash TEXT;
BEGIN
    -- Get the audit log record
    SELECT * INTO log_record
    FROM mpesa_audit_logs
    WHERE id = audit_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate expected hash
    expected_hash := generate_audit_hash(
        log_record.id,
        log_record.event_type,
        log_record.timestamp,
        log_record.event_data
    );
    
    -- Compare with stored hash
    RETURN log_record.hash_signature = expected_hash;
END;
$$;

-- Create function to clean up expired audit logs based on retention period
CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete logs that have exceeded their retention period
    WITH expired_logs AS (
        DELETE FROM mpesa_audit_logs
        WHERE created_at < NOW() - (retention_period || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM expired_logs;
    
    -- Log the cleanup activity
    INSERT INTO mpesa_audit_logs (
        id,
        event_type,
        event_data,
        environment,
        severity,
        category,
        retention_period
    ) VALUES (
        'cleanup_' || extract(epoch from now())::bigint || '_' || floor(random() * 1000)::int,
        'system_error', -- Using system_error as closest match for cleanup
        jsonb_build_object(
            'action', 'audit_log_cleanup',
            'deleted_count', deleted_count,
            'cleanup_timestamp', NOW()
        ),
        COALESCE(current_setting('app.mpesa_environment', true), 'sandbox'),
        'info',
        'system',
        90 -- Cleanup logs retained for 90 days
    );
    
    RETURN deleted_count;
END;
$$;

-- Create function to get audit trail for a transaction
CREATE OR REPLACE FUNCTION get_transaction_audit_trail(target_transaction_id TEXT)
RETURNS TABLE (
    id TEXT,
    event_type TEXT,
    timestamp TIMESTAMPTZ,
    severity TEXT,
    event_data JSONB,
    user_id UUID,
    ip_address INET
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.event_type,
        a.timestamp,
        a.severity,
        a.event_data,
        a.user_id,
        a.ip_address
    FROM mpesa_audit_logs a
    WHERE a.transaction_id = target_transaction_id
    ORDER BY a.timestamp ASC;
END;
$$;

-- Create function to get customer audit summary
CREATE OR REPLACE FUNCTION get_customer_audit_summary(
    target_customer_id UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_events BIGINT,
    payment_events BIGINT,
    security_events BIGINT,
    failed_payments BIGINT,
    successful_payments BIGINT,
    last_activity TIMESTAMPTZ,
    risk_indicators JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date TIMESTAMPTZ := NOW() - (days_back || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE category = 'payment') as payment_events,
        COUNT(*) FILTER (WHERE category = 'security') as security_events,
        COUNT(*) FILTER (WHERE event_type = 'payment_failed') as failed_payments,
        COUNT(*) FILTER (WHERE event_type = 'payment_completed') as successful_payments,
        MAX(timestamp) as last_activity,
        jsonb_build_object(
            'failure_rate', 
            CASE 
                WHEN COUNT(*) FILTER (WHERE category = 'payment') > 0 THEN
                    ROUND(
                        (COUNT(*) FILTER (WHERE event_type = 'payment_failed'))::NUMERIC / 
                        (COUNT(*) FILTER (WHERE category = 'payment'))::NUMERIC * 100, 
                        2
                    )
                ELSE 0 
            END,
            'security_events_count', COUNT(*) FILTER (WHERE category = 'security'),
            'recent_activity_count', COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours'),
            'unique_ip_addresses', COUNT(DISTINCT ip_address)
        ) as risk_indicators
    FROM mpesa_audit_logs
    WHERE customer_id = target_customer_id 
    AND timestamp >= start_date;
END;
$$;

-- Create function to detect audit anomalies
CREATE OR REPLACE FUNCTION detect_audit_anomalies(
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    anomaly_type TEXT,
    description TEXT,
    severity TEXT,
    count BIGINT,
    first_occurrence TIMESTAMPTZ,
    last_occurrence TIMESTAMPTZ,
    affected_entities JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_time TIMESTAMPTZ := NOW() - (hours_back || ' hours')::INTERVAL;
BEGIN
    RETURN QUERY
    -- High failure rate anomaly
    SELECT 
        'high_failure_rate'::TEXT as anomaly_type,
        'Unusually high payment failure rate detected'::TEXT as description,
        'error'::TEXT as severity,
        COUNT(*) as count,
        MIN(timestamp) as first_occurrence,
        MAX(timestamp) as last_occurrence,
        jsonb_build_object(
            'failure_rate', 
            ROUND((COUNT(*) FILTER (WHERE event_type = 'payment_failed'))::NUMERIC / COUNT(*)::NUMERIC * 100, 2),
            'total_payments', COUNT(*)
        ) as affected_entities
    FROM mpesa_audit_logs
    WHERE timestamp >= start_time
    AND category = 'payment'
    AND event_type IN ('payment_failed', 'payment_completed')
    HAVING COUNT(*) > 10 AND (COUNT(*) FILTER (WHERE event_type = 'payment_failed'))::NUMERIC / COUNT(*)::NUMERIC > 0.5
    
    UNION ALL
    
    -- Multiple security events from same IP
    SELECT 
        'suspicious_ip_activity'::TEXT as anomaly_type,
        'Multiple security events from same IP address'::TEXT as description,
        'warn'::TEXT as severity,
        COUNT(*) as count,
        MIN(timestamp) as first_occurrence,
        MAX(timestamp) as last_occurrence,
        jsonb_build_object(
            'ip_addresses', jsonb_agg(DISTINCT ip_address),
            'event_types', jsonb_agg(DISTINCT event_type)
        ) as affected_entities
    FROM mpesa_audit_logs
    WHERE timestamp >= start_time
    AND category = 'security'
    GROUP BY ip_address
    HAVING COUNT(*) > 5
    
    UNION ALL
    
    -- Rapid credential access
    SELECT 
        'rapid_credential_access'::TEXT as anomaly_type,
        'Rapid credential access attempts detected'::TEXT as description,
        'critical'::TEXT as severity,
        COUNT(*) as count,
        MIN(timestamp) as first_occurrence,
        MAX(timestamp) as last_occurrence,
        jsonb_build_object(
            'users', jsonb_agg(DISTINCT user_id),
            'access_count', COUNT(*)
        ) as affected_entities
    FROM mpesa_audit_logs
    WHERE timestamp >= start_time
    AND event_type = 'credentials_accessed'
    GROUP BY user_id
    HAVING COUNT(*) > 10;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON mpesa_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION generate_audit_hash(TEXT, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION verify_audit_integrity(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_audit_logs() TO service_role;
GRANT EXECUTE ON FUNCTION get_transaction_audit_trail(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_customer_audit_summary(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION detect_audit_anomalies(INTEGER) TO service_role;

-- Create a scheduled job to clean up expired audit logs (if pg_cron is available)
-- This will run daily at 3 AM to clean up expired audit logs
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *', 'SELECT cleanup_expired_audit_logs();');

-- Add comments for documentation
COMMENT ON TABLE mpesa_audit_logs IS 'Comprehensive audit logging for M-PESA transactions with encryption support and compliance features';
COMMENT ON COLUMN mpesa_audit_logs.sensitive_data IS 'Encrypted sensitive data fields (phone numbers, receipts, etc.)';
COMMENT ON COLUMN mpesa_audit_logs.hash_signature IS 'SHA-256 hash for audit trail integrity verification';
COMMENT ON COLUMN mpesa_audit_logs.retention_period IS 'Number of days to retain this audit log (compliance-based)';
COMMENT ON COLUMN mpesa_audit_logs.compliance_flags IS 'Compliance standards this log entry satisfies (PCI-DSS, GDPR, etc.)';

COMMENT ON FUNCTION cleanup_expired_audit_logs() IS 'Automated cleanup of expired audit logs based on retention periods';
COMMENT ON FUNCTION verify_audit_integrity(TEXT) IS 'Verifies audit log integrity using hash signatures';
COMMENT ON FUNCTION get_transaction_audit_trail(TEXT) IS 'Returns complete audit trail for a specific transaction';
COMMENT ON FUNCTION detect_audit_anomalies(INTEGER) IS 'Detects suspicious patterns in audit logs for security monitoring';