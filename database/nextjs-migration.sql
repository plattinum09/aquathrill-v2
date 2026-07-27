CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_content (
  page_key VARCHAR(50) PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boat_types (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  total_boats INT NOT NULL DEFAULT 1,
  max_guests INT NOT NULL DEFAULT 3,
  max_weight INT NOT NULL DEFAULT 200,
  price INT NOT NULL DEFAULT 9900,
  description TEXT,
  image VARCHAR(500),
  images TEXT,
  features TEXT,
  i18n TEXT,
  book_url VARCHAR(500) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS image VARCHAR(500);
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS images TEXT;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS features TEXT;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS i18n TEXT;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS book_url VARCHAR(500) DEFAULT '';
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS is_active SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_boat_types_active_sort ON boat_types(is_active, sort_order);

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
