-- Add alert audio name column to bars table
ALTER TABLE bars 
ADD COLUMN alert_custom_audio_name TEXT;
