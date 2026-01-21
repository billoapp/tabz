-- Create M-PESA rate limiting and audit logging tables
-- This migration adds comprehensive rate limiting and abuse prevention infrastructure

-- Create rate limit logs table for tracking payment attempts and blocks
CREATE TABLE IF NOT EXISTS mpesa_rate_limit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT,
    amount DECIMAL(10,2),
    ip_address INET,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'failed_attempt',
        'successful_payment', 
        'customer_blocked',
        'customer_unblocked',
        'ip_blocked',
        'ip_unblocked',
        'suspicious_activity'
    )),
    reason TEXT,
    blocked_until TIMESTAMPTZ,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_mpesa_rate_limit_logs_customer_id ON mpesa_rate_limit_logs(customer_id);
CREATE INDEX idx_mpesa_rate_limit_logs_event_type ON mpesa_rate_limit_logs(event_type);
CREATE INDEX idx_mpesa_rate_limit_logs_created_at ON mpesa_rate_limit_logs(created_at);
CREATE INDEX idx_mpesa_rate_limit_logs_ip_address ON mpesa_rate_limit_logs(ip_address);
CREATE INDEX idx_mpesa_rate_limit_logs_phone_number ON mpesa_rate_limit_logs(phone_number);

-- Create composite index for customer activity analysis
CREATE INDEX idx_mpesa_rate_limit_logs_customer_activity 
ON mpesa_rate_limit_logs(customer_id, event_type, created_at);

-- Create composite index for IP activity analysis
CREATE INDEX idx_mpesa_rate_limit_logs_ip_activity 
ON mpesa_rate_limit_logs(ip_address, event_type, created_at);

-- Enable Row Level Security
ALTER TABLE mpesa_rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rate limit logs
-- Only service role can access rate limit logs (admin/system access only)
CREATE POLICY "Service role can manage rate limit logs" ON mpesa_rate_limit_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Staff can view rate limit logs for monitoring (read-only)
CREATE POLICY "Staff can view rate limit logs" ON mpesa_rate_limit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_bars ub 
            WHERE ub.user_id = auth.uid() 
            AND ub.role IN ('owner', 'manager')
        )
    );

-- Create function to clean up old rate limit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete logs older than 90 days
    DELETE FROM mpesa_rate_limit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Log cleanup activity
    INSERT INTO mpesa_rate_limit_logs (event_type, reason, metadata)
    VALUES ('cleanup', 'Automated cleanup of old rate limit logs', 
            jsonb_build_object('cleaned_at', NOW()));
END;
$$;

-- Create function to get rate limit statistics
CREATE OR REPLACE FUNCTION get_rate_limit_stats(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_attempts BIGINT,
    failed_attempts BIGINT,
    successful_payments BIGINT,
    blocked_customers BIGINT,
    blocked_ips BIGINT,
    suspicious_activities BIGINT,
    unique_customers BIGINT,
    unique_ips BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE event_type = 'failed_attempt') as failed_attempts,
        COUNT(*) FILTER (WHERE event_type = 'successful_payment') as successful_payments,
        COUNT(*) FILTER (WHERE event_type = 'customer_blocked') as blocked_customers,
        COUNT(*) FILTER (WHERE event_type = 'ip_blocked') as blocked_ips,
        COUNT(*) FILTER (WHERE event_type = 'suspicious_activity') as suspicious_activities,
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(DISTINCT ip_address) as unique_ips
    FROM mpesa_rate_limit_logs
    WHERE created_at BETWEEN start_date AND end_date;
END;
$$;

-- Create function to get customer activity summary
CREATE OR REPLACE FUNCTION get_customer_activity_summary(
    target_customer_id UUID,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    customer_id UUID,
    total_attempts BIGINT,
    failed_attempts BIGINT,
    successful_payments BIGINT,
    unique_phone_numbers BIGINT,
    unique_ip_addresses BIGINT,
    is_currently_blocked BOOLEAN,
    last_activity TIMESTAMPTZ,
    risk_indicators JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_start TIMESTAMPTZ := NOW() - (hours_back || ' hours')::INTERVAL;
    is_blocked BOOLEAN := FALSE;
BEGIN
    -- Check if customer is currently blocked
    SELECT EXISTS (
        SELECT 1 FROM mpesa_rate_limit_logs 
        WHERE customer_id = target_customer_id 
        AND event_type = 'customer_blocked'
        AND blocked_until > NOW()
        ORDER BY created_at DESC 
        LIMIT 1
    ) INTO is_blocked;

    RETURN QUERY
    SELECT 
        target_customer_id,
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE event_type = 'failed_attempt') as failed_attempts,
        COUNT(*) FILTER (WHERE event_type = 'successful_payment') as successful_payments,
        COUNT(DISTINCT phone_number) as unique_phone_numbers,
        COUNT(DISTINCT ip_address) as unique_ip_addresses,
        is_blocked as is_currently_blocked,
        MAX(created_at) as last_activity,
        jsonb_build_object(
            'failure_rate', 
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND((COUNT(*) FILTER (WHERE event_type = 'failed_attempt'))::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
                ELSE 0 
            END,
            'avg_risk_score', 
            COALESCE(AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL), 0),
            'rapid_requests', 
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') > 5
        ) as risk_indicators
    FROM mpesa_rate_limit_logs
    WHERE customer_id = target_customer_id 
    AND created_at >= activity_start
    GROUP BY target_customer_id;
