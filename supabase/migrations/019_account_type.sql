-- L1: owner / renter / pre-purchase account types
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'owner'
  CHECK (account_type IN ('owner','renter','prebuy'));
