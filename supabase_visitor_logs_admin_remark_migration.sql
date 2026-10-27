-- ============================================================================
-- RECEPTION / VISITOR MANAGEMENT: ADD ADMIN REMARK COLUMNS
-- Table: public.visitor_logs
-- Execute this script directly in your Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.visitor_logs
    ADD COLUMN IF NOT EXISTS admin_remark TEXT,
    ADD COLUMN IF NOT EXISTS admin_remark_date TIMESTAMPTZ;

-- Performance index for visitors with admin remarks
CREATE INDEX IF NOT EXISTS idx_visitor_logs_admin_remark ON public.visitor_logs(admin_remark_date DESC);
