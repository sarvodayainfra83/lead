-- ==========================================
-- SARVODAYA INFRACON SUPABASE DATABASE SCHEMA
-- ==========================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
-- id: Internal PostgreSQL UUID Primary Key
-- username: Unique Human-Readable Username entered at login (e.g. 'admin', 'user', 'user2')
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    number TEXT,
    gmail TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    access_pages JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MASTER LEAD TYPES TABLE
CREATE TABLE IF NOT EXISTS master_lead_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_type TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MASTER LEAD SOURCES TABLE
CREATE TABLE IF NOT EXISTS master_lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_source TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MASTER LEAD RECEIVERS TABLE
CREATE TABLE IF NOT EXISTS master_lead_receivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MASTER CALLER NAMES TABLE
CREATE TABLE IF NOT EXISTS master_caller_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5A. MASTER MUTUAL FUND PRODUCT TYPES TABLE
CREATE TABLE IF NOT EXISTS master_mutual_fund_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5B. MASTER REAL ESTATE PRODUCT TYPES TABLE
CREATE TABLE IF NOT EXISTS master_real_estate_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5C. MASTER REAL ESTATE REQUIREMENTS TABLE
CREATE TABLE IF NOT EXISTS master_real_estate_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5D. MASTER INSURANCE PRODUCT TYPES TABLE
CREATE TABLE IF NOT EXISTS master_insurance_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5E. MASTER INSURANCE SUB PRODUCT TYPES TABLE (tied to a parent Insurance Product Type)
CREATE TABLE IF NOT EXISTS master_insurance_sub_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type_id UUID REFERENCES master_insurance_products(id) ON DELETE CASCADE,
    sub_product_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5F. MASTER INVESTMENT BUDGETS TABLE (shared across Real Estate / Mutual Fund / Insurance)
CREATE TABLE IF NOT EXISTS master_investment_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_budget TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6A. REAL ESTATE LEADS TABLE (No lead_id column)
CREATE TABLE IF NOT EXISTS real_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_receiver_id UUID REFERENCES master_lead_receivers(id) ON DELETE SET NULL,
    lead_source_id UUID REFERENCES master_lead_sources(id) ON DELETE SET NULL,
    referencer_name TEXT,
    caller_assigned_id UUID REFERENCES master_caller_names(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_number TEXT NOT NULL,
    customer_email TEXT,
    dob DATE,
    customer_address TEXT,
    occupation TEXT,
    investment_budget TEXT,
    site_location TEXT,
    -- Product Type / Requirement are FK ids into their masters (no plain-text column) — the
    -- human-readable value is joined in from the master table wherever it's displayed (see
    -- all_leads_view below). `requirement` stays TEXT too since it's what the Call Tracker /
    -- Lead Edit forms read and write directly.
    product_type_id UUID REFERENCES master_real_estate_products(id) ON DELETE SET NULL,
    requirement_id UUID REFERENCES master_real_estate_requirements(id) ON DELETE SET NULL,
    when_to_buy_plan TEXT,
    requirement TEXT,
    remarks TEXT,
    -- 'Lead' (created via the normal Add Lead form) or 'Direct' (created via Call Tracker's
    -- Direct form) — set once at creation, not user-editable afterwards.
    process_type TEXT DEFAULT 'Lead',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward-compatibility view for real_estate
CREATE OR REPLACE VIEW real_estate AS SELECT * FROM real_state;

