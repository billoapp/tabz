-- Create devices table for robust device ID management
-- This table will store device information with Supabase as the source of truth
-- Enables device ID recovery after PWA uninstallation and cross-device sync

CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMPTZ WITH TIME ZONE DEFAULT NOW(),
  last_bar_id UUID NULL REFERENCES bars(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  suspicious_activity_count INTEGER DEFAULT 0,
  user_agent TEXT NULL,
  platform TEXT NULL,
  screen_resolution TEXT NULL,
  timezone TEXT NULL,
  
  -- Primary key constraint
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  
  -- Unique constraints for data integrity
  CONSTRAINT devices_device_id_key UNIQUE (device_id),
  CONSTRAINT devices_fingerprint_key UNIQUE (fingerprint)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices USING btree (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices USING btree (device_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON public.devices USING btree (fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_bar_id ON public.devices USING btree (last_bar_id);

-- Row Level Security (RLS) Policies
-- Users can only access their own devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Grant necessary permissions
GRANT ALL ON public.devices TO authenticated;
