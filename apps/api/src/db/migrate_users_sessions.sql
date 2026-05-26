-- Migration: Add windows_username to users, user_id/session_* to asset_users
ALTER TABLE users ADD COLUMN IF NOT EXISTS windows_username VARCHAR(255);
ALTER TABLE asset_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE asset_users ADD COLUMN IF NOT EXISTS session_type VARCHAR(50);
ALTER TABLE asset_users ADD COLUMN IF NOT EXISTS session_host VARCHAR(255);
