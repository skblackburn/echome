-- Migration 0012: Add user_preferences table for AI feature toggles and notification settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ai_chat_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_reflections_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_photo_prompts_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_voice_transcription_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_writing_style_enabled BOOLEAN NOT NULL DEFAULT false,
  email_letter_delivery BOOLEAN NOT NULL DEFAULT true,
  email_milestones BOOLEAN NOT NULL DEFAULT true,
  email_marketing BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Existing users get ALL AI features ON so their experience is not disrupted
INSERT INTO user_preferences (user_id, ai_chat_enabled, ai_reflections_enabled, ai_photo_prompts_enabled, ai_voice_transcription_enabled, ai_writing_style_enabled, email_letter_delivery, email_milestones, email_marketing)
SELECT id, true, true, true, true, true, true, true, true
FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences);
