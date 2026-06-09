-- Create photo_memories table
CREATE TABLE IF NOT EXISTS photo_memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  persona_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  photo_thumbnail_url TEXT,
  ai_prompts JSONB,
  user_responses JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  linked_memory_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
