-- Auto-setup M-Pesa sandbox defaults for new bars
-- This makes testing M-Pesa integration seamless - bars only need to add their keys/secrets

-- Function to auto-setup M-Pesa sandbox defaults
CREATE OR REPLACE FUNCTION auto_setup_mpesa_sandbox()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-setup sandbox defaults when M-Pesa is enabled
  IF NEW.mpesa_enabled = true THEN
    
    -- Auto-set callback URL if not provided
    IF NEW.mpesa_callback_url IS NULL THEN
      NEW.mpesa_callback_url = 'https://customer.tabeza.co.ke/api/mpesa/callback';
    END IF;
    
    -- Auto-set environment to sandbox if not specified
    IF NEW.mpesa_environment IS NULL THEN
      NEW.mpesa_environment = 'sandbox';
    END IF;
    
    -- Auto-set business shortcode for sandbox if not provided
    IF NEW.mpesa_business_shortcode IS NULL AND NEW.mpesa_environment = 'sandbox' THEN
      NEW.mpesa_business_shortcode = '174379'; -- Safaricom sandbox shortcode
    END IF;
    
    -- Auto-set sandbox passkey if not provided (Safaricom public sandbox passkey)
    IF NEW.mpesa_passkey_encrypted IS NULL AND NEW.mpesa_environment = 'sandbox' THEN
      -- This is the public Safaricom sandbox passkey - safe to auto-set
      NEW.mpesa_passkey_encrypted = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    END IF;
    
    RAISE NOTICE 'Auto-configured M-Pesa sandbox defaults for bar: % (Business Code: %, Callback: %)', 
      NEW.name, NEW.mpesa_business_shortcode, NEW.mpesa_callback_url;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_setup_mpesa_sandbox ON bars;
CREATE TRIGGER trigger_auto_setup_mpesa_sandbox
  BEFORE INSERT OR UPDATE ON bars
  FOR EACH ROW
  EXECUTE FUNCTION auto_setup_mpesa_sandbox();

-- Set default values for new bars
ALTER TABLE bars 
ALTER COLUMN mpesa_callback_url 
SET DEFAULT 'https://customer.tabeza.co.ke/api/mpesa/callback';

ALTER TABLE bars 
ALTER COLUMN mpesa_environment 
SET DEFAULT 'sandbox';

ALTER TABLE bars 
ALTER COLUMN mpesa_business_shortcode 
SET DEFAULT '174379';

-- Update existing bars that have M-Pesa enabled but missing defaults
UPDATE bars 
SET 
  mpesa_callback_url = COALESCE(mpesa_callback_url, 'https://customer.tabeza.co.ke/api/mpesa/callback'),
  mpesa_environment = COALESCE(mpesa_environment, 'sandbox'),
  mpesa_business_shortcode = CASE 
    WHEN mpesa_environment = 'sandbox' OR mpesa_environment IS NULL 
    THEN COALESCE(mpesa_business_shortcode, '174379')
    ELSE mpesa_business_shortcode
  END,
  mpesa_passkey_encrypted = CASE 
    WHEN (mpesa_environment = 'sandbox' OR mpesa_environment IS NULL) 
         AND mpesa_passkey_encrypted IS NULL 
    THEN 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
    ELSE mpesa_passkey_encrypted
  END
WHERE mpesa_enabled = true;

-- Show what was updated
SELECT 
  name,
  mpesa_enabled,
  mpesa_environment,
  mpesa_business_shortcode,
  mpesa_callback_url,
  CASE 
    WHEN mpesa_passkey_encrypted IS NOT NULL THEN 'SET' 
    ELSE 'NOT SET' 
  END as passkey_status,
  CASE 
    WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 'SET' 
    ELSE 'NEEDS SETUP' 
  END as consumer_key_status,
  CASE 
    WHEN mpesa_consumer_secret_encrypted IS NOT NULL THEN 'SET' 
    ELSE 'NEEDS SETUP' 
  END as consumer_secret_status
FROM bars 
WHERE mpesa_enabled = true
ORDER BY name;