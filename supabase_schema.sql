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
    when_to_buy_plan TEXT,
    requirement TEXT,
    remarks TEXT,
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
    insurance_type TEXT NOT NULL CHECK (insurance_type IN ('Life Insurance', 'Health Insurance', 'Vehicle Insurance', 'Property Insurance', 'Accident Insurance', 'Travel Insurance', 'Other')),
    insurance_sub_type TEXT,
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
    when_to_buy_plan TEXT,
    remarks TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6D. CENTRAL LEADS TABLE
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
    status TEXT NOT NULL CHECK (status IN ('Received', 'Expected', 'Not Interested', 'Need Meeting', 'Call Not Received')),
    customer_said TEXT,
    next_date DATE,
    timestamp TEXT NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE OR REPLACE VIEW all_leads_view AS
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
    re.site_location,
    re.when_to_buy_plan,
    re.requirement,
    NULL::TEXT AS insurance_type,
    NULL::TEXT AS insurance_sub_type,
    NULL::TEXT AS any_desease,
    re.remarks,
    re.timestamp,
    l.created_at,
    l.updated_at
FROM leads l
JOIN master_lead_types lt ON lt.id = l.lead_type_id
JOIN real_state re ON re.id = l.real_estate_id
LEFT JOIN master_lead_receivers lr ON lr.id = re.lead_receiver_id
LEFT JOIN master_lead_sources ls ON ls.id = re.lead_source_id
LEFT JOIN master_caller_names ca ON ca.id = re.caller_assigned_id

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
    NULL::TEXT AS site_location,
    ins.when_to_buy_plan,
    NULL::TEXT AS requirement,
    ins.insurance_type,
    ins.insurance_sub_type,
    ins.any_desease,
    ins.remarks,
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
    NULL::TEXT AS site_location,
    mf.when_to_buy_plan,
    NULL::TEXT AS requirement,
    NULL::TEXT AS insurance_type,
    NULL::TEXT AS insurance_sub_type,
    NULL::TEXT AS any_desease,
    mf.remarks,
    mf.timestamp,
    l.created_at,
    l.updated_at
FROM leads l
JOIN master_lead_types lt ON lt.id = l.lead_type_id
JOIN mutual_fund mf ON mf.id = l.mutual_fund_id
LEFT JOIN master_lead_receivers lr ON lr.id = mf.lead_receiver_id
LEFT JOIN master_lead_sources ls ON ls.id = mf.lead_source_id
LEFT JOIN master_caller_names ca ON ca.id = mf.caller_assigned_id;

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

-- Seed Settings
INSERT INTO system_settings (key, value) VALUES 
    ('groupHeads', '["IT", "HR", "Finance", "Operations", "Marketing"]'::jsonb),
    ('paymentModes', '["Cash", "Cheque", "Bank Transfer", "Online Payment"]'::jsonb),
    ('lastSerialNumber', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;