-- Create devices table for PWA device tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  fingerprint TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Device metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_bar_id UUID REFERENCES bars(id) ON DELETE SET NULL,
  
  -- Security & monitoring
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_suspicious BOOLEAN DEFAULT false NOT NULL,
  suspicious_activity_count INTEGER DEFAULT 0 NOT NULL,
  
  -- Device information (for analytics & debugging)
  user_agent TEXT,
  platform TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  language TEXT,
  hardware_concurrency INTEGER,
  device_memory INTEGER,
  
  -- Installation tracking
  install_count INTEGER DEFAULT 1 NOT NULL,
  last_install_at TIMESTAMPTZ DEFAULT NOW(),
  pwa_installed BOOLEAN DEFAULT false,
  
  -- Tab history summary
  total_tabs_created INTEGER DEFAULT 0 NOT NULL,
  total_amount_spent DECIMAL(10,2) DEFAULT 0.00,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_devices_device_id ON devices(device_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_user_id ON devices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_last_seen ON devices(last_seen DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_created_at ON devices(created_at DESC);
CREATE INDEX idx_devices_is_active ON devices(is_active) WHERE deleted_at IS NULL;

-- Composite index for common queries
CREATE INDEX idx_devices_user_active ON devices(user_id, is_active) WHERE deleted_at IS NULL;

-- Row Level Security (RLS)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own devices (authenticated or anonymous)
CREATE POLICY "Users can view their own devices"
  ON devices FOR SELECT
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR 
    auth.uid() IS NULL
  );

-- Policy: Users can insert devices (authenticated or anonymous)
CREATE POLICY "Users can insert devices"
  ON devices FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- Policy: Users can update their own devices
CREATE POLICY "Users can update their own devices"
  ON devices FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- Policy: Users can soft delete their own devices
CREATE POLICY "Users can delete their own devices"
  ON devices FOR DELETE
  USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- Function: Update last_seen timestamp automatically
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update last_seen on device updates
CREATE TRIGGER trigger_update_device_last_seen
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_device_last_seen();

-- Function: Clean up old inactive devices (run periodically)
CREATE OR REPLACE FUNCTION cleanup_inactive_devices()
RETURNS void AS $$
BEGIN
  -- Soft delete devices not seen in 90 days
  UPDATE devices
  SET deleted_at = NOW()
  WHERE last_seen < NOW() - INTERVAL '90 days'
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Get device statistics
CREATE OR REPLACE FUNCTION get_device_stats(device_id_param TEXT)
RETURNS TABLE(
  total_tabs INTEGER,
  total_spent DECIMAL,
  bars_visited INTEGER,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.total_tabs_created,
    d.total_amount_spent,
    COUNT(DISTINCT t.bar_id)::INTEGER,
    d.created_at,
    d.last_seen
  FROM devices d
  LEFT JOIN tabs t ON t.owner_identifier LIKE device_id_param || '_%'
  WHERE d.device_id = device_id_param
  GROUP BY d.device_id, d.total_tabs_created, d.total_amount_spent, d.created_at, d.last_seen;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE devices IS 'Tracks customer devices for PWA installations and tab management';
COMMENT ON COLUMN devices.device_id IS 'Unique device identifier (format: device_TIMESTAMP_RANDOM)';
COMMENT ON COLUMN devices.fingerprint IS 'Browser fingerprint hash for device validation';
COMMENT ON COLUMN devices.user_id IS 'Associated authenticated user (nullable for anonymous users)';
COMMENT ON COLUMN devices.is_suspicious IS 'Flag for devices with suspicious activity patterns';
COMMENT ON COLUMN devices.install_count IS 'Number of times PWA has been installed on this device';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON devices TO anon;