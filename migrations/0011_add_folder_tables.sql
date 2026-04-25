-- The Folder: extend future_letters + add stories + milestones_observed

-- Extend future_letters with persona-scoped folder fields
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS persona_id INTEGER;
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS delivery_rule_type TEXT DEFAULT 'date';
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS delivery_milestone TEXT;
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS is_sealed BOOLEAN DEFAULT FALSE;

-- New table: stories (long-form writing per persona)
CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  persona_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- New table: milestones_observed (tracks when a milestone fires)
CREATE TABLE IF NOT EXISTS milestones_observed (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  persona_id INTEGER,
  milestone_type TEXT NOT NULL,
  observed_at TIMESTAMP DEFAULT NOW(),
  note TEXT
);
