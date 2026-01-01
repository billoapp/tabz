-- Add NOT NULL constraints and defaults for tab_telegram_messages
ALTER TABLE tab_telegram_messages 
ALTER COLUMN order_type SET DEFAULT 'telegram',
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN message_metadata SET DEFAULT '{}'::jsonb,
ALTER COLUMN customer_notified SET DEFAULT false,
ALTER COLUMN initiated_by SET DEFAULT 'customer';

-- Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_tab_telegram_messages_updated_at ON tab_telegram_messages;

-- Create trigger for tab_telegram_messages
CREATE TRIGGER update_tab_telegram_messages_updated_at
    BEFORE UPDATE ON tab_telegram_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to notify customer when staff acknowledges
CREATE OR REPLACE FUNCTION notify_customer_on_acknowledge()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'acknowledged' AND OLD.status = 'pending' THEN
        NEW.customer_notified = true;
        NEW.customer_notified_at = CURRENT_TIMESTAMP;
        NEW.staff_acknowledged_at = CURRENT_TIMESTAMP;
    END IF;
    
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.customer_notified = true;
        NEW.customer_notified_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS notify_customer_trigger ON tab_telegram_messages;

-- Create trigger for customer notifications
CREATE TRIGGER notify_customer_trigger
    BEFORE UPDATE ON tab_telegram_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_customer_on_acknowledge();

-- Function to create a telegram message with notification
CREATE OR REPLACE FUNCTION create_telegram_message(
  p_tab_id UUID,
  p_message TEXT,
  p_initiated_by TEXT DEFAULT 'customer',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Insert the message
  INSERT INTO tab_telegram_messages (
    tab_id,
    message,
    order_type,
    status,
    message_metadata,
    customer_notified,
    initiated_by
  ) VALUES (
    p_tab_id,
    p_message,
    'telegram',
    'pending',
    p_metadata,
    true,
    p_initiated_by
  ) RETURNING id INTO v_message_id;
  
  -- Log the action
  INSERT INTO audit_logs (
    action,
    tab_id,
    details
  ) VALUES (
    'telegram_message_created',
    p_tab_id,
    jsonb_build_object(
      'message_id', v_message_id,
      'message_length', length(p_message),
      'initiated_by', p_initiated_by
    )
  );
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to acknowledge telegram message
CREATE OR REPLACE FUNCTION acknowledge_telegram_message(
  p_message_id UUID,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tab_id UUID;
BEGIN
  -- Update the message
  UPDATE tab_telegram_messages 
  SET 
    status = 'acknowledged',
    staff_acknowledged_at = CURRENT_TIMESTAMP,
    customer_notified = true,
    customer_notified_at = CURRENT_TIMESTAMP
  WHERE id = p_message_id
  AND status = 'pending'
  RETURNING tab_id INTO v_tab_id;
  
  IF FOUND THEN
    -- Log the action
    INSERT INTO audit_logs (
      action,
      tab_id,
      staff_id,
      details
    ) VALUES (
      'telegram_message_acknowledged',
      v_tab_id,
      p_staff_id,
      jsonb_build_object(
        'message_id', p_message_id
      )
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to complete telegram message
CREATE OR REPLACE FUNCTION complete_telegram_message(
  p_message_id UUID,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tab_id UUID;
BEGIN
  -- Update the message
  UPDATE tab_telegram_messages 
  SET 
    status = 'completed',
    customer_notified = true,
    customer_notified_at = CURRENT_TIMESTAMP
  WHERE id = p_message_id
  AND status IN ('pending', 'acknowledged')
  RETURNING tab_id INTO v_tab_id;
  
  IF FOUND THEN
    -- Log the action
    INSERT INTO audit_logs (
      action,
      tab_id,
      staff_id,
      details
    ) VALUES (
      'telegram_message_completed',
      v_tab_id,
      p_staff_id,
      jsonb_build_object(
        'message_id', p_message_id
      )
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- View for telegram messages with tab info
CREATE OR REPLACE VIEW telegram_messages_with_tabs AS
SELECT 
  tm.*,
  t.tab_number,
  t.status as tab_status,
  t.notes,
  b.name as bar_name,
  b.id as bar_id
FROM tab_telegram_messages tm
JOIN tabs t ON tm.tab_id = t.id
JOIN bars b ON t.bar_id = b.id
ORDER BY tm.created_at DESC;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_tab_status 
ON tab_telegram_messages(tab_id, status);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at 
ON tab_telegram_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_staff_ack 
ON tab_telegram_messages(staff_acknowledged_at DESC) 
WHERE staff_acknowledged_at IS NOT NULL;
