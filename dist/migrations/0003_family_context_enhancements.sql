-- Feature 1: Enhanced Family Tree
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS note TEXT;

-- Feature 2: Passing Date
ALTER TABLE personas ADD COLUMN IF NOT EXISTS passing_date TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_living BOOLEAN DEFAULT TRUE;

-- Feature 3: Document Type Toggle
ALTER TABLE memories ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'voice';
