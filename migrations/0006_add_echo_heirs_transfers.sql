-- Phase 2: Echo Transfer with Multi-Heir Support
-- New tables: echo_heirs, echo_transfers
-- Updated: personas (is_shared, original_creator_id, parent_persona_id)
-- Updated: chat_messages (heir_user_id)

-- ── echo_heirs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS echo_heirs (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  creator_user_id INTEGER NOT NULL,
  heir_email TEXT NOT NULL,
  heir_user_id INTEGER,
  heir_name TEXT,
  heir_relationship TEXT,
  access_level TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  claim_token TEXT NOT NULL UNIQUE,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── echo_transfers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS echo_transfers (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  transfer_trigger TEXT NOT NULL,
  scheduled_date TEXT,
  executed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── personas additions ───────────────────────────────────────────────────────
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS original_creator_id INTEGER;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS parent_persona_id INTEGER;

-- ── chat_messages additions ──────────────────────────────────────────────────
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS heir_user_id INTEGER;
