-- Create the missing mpesa_rate_limit_logs table that the RateLimiter expects
-- This table is used for logging rate limit events and suspicious activity

CREATE TABLE IF NOT EXISTS public.mpesa_rate_limit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id text NULL,
  phone_number text NULL,
  amount numeric(10, 2) NULL,
  ip_address text NULL,
  event_type text NOT NULL,
  reason text NULL,
  blocked_until timestamp with time zone NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  
  CONSTRAINT mpesa_rate_limit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT mpesa_rate_limit_logs_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'failed_attempt'::text,
      'successful_payment'::text,
      'customer_blocked'::text,
      'customer_unblocked'::text,
      'suspicious_activity'::text
    ])
  )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mpesa_rate_limit_logs_customer_id 
  ON public.mpesa_rate_limit_logs USING btree (customer_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_mpesa_rate_limit_logs_phone_number 
  ON public.mpesa_rate_limit_logs USING btree (phone_number) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_mpesa_rate_limit_logs_event_type 
  ON public.mpesa_rate_limit_logs USING btree (event_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_mpesa_rate_limit_logs_created_at 
  ON public.mpesa_rate_limit_logs USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_mpesa_rate_limit_logs_ip_address 
  ON public.mpesa_rate_limit_logs USING btree (ip_address) TABLESPACE pg_default;

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE public.mpesa_rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
-- GRANT ALL ON public.mpesa_rate_limit_logs TO service_role;
-- GRANT SELECT, INSERT ON public.mpesa_rate_limit_logs TO authenticated;

-- Add comment
COMMENT ON TABLE public.mpesa_rate_limit_logs IS 'Logs for M-PESA rate limiting events, suspicious activity detection, and customer blocking';