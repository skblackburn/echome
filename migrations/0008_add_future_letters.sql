-- Create future_letters table
CREATE TABLE IF NOT EXISTS future_letters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_user_id INTEGER,
  recipient_heir_id INTEGER,
  recipient_name TEXT,
  recipient_email TEXT,
  deliver_at TIMESTAMP NOT NULL,
  delivered_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
