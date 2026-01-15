-- Add alert settings columns to bars table
ALTER TABLE bars 
ADD COLUMN alert_timeout INTEGER DEFAULT 5,
ADD COLUMN alert_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN alert_custom_audio_url TEXT;
