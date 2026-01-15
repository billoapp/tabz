-- Add alert volume column to bars table
ALTER TABLE bars 
ADD COLUMN alert_volume DECIMAL(3,2) DEFAULT 0.8;
