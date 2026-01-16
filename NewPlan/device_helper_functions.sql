-- Additional SQL functions for device management
-- Run this after creating the devices table

-- Function: Increment device install count
CREATE OR REPLACE FUNCTION increment_device_installs(device_id_param TEXT)
RETURNS void AS $$
BEGIN
  UPDATE devices
  SET 
    install_count = install_count + 1,
    last_install_at = NOW()
  WHERE device_id = device_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark device as suspicious
CREATE OR REPLACE FUNCTION flag_suspicious_device(
  device_id_param TEXT,
  reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE devices
  SET 
    is_suspicious = true,
    suspicious_activity_count = suspicious_activity_count + 1
  WHERE device_id = device_id_param;
  
  -- Log the incident (if you have an incidents table)
  -- INSERT INTO security_incidents (device_id, reason, created_at)
  -- VALUES (device_id_param, reason, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update device stats after tab creation
CREATE OR REPLACE FUNCTION update_device_stats_on_tab_create()
RETURNS TRIGGER AS $$
DECLARE
  device_id_value TEXT;
BEGIN
  -- Extract device_id from owner_identifier (format: device_123_bar_456)
  device_id_value := split_part(NEW.owner_identifier, '_bar_', 1);
  
  -- Update device statistics
  UPDATE devices
  SET 
    total_tabs_created = total_tabs_created + 1,
    last_bar_id = NEW.bar_id
  WHERE device_id = device_id_value;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update device stats when tab is created
DROP TRIGGER IF EXISTS trigger_update_device_stats_on_tab_create ON tabs;
CREATE TRIGGER trigger_update_device_stats_on_tab_create
  AFTER INSERT ON tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_device_stats_on_tab_create();

-- Function: Update device total spent when tab is closed
CREATE OR REPLACE FUNCTION update_device_stats_on_tab_close()
RETURNS TRIGGER AS $$
DECLARE
  device_id_value TEXT;
BEGIN
  -- Only update if tab status changed to 'closed' or 'paid'
  IF NEW.status IN ('closed', 'paid') AND OLD.status = 'open' THEN
    device_id_value := split_part(NEW.owner_identifier, '_bar_', 1);
    
    UPDATE devices
    SET total_amount_spent = total_amount_spent + COALESCE(NEW.total_amount, 0)
    WHERE device_id = device_id_value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update device spending when tab is closed
DROP TRIGGER IF EXISTS trigger_update_device_stats_on_tab_close ON tabs;
CREATE TRIGGER trigger_update_device_stats_on_tab_close
  AFTER UPDATE OF status ON tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_device_stats_on_tab_close();

-- Function: Get device activity summary
CREATE OR REPLACE FUNCTION get_device_activity_summary(device_id_param TEXT)
RETURNS TABLE(
  device_id TEXT,
  total_tabs INTEGER,
  total_spent DECIMAL,
  bars_visited INTEGER,
  avg_tab_amount DECIMAL,
  first_visit TIMESTAMPTZ,
  last_visit TIMESTAMPTZ,
  days_active INTEGER,
  is_active BOOLEAN,
  is_suspicious BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.device_id,
    d.total_tabs_created,
    d.total_amount_spent,
    COUNT(DISTINCT t.bar_id)::INTEGER AS bars_visited,
    CASE 
      WHEN d.total_tabs_created > 0 
      THEN ROUND(d.total_amount_spent / d.total_tabs_created, 2)
      ELSE 0
    END AS avg_tab_amount,
    d.created_at AS first_visit,
    d.last_seen AS last_visit,
    EXTRACT(DAY FROM (d.last_seen - d.created_at))::INTEGER AS days_active,
    d.is_active,
    d.is_suspicious
  FROM devices d
  LEFT JOIN tabs t ON t.owner_identifier LIKE d.device_id || '%'
  WHERE d.device_id = device_id_param
  GROUP BY d.device_id, d.total_tabs_created, d.total_amount_spent, 
           d.created_at, d.last_seen, d.is_active, d.is_suspicious;
END;
$$ LANGUAGE plpgsql;

-- Function: Detect suspicious device patterns
CREATE OR REPLACE FUNCTION detect_suspicious_devices()
RETURNS TABLE(
  device_id TEXT,
  reason TEXT,
  score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.device_id,
    CASE
      WHEN d.total_tabs_created > 50 THEN 'Excessive tab creation'
      WHEN d.install_count > 10 THEN 'Multiple reinstalls'
      WHEN COUNT(DISTINCT t.bar_id) > 20 THEN 'Too many different bars'
      WHEN d.suspicious_activity_count > 3 THEN 'Multiple suspicious activities'
      ELSE 'Unknown pattern'
    END AS reason,
    CASE
      WHEN d.total_tabs_created > 50 THEN 10
      WHEN d.install_count > 10 THEN 8
      WHEN COUNT(DISTINCT t.bar_id) > 20 THEN 7
      WHEN d.suspicious_activity_count > 3 THEN 9
      ELSE 5
    END AS score
  FROM devices d
  LEFT JOIN tabs t ON t.owner_identifier LIKE d.device_id || '%'
  WHERE d.is_active = true
    AND d.is_suspicious = false
    AND (
      d.total_tabs_created > 50 OR
      d.install_count > 10 OR
      d.suspicious_activity_count > 3
    )
  GROUP BY d.device_id, d.total_tabs_created, d.install_count, d.suspicious_activity_count
  HAVING COUNT(DISTINCT t.bar_id) > 20 OR d.total_tabs_created > 50
  ORDER BY score DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_device_installs TO authenticated;
GRANT EXECUTE ON FUNCTION increment_device_installs TO anon;
GRANT EXECUTE ON FUNCTION get_device_activity_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_device_activity_summary TO anon;

-- Comments
COMMENT ON FUNCTION increment_device_installs IS 'Increment device install count when PWA is reinstalled';
COMMENT ON FUNCTION flag_suspicious_device IS 'Mark device as suspicious and increment counter';
COMMENT ON FUNCTION get_device_activity_summary IS 'Get comprehensive activity summary for a device';
COMMENT ON FUNCTION detect_suspicious_devices IS 'Detect devices with suspicious activity patterns';