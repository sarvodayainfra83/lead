-- ============================================================================
-- RECEPTION / VISITOR MANAGEMENT MODULE MIGRATION
-- Table: public.visitor_logs
-- Execute this script directly in Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    company_name TEXT,
    visitor_type TEXT DEFAULT 'Guest', -- 'Client', 'Vendor', 'Job Applicant', 'Partner', 'Guest', 'Official', 'Other'
    visit_purpose TEXT NOT NULL,       -- 'Meeting', 'Site Visit', 'Supply Item', 'Broking', 'Other'
    visit_location TEXT NOT NULL DEFAULT 'Office', -- 'Office', 'Construction Site'
    project_name TEXT,
    project_id TEXT,
    person_to_meet_id TEXT,
    person_to_meet_name TEXT NOT NULL,
    department TEXT,
    person_actually_met_id TEXT,
    person_actually_met_name TEXT,
    remarks TEXT,
    checkout_remarks TEXT,
    check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_at TIMESTAMPTZ,
    checked_in_by TEXT,
    checked_in_by_id TEXT,
    checked_out_by TEXT,
    checked_out_by_id TEXT,
    status TEXT NOT NULL DEFAULT 'CHECKED_IN' CHECK (status IN ('CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitor_logs_status ON public.visitor_logs(status);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_check_in ON public.visitor_logs(check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_purpose ON public.visitor_logs(visit_purpose);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_person_to_meet ON public.visitor_logs(person_to_meet_name);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_mobile ON public.visitor_logs(mobile_number);

-- Enable Row Level Security (RLS)
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon access (matching existing app RLS pattern)
DROP POLICY IF EXISTS "Allow public all on visitor_logs" ON public.visitor_logs;
CREATE POLICY "Allow public all on visitor_logs" ON public.visitor_logs FOR ALL USING (true) WITH CHECK (true);
