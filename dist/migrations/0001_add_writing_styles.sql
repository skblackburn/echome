CREATE TABLE IF NOT EXISTS writing_styles (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL UNIQUE,
  sentence_structure TEXT,
  vocabulary_level TEXT,
  punctuation_habits TEXT,
  tone_and_emotion TEXT,
  common_phrases TEXT,
  formality TEXT,
  narrative_style TEXT,
  quirks TEXT,
  overall_summary TEXT,
  analyzed_document_count INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