END;
$$;

-- Create function to detect suspicious patterns across all customers
CREATE OR REPLACE FUNCTION detect_suspicious_patterns(
    hours_back INTEGER DEFAULT 1
)
RETURNS TABLE (
    customer_id UUID,
    phone_number TEXT,
    ip_address INET,
    pattern_type TEXT,
    risk_score INTEGER,
    evidence JSONB,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_start TIMESTAMPTZ := NOW() - (hours_back || ' hours')::INTERVAL;
BEGIN
    -- Return customers with suspicious patterns
    RETURN QUERY
    WITH customer_patterns AS (
        SELECT 
            l.customer_id,
            l.phone_number,
            l.ip_address,
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE event_type = 'failed_attempt') as failed_attempts,
            COUNT(DISTINCT l.phone_number) as unique_phones,
            COUNT(DISTINCT l.ip_address) as unique_ips,
            MIN(l.created_at) as first_seen,
            MAX(l.created_at) as last_seen,
            ARRAY_AGG(DISTINCT l.amount ORDER BY l.amount) as amounts
        FROM mpesa_rate_limit_logs l
        WHERE l.created_at >= activity_start
        AND l.customer_id IS NOT NULL
        GROUP BY l.customer_id, l.phone_number, l.ip_address
    )
    SELECT 
        cp.customer_id,
        cp.phone_number,
        cp.ip_address,
        CASE 
            WHEN cp.failed_attempts::NUMERIC / cp.total_attempts > 0.7 THEN 'high_failure_rate'
            WHEN cp.unique_phones > 3 THEN 'multiple_phone_numbers'
            WHEN cp.unique_ips > 3 THEN 'multiple_ip_addresses'
            WHEN cp.total_attempts > 10 THEN 'rapid_fire_requests'
            ELSE 'other'
        END as pattern_type,
        CASE 
            WHEN cp.failed_attempts::NUMERIC / cp.total_attempts > 0.7 THEN 80
            WHEN cp.unique_phones > 3 THEN 70
            WHEN cp.unique_ips > 3 THEN 60
            WHEN cp.total_attempts > 10 THEN 50
            ELSE 30
        END as risk_score,
        jsonb_build_object(
            'total_attempts', cp.total_attempts,
            'failed_attempts', cp.failed_attempts,
            'failure_rate', ROUND(cp.failed_attempts::NUMERIC / cp.total_attempts * 100, 2),
            'unique_phones', cp.unique_phones,
            'unique_ips', cp.unique_ips,
            'amount_range', jsonb_build_object(
                'min', (SELECT MIN(amount) FROM unnest(cp.amounts) as amount),
                'max', (SELECT MAX(amount) FROM unnest(cp.amounts) as amount)
            )
        ) as evidence,
        cp.first_seen,
        cp.last_seen
    FROM customer_patterns cp
    WHERE (
        cp.failed_attempts::NUMERIC / cp.total_attempts > 0.7 OR
        cp.unique_phones > 3 OR
        cp.unique_ips > 3 OR
        cp.total_attempts > 10
    )
    ORDER BY risk_score DESC, cp.last_seen DESC;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON mpesa_rate_limit_logs TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limit_logs() TO service_role;
GRANT EXECUTE ON FUNCTION get_rate_limit_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_customer_activity_summary(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION detect_suspicious_patterns(INTEGER) TO service_role;

-- Create a scheduled job to clean up old logs (if pg_cron is available)
-- This will run daily at 2 AM to clean up logs older than 90 days
-- SELECT cron.schedule('cleanup-rate-limit-logs', '0 2 * * *', 'SELECT cleanup_old_rate_limit_logs();');

-- Add comment for documentation
COMMENT ON TABLE mpesa_rate_limit_logs IS 'Stores rate limiting events, payment attempts, and security monitoring data for M-PESA integration';
COMMENT ON FUNCTION cleanup_old_rate_limit_logs() IS 'Automated cleanup function for old rate limit logs (90+ days)';
COMMENT ON FUNCTION get_rate_limit_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns rate limiting statistics for monitoring dashboard';
COMMENT ON FUNCTION get_customer_activity_summary(UUID, INTEGER) IS 'Returns detailed activity summary for a specific customer';
COMMENT ON FUNCTION detect_suspicious_patterns(INTEGER) IS 'Detects suspicious payment patterns across all customers';