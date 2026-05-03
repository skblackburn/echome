-- PR C: Add R2 storage columns for photo memories, journal entries, personas, and media
-- Enables gradual migration from local disk to Cloudflare R2

ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'local';
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS original_key TEXT;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS thumbnail_key TEXT;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS original_size_bytes INTEGER;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS display_size_bytes INTEGER;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE photo_memories ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_storage_provider TEXT DEFAULT 'local';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_storage_key TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_size_bytes INTEGER;

ALTER TABLE personas ADD COLUMN IF NOT EXISTS photo_storage_provider TEXT DEFAULT 'local';
ALTER TABLE personas ADD COLUMN IF NOT EXISTS photo_storage_key TEXT;

ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'local';
ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
