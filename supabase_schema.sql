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

-- 6. LEADS TABLE
-- Connected ONLY via Foreign Keys (lead_type_id, lead_receiver_id, lead_source_id, caller_assigned_id) to Master tables
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_no TEXT UNIQUE NOT NULL,
    lead_type_id UUID REFERENCES master_lead_types(id) ON DELETE SET NULL,
    lead_receiver_id UUID REFERENCES master_lead_receivers(id) ON DELETE SET NULL,
    lead_source_id UUID REFERENCES master_lead_sources(id) ON DELETE SET NULL,
    caller_assigned_id UUID REFERENCES master_caller_names(id) ON DELETE SET NULL,
    person_name TEXT NOT NULL,
    number TEXT NOT NULL,
    email TEXT,
    dob DATE,
    occupation TEXT,
    investment_budget TEXT,
    location TEXT,
    when_to_buy_plan TEXT,
    requirement TEXT,
    remarks TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
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
    next_date DATE NOT NULL,
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
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_leads_lead_type_id ON leads(lead_type_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_source_id ON leads(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_receiver_id ON leads(lead_receiver_id);
CREATE INDEX IF NOT EXISTS idx_leads_caller_assigned_id ON leads(caller_assigned_id);
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
    ('Life Insurance')
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
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Priya Iyer');

-- Seed Master Caller Names
INSERT INTO master_caller_names (lead_type_id, person_name) VALUES 
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Real Estate'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Mutual Fund'), 'Priya Iyer'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Rajesh Sharma'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Amit Patel'),
    ((SELECT id FROM master_lead_types WHERE lead_type = 'Life Insurance'), 'Priya Iyer');

-- Seed Settings
INSERT INTO system_settings (key, value) VALUES 
    ('groupHeads', '["IT", "HR", "Finance", "Operations", "Marketing"]'::jsonb),
    ('paymentModes', '["Cash", "Cheque", "Bank Transfer", "Online Payment"]'::jsonb),
    ('lastSerialNumber', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;