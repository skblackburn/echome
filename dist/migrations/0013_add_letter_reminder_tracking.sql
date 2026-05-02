-- Add reminder tracking column to future_letters
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;

-- Add resend tracking table for rate limiting
CREATE TABLE IF NOT EXISTS letter_resends (
  id SERIAL PRIMARY KEY,
  letter_id INTEGER NOT NULL,
  resent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resent_by INTEGER NOT NULL
);
