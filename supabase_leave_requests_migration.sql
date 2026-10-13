-- ============================================================================
-- ATTENDANCE LEAVE REQUESTS MODULE MIGRATION
-- Table: public.leave_requests
-- Execute this script directly in Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_name TEXT NOT NULL,
    user_position TEXT,
    leave_type TEXT NOT NULL DEFAULT 'Full Day', -- 'Full Day', 'Half Day (First Half)', 'Half Day (Second Half)'
    leave_category TEXT NOT NULL DEFAULT 'Casual Leave', -- 'Casual Leave', 'Sick / Medical Leave', 'Emergency Leave', 'Planned / Vacation Leave', 'Other'
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days NUMERIC(4, 1) DEFAULT 1,
    reason TEXT NOT NULL,
    document_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by TEXT,
    reviewed_by_id TEXT,
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & query speed
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created ON public.leave_requests(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon access (matching existing app RLS pattern)
DROP POLICY IF EXISTS "Allow public all on leave_requests" ON public.leave_requests;
CREATE POLICY "Allow public all on leave_requests" ON public.leave_requests FOR ALL USING (true) WITH CHECK (true);
