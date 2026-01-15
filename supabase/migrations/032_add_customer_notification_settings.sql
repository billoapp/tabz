-- Add vibration column to tabs table for customer notifications
ALTER TABLE tabs 
ADD COLUMN sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN vibration_enabled BOOLEAN DEFAULT true;
