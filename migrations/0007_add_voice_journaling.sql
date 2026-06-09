-- Add voice journaling columns to journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'none';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'text';
