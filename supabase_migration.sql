-- ===================================================
-- MIGRATION SCRIPT TO UPDATE EXISTING SUPABASE SCHEMA
-- Copy and run this script in your Supabase SQL Editor
-- ===================================================

-- 1. UPDATE LEADS TABLE SCHEMA
-- Add new requirement column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requirement TEXT;

-- Drop obsolete process_type column
ALTER TABLE leads DROP COLUMN IF EXISTS process_type;

-- Add Foreign Key columns referencing Master tables
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_receiver_id UUID REFERENCES master_lead_receivers(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES master_lead_sources(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS caller_assigned_id UUID REFERENCES master_caller_names(id) ON DELETE SET NULL;

-- Remove redundant text columns from leads
ALTER TABLE leads DROP COLUMN IF EXISTS lead_type;
ALTER TABLE leads DROP COLUMN IF EXISTS lead_receiver;
ALTER TABLE leads DROP COLUMN IF EXISTS lead_source;
ALTER TABLE leads DROP COLUMN IF EXISTS caller_assigned;

-- 2. UPDATE MASTER LEAD RECEIVERS TABLE SCHEMA
ALTER TABLE master_lead_receivers ADD COLUMN IF NOT EXISTS lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE CASCADE;
ALTER TABLE master_lead_receivers DROP COLUMN IF EXISTS lead_type;

-- 3. UPDATE MASTER CALLER NAMES TABLE SCHEMA
ALTER TABLE master_caller_names ADD COLUMN IF NOT EXISTS lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE CASCADE;
ALTER TABLE master_caller_names DROP COLUMN IF EXISTS lead_type;

-- 4. UPDATE INDEXES FOR HIGH-PERFORMANCE JOINS
DROP INDEX IF EXISTS idx_leads_caller_assigned;
DROP INDEX IF EXISTS idx_leads_lead_type;

CREATE INDEX IF NOT EXISTS idx_leads_lead_type_id ON leads(lead_type_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_source_id ON leads(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_receiver_id ON leads(lead_receiver_id);
CREATE INDEX IF NOT EXISTS idx_leads_caller_assigned_id ON leads(caller_assigned_id);

-- 5. UPDATE USERS TABLE (Rename user_id_code -> username)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_id_code') THEN
    ALTER TABLE users RENAME COLUMN user_id_code TO username;
  END IF;
END $$;
