-- Add notification_popups preference to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_popups BOOLEAN NOT NULL DEFAULT true;
