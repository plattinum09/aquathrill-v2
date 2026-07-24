CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_reviews (
  id SERIAL PRIMARY KEY,
  author_name VARCHAR(255) NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 5,
  text TEXT NOT NULL,
  photo VARCHAR(500) DEFAULT '',
  trip VARCHAR(255) DEFAULT 'Customer Review',
  enabled SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_reviews_toggle (
  id SERIAL PRIMARY KEY,
  review_key VARCHAR(500) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_payment_slips (
  id SERIAL PRIMARY KEY,
  booking_id VARCHAR(30) NOT NULL,
  agent_id INT NOT NULL,
  slip_url VARCHAR(500) NOT NULL,
  amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_logs (
  id SERIAL PRIMARY KEY,
  booking_id VARCHAR(30) NOT NULL,
  transaction_id VARCHAR(50),
  payment_method VARCHAR(20) DEFAULT 'payso',
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'THB',
  status VARCHAR(20) DEFAULT 'pending',
  gateway_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_transaction ON payment_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_agent_slips_booking ON agent_payment_slips(booking_id);
