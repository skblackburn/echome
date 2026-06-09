-- Add avatar_url column to personas table for storing base64 data URL photos
ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_url TEXT;
