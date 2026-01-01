-- Create table for Telegram order messages
CREATE TABLE tab_telegram_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  order_type VARCHAR(20) DEFAULT 'telegram', -- 'telegram', 'request', 'special'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'acknowledged', 'processing', 'completed', 'cancelled'
  message_metadata JSONB DEFAULT '{}',
  customer_notified BOOLEAN DEFAULT FALSE,
  staff_acknowledged_at TIMESTAMP WITH TIME ZONE,
  customer_notified_at TIMESTAMP WITH TIME ZONE,
  initiated_by VARCHAR(20) DEFAULT 'customer', -- 'customer', 'staff'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER update_tab_telegram_messages_updated_at
  BEFORE UPDATE ON tab_telegram_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_tab_telegram_messages_tab_id ON tab_telegram_messages(tab_id);
CREATE INDEX idx_tab_telegram_messages_status ON tab_telegram_messages(status);
CREATE INDEX idx_tab_telegram_messages_created_at ON tab_telegram_messages(created_at DESC);
