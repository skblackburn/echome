-- Phase 1: Attribution Foundation
-- Add contributor_user_id, contributor_relationship, and perspective_type to all user-contributed tables

-- personas
ALTER TABLE personas ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- traits
ALTER TABLE traits ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE traits ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- memories
ALTER TABLE memories ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- family_members
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- life_story
ALTER TABLE life_story ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE life_story ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE life_story ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- milestone_messages
ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- writing_styles
ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER;
ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS contributor_relationship TEXT;
ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self';

-- Backfill existing records:
-- Set contributor_user_id to the persona's userId for all tables that reference a persona
UPDATE personas SET contributor_user_id = user_id, contributor_relationship = 'creator', perspective_type = 'self' WHERE contributor_user_id IS NULL;

UPDATE traits t SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE t.persona_id = p.id AND t.contributor_user_id IS NULL;

-- For memories: 'self' for everything except document_type='character' which gets 'other'
UPDATE memories m SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = CASE WHEN m.document_type = 'character' THEN 'other' ELSE 'self' END FROM personas p WHERE m.persona_id = p.id AND m.contributor_user_id IS NULL;

UPDATE family_members fm SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE fm.persona_id = p.id AND fm.contributor_user_id IS NULL;

UPDATE life_story ls SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE ls.persona_id = p.id AND ls.contributor_user_id IS NULL;

UPDATE milestone_messages mm SET contributor_user_id = COALESCE(mm.user_id, p.user_id), contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE mm.persona_id = p.id AND mm.contributor_user_id IS NULL;

UPDATE chat_messages cm SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE cm.persona_id = p.id AND cm.contributor_user_id IS NULL;

UPDATE writing_styles ws SET contributor_user_id = p.user_id, contributor_relationship = 'creator', perspective_type = 'self' FROM personas p WHERE ws.persona_id = p.id AND ws.contributor_user_id IS NULL;