-- 6B. INSURANCE LEADS TABLE (No lead_id column)
CREATE TABLE IF NOT EXISTS insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_receiver_id UUID REFERENCES master_lead_receivers(id) ON DELETE SET NULL,
    -- No CHECK constraint: values now come from master_insurance_products (Product Type is
    -- editable via the Master pages, so the DB must accept whatever that master allows).
    insurance_type TEXT NOT NULL,
    insurance_sub_type TEXT,
    -- FK ids for the same Product Type / Sub Product Type (insurance_type / insurance_sub_type
    -- above stay the source of truth for display and validation; these are for referential
    -- integrity with the masters).
    product_type_id UUID REFERENCES master_insurance_products(id) ON DELETE SET NULL,
    sub_product_type_id UUID REFERENCES master_insurance_sub_products(id) ON DELETE SET NULL,
    lead_source_id UUID REFERENCES master_lead_sources(id) ON DELETE SET NULL,
    referencer_name TEXT,
    caller_assigned_id UUID REFERENCES master_caller_names(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_number TEXT NOT NULL,
    customer_email TEXT,
    dob DATE,
    customer_address TEXT,
    occupation TEXT,
    investment_budget TEXT,
    when_to_buy_plan TEXT,
    any_desease TEXT,
    remarks TEXT,
    process_type TEXT DEFAULT 'Lead',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6C. MUTUAL FUND LEADS TABLE (No lead_id column)
CREATE TABLE IF NOT EXISTS mutual_fund (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_receiver_id UUID REFERENCES master_lead_receivers(id) ON DELETE SET NULL,
    lead_source_id UUID REFERENCES master_lead_sources(id) ON DELETE SET NULL,
    referencer_name TEXT,
    caller_assigned_id UUID REFERENCES master_caller_names(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_number TEXT NOT NULL,
    customer_email TEXT,
    dob DATE,
    customer_address TEXT,
    occupation TEXT,
    investment_budget TEXT,
    -- Product Type is FK-only here too (no plain-text column) — joined from
    -- master_mutual_fund_products wherever it's displayed.
    product_type_id UUID REFERENCES master_mutual_fund_products(id) ON DELETE SET NULL,
    when_to_buy_plan TEXT,
    remarks TEXT,
    process_type TEXT DEFAULT 'Lead',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6D. Link the Investment Budget / Product Type / Requirement / Sub Product Type masters to
-- each lead-type table via ADD COLUMN IF NOT EXISTS — safe/idempotent to run even though the
-- columns above are now also in the CREATE TABLE statements, for installs where these tables
-- already existed before these FK columns did.
ALTER TABLE real_state
    ADD COLUMN IF NOT EXISTS investment_budget_id UUID REFERENCES master_investment_budgets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES master_real_estate_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES master_real_estate_requirements(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'Lead';
ALTER TABLE mutual_fund
    ADD COLUMN IF NOT EXISTS investment_budget_id UUID REFERENCES master_investment_budgets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES master_mutual_fund_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'Lead';
ALTER TABLE insurance
    ADD COLUMN IF NOT EXISTS investment_budget_id UUID REFERENCES master_investment_budgets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES master_insurance_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sub_product_type_id UUID REFERENCES master_insurance_sub_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'Lead';

-- 6E. CENTRAL LEADS TABLE
-- Connected to all three lead tables via Foreign Keys (FK)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_no TEXT UNIQUE NOT NULL,
    lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE SET NULL,
    real_estate_id UUID REFERENCES real_state(id) ON DELETE CASCADE,
    insurance_id UUID REFERENCES insurance(id) ON DELETE CASCADE,
    mutual_fund_id UUID REFERENCES mutual_fund(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CALL TRACKERS TABLE
CREATE TABLE IF NOT EXISTS call_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    lead_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Interested', 'Not Interested', 'Future Plan Date', 'Site Visit/Meeting')),
    customer_said TEXT,
    next_date DATE,
    timestamp TEXT NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installs where this table already existed under the old 5-status scheme: replace the CHECK
-- constraint with the new 4-status one, and make next_date nullable again (Interested / Not
-- Interested carry no date — only Future Plan Date / Site Visit/Meeting do).
ALTER TABLE call_trackers DROP CONSTRAINT IF EXISTS call_trackers_status_check;
ALTER TABLE call_trackers ADD CONSTRAINT call_trackers_status_check
    CHECK (status IN ('Interested', 'Not Interested', 'Future Plan Date', 'Site Visit/Meeting'));
ALTER TABLE call_trackers ALTER COLUMN next_date DROP NOT NULL;

-- 8. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- UNIFIED VIEW FOR ALL LEADS ACROSS 3 TYPES
-- ==========================================
-- DROP + CREATE rather than CREATE OR REPLACE: Postgres only allows REPLACE to append new
-- columns at the end of a view's column list, not insert them in the middle (which several
-- of the columns below do relative to earlier versions of this view). DROP is safe here —
-- a view holds no data of its own.
DROP VIEW IF EXISTS all_leads_view;
CREATE VIEW all_leads_view AS
SELECT
    l.id AS id,
    l.lead_no AS lead_no,
    l.lead_type_id AS lead_type_id,
    lt.lead_type AS lead_type,
    re.id AS detail_id,
    re.lead_receiver_id,
    lr.person_name AS lead_receiver,
    re.lead_source_id,
    ls.lead_source AS lead_source,
    re.referencer_name,
    re.caller_assigned_id,
    ca.person_name AS caller_assigned,
    re.customer_name,
    re.customer_number,
    re.customer_email,
    re.dob,
    re.customer_address,
    re.occupation,
    re.investment_budget,
    re.investment_budget_id,
    re.site_location,
    rep.product_type,
    re.when_to_buy_plan,
    re.requirement,
    NULL::TEXT AS insurance_type,
    NULL::TEXT AS insurance_sub_type,
    NULL::TEXT AS any_desease,
    re.remarks,
    re.process_type,
    re.timestamp,
    l.created_at,
    l.updated_at
FROM leads l
JOIN master_lead_types lt ON lt.id = l.lead_type_id
JOIN real_state re ON re.id = l.real_estate_id
LEFT JOIN master_lead_receivers lr ON lr.id = re.lead_receiver_id
LEFT JOIN master_lead_sources ls ON ls.id = re.lead_source_id
LEFT JOIN master_caller_names ca ON ca.id = re.caller_assigned_id
LEFT JOIN master_real_estate_products rep ON rep.id = re.product_type_id

UNION ALL

SELECT 
    l.id AS id,
    l.lead_no AS lead_no,
    l.lead_type_id AS lead_type_id,
    lt.lead_type AS lead_type,
    ins.id AS detail_id,
    ins.lead_receiver_id,
    lr.person_name AS lead_receiver,
    ins.lead_source_id,
    ls.lead_source AS lead_source,
    ins.referencer_name,
    ins.caller_assigned_id,
    ca.person_name AS caller_assigned,
    ins.customer_name,
    ins.customer_number,
    ins.customer_email,
    ins.dob,
    ins.customer_address,
    ins.occupation,
    ins.investment_budget,
    ins.investment_budget_id,
    NULL::TEXT AS site_location,
    ins.insurance_type AS product_type,
    ins.when_to_buy_plan,
    NULL::TEXT AS requirement,
    ins.insurance_type,
    ins.insurance_sub_type,
    ins.any_desease,
    ins.remarks,
    ins.process_type,
    ins.timestamp,
    l.created_at,
    l.updated_at
FROM leads l
JOIN master_lead_types lt ON lt.id = l.lead_type_id
JOIN insurance ins ON ins.id = l.insurance_id
LEFT JOIN master_lead_receivers lr ON lr.id = ins.lead_receiver_id
LEFT JOIN master_lead_sources ls ON ls.id = ins.lead_source_id
LEFT JOIN master_caller_names ca ON ca.id = ins.caller_assigned_id

UNION ALL

SELECT 
    l.id AS id,
    l.lead_no AS lead_no,
    l.lead_type_id AS lead_type_id,
    lt.lead_type AS lead_type,
    mf.id AS detail_id,
    mf.lead_receiver_id,
    lr.person_name AS lead_receiver,
    mf.lead_source_id,
    ls.lead_source AS lead_source,
    mf.referencer_name,
    mf.caller_assigned_id,
    ca.person_name AS caller_assigned,
    mf.customer_name,
    mf.customer_number,
    mf.customer_email,
    mf.dob,
    mf.customer_address,
    mf.occupation,
    mf.investment_budget,
    mf.investment_budget_id,
    NULL::TEXT AS site_location,
    mfp.product_type,
    mf.when_to_buy_plan,
    NULL::TEXT AS requirement,
    NULL::TEXT AS insurance_type,
    NULL::TEXT AS insurance_sub_type,
    NULL::TEXT AS any_desease,
    mf.remarks,
    mf.process_type,
    mf.timestamp,
    l.created_at,
    l.updated_at
FROM leads l
JOIN master_lead_types lt ON lt.id = l.lead_type_id
JOIN mutual_fund mf ON mf.id = l.mutual_fund_id
LEFT JOIN master_lead_receivers lr ON lr.id = mf.lead_receiver_id
LEFT JOIN master_lead_sources ls ON ls.id = mf.lead_source_id
LEFT JOIN master_caller_names ca ON ca.id = mf.caller_assigned_id
LEFT JOIN master_mutual_fund_products mfp ON mfp.id = mf.product_type_id;

-- Make the view enforce the RLS policies of the tables it reads (leads, real_state, insurance,
-- mutual_fund, and the master_* tables it joins) instead of running as the view's owner and
-- silently bypassing them — this is what clears Supabase's "Unrestricted" badge on the view.
-- Since every underlying table already has an "allow all" policy, this changes nothing about
-- what the app can actually read; it just makes that explicit instead of implicit.
ALTER VIEW all_leads_view SET (security_invoker = true);

-- ==========================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_leads_lead_type_id ON leads(lead_type_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_no ON leads(lead_no);
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_id ON leads(real_estate_id);
CREATE INDEX IF NOT EXISTS idx_leads_insurance_id ON leads(insurance_id);
CREATE INDEX IF NOT EXISTS idx_leads_mutual_fund_id ON leads(mutual_fund_id);

CREATE INDEX IF NOT EXISTS idx_real_state_receiver ON real_state(lead_receiver_id);
CREATE INDEX IF NOT EXISTS idx_real_state_source ON real_state(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_real_state_caller ON real_state(caller_assigned_id);

CREATE INDEX IF NOT EXISTS idx_insurance_receiver ON insurance(lead_receiver_id);
CREATE INDEX IF NOT EXISTS idx_insurance_source ON insurance(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_insurance_caller ON insurance(caller_assigned_id);

CREATE INDEX IF NOT EXISTS idx_mutual_fund_receiver ON mutual_fund(lead_receiver_id);
CREATE INDEX IF NOT EXISTS idx_mutual_fund_source ON mutual_fund(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_mutual_fund_caller ON mutual_fund(caller_assigned_id);

CREATE INDEX IF NOT EXISTS idx_insurance_sub_products_type ON master_insurance_sub_products(product_type_id);

CREATE INDEX IF NOT EXISTS idx_real_state_investment_budget ON real_state(investment_budget_id);
CREATE INDEX IF NOT EXISTS idx_mutual_fund_investment_budget ON mutual_fund(investment_budget_id);
CREATE INDEX IF NOT EXISTS idx_insurance_investment_budget ON insurance(investment_budget_id);

CREATE INDEX IF NOT EXISTS idx_call_trackers_lead_id ON call_trackers(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_trackers_status ON call_trackers(status);
CREATE INDEX IF NOT EXISTS idx_call_trackers_timestamp_ms ON call_trackers(timestamp_ms);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lead_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lead_receivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_caller_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_mutual_fund_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_real_estate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_real_estate_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_insurance_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_insurance_sub_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_investment_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutual_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for client API access
CREATE POLICY "Allow public read access on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on users" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public all on master_lead_types" ON master_lead_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_lead_sources" ON master_lead_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_lead_receivers" ON master_lead_receivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_caller_names" ON master_caller_names FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_mutual_fund_products" ON master_mutual_fund_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_real_estate_products" ON master_real_estate_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_real_estate_requirements" ON master_real_estate_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_insurance_products" ON master_insurance_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_insurance_sub_products" ON master_insurance_sub_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on master_investment_budgets" ON master_investment_budgets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all on leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on real_state" ON real_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on insurance" ON insurance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on mutual_fund" ON mutual_fund FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on call_trackers" ON call_trackers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- DEFAULT SEED DATA
-- ==========================================

-- Seed Users
INSERT INTO users (username, name, number, gmail, password, role, access_pages)
VALUES 
    ('admin', 'Rajesh Sharma', '9876500001', 'rajesh.sharma@sarvodayainfracon.com', 'admin123', 'ADMIN', '{}'::jsonb),
    ('user', 'Amit Patel', '9876500002', 'amit.patel@sarvodayainfracon.com', 'user123', 'USER', '{"dashboard": "view", "lead": "edit", "callTracker": "edit", "customerMaster": "view", "master": "none", "callerReport": "none", "setting": "none"}'::jsonb),
    ('user2', 'Priya Iyer', '9876500003', 'priya.iyer@sarvodayainfracon.com', 'user123', 'USER', '{"dashboard": "view", "lead": "edit", "callTracker": "edit", "customerMaster": "view", "master": "none", "callerReport": "none", "setting": "none"}'::jsonb)
ON CONFLICT (username) DO NOTHING;

-- Seed Master Lead Types
INSERT INTO master_lead_types (lead_type) VALUES 
    ('Real Estate'),
    ('Mutual Fund'),
    ('Insurance')
ON CONFLICT (lead_type) DO NOTHING;

-- Seed Master Lead Sources
INSERT INTO master_lead_sources (lead_source) VALUES 
    ('Website'), ('Reference'), ('Walk-in'), ('Cold Call'), 
    ('Social Media'), ('Newspaper Ad'), ('Advertisement'), ('Other')
ON CONFLICT (lead_source) DO NOTHING;

-- Seed Master Lead Receivers
INSERT INTO master_lead_receivers (lead_type_id, person_name) VALUES 
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Priya Iyer');

-- Seed Master Caller Names
INSERT INTO master_caller_names (lead_type_id, person_name) VALUES 
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Insurance'), 'Priya Iyer');

-- Seed Master Mutual Fund Product Types
INSERT INTO master_mutual_fund_products (product_type) VALUES
    ('Equity Fund'), ('Debit Fund'), ('Hybrid Fund'), ('Money Market Fund'), ('Growth Fund'), ('Other')
ON CONFLICT (product_type) DO NOTHING;

-- Seed Master Real Estate Product Types
INSERT INTO master_real_estate_products (product_type) VALUES
    ('Vrindavan Garden'), ('Bhardwaj Sky'), ('Shri Ram Lotus Valley'), ('Evarraa By Dee Vee'), ('Other')
ON CONFLICT (product_type) DO NOTHING;

-- Seed Master Real Estate Requirements
INSERT INTO master_real_estate_requirements (requirement) VALUES
    ('1 BHK'), ('2 BHK'), ('3 BHK'), ('4 BHK'), ('5+ BHK'), ('Flat'), ('Bungalow'), ('Villa'),
    ('Penthouse'), ('Row House'), ('Commercial Shop'), ('Commercial Office'), ('Plot / Land'),
    ('Farmhouse'), ('Industrial / Warehouse'), ('Other')
ON CONFLICT (requirement) DO NOTHING;

-- Seed Master Insurance Product Types
INSERT INTO master_insurance_products (product_type) VALUES
    ('Life Insurance'), ('Health Insurance'), ('Vehicle Insurance'), ('Property Insurance'),
    ('Accident Insurance'), ('Travel Insurance'), ('Other')
ON CONFLICT (product_type) DO NOTHING;

-- Seed Master Insurance Sub Product Types
INSERT INTO master_insurance_sub_products (product_type_id, sub_product_type) VALUES
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'KeyMan Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Business Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Whole Life Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'ULIP Investment Plan'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Child Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Saving Plan'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Retirement Plan'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Life Insurance'), 'Other'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Individual Health Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Family Health Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Senior Citizen Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Group Insurance'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Critical Illness'),
    ((SELECT id FROM master_insurance_products WHERE product_type = 'Health Insurance'), 'Other');

-- Seed Master Investment Budgets
INSERT INTO master_investment_budgets (investment_budget) VALUES
    ('10k - 20k'),
    ('20k - 50k'),
    ('50k - 70k'),
    ('70k - 1 Lakh'),
    ('1 Lakh - 1.5 Lakh'),
    ('1.5 Lakh - 2 Lakh'),
    ('2 Lakh - 3 Lakh'),
    ('3 Lakh - 5 Lakh'),
    ('Above 5 Lakh')
ON CONFLICT (investment_budget) DO NOTHING;

-- Seed Settings
INSERT INTO system_settings (key, value) VALUES 
    ('groupHeads', '["IT", "HR", "Finance", "Operations", "Marketing"]'::jsonb),
    ('paymentModes', '["Cash", "Cheque", "Bank Transfer", "Online Payment"]'::jsonb),
    ('lastSerialNumber', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;