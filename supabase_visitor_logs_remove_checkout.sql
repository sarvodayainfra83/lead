-- ============================================================================
-- RECEPTION / VISITOR MANAGEMENT: REMOVE CHECK-OUT
-- Table: public.visitor_logs
-- Reception only records who came, when, and for what purpose; there is no
-- check-out, "inside now" or status any more. Drops those columns.
-- Only touches public.visitor_logs. Execute in the Supabase SQL Editor.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_visitor_logs_status;

ALTER TABLE public.visitor_logs
    DROP COLUMN IF EXISTS status,                 -- also drops its CHECK constraint
    DROP COLUMN IF EXISTS check_out_at,
    DROP COLUMN IF EXISTS checked_out_by,
    DROP COLUMN IF EXISTS checked_out_by_id,
    DROP COLUMN IF EXISTS checkout_remarks,
    DROP COLUMN IF EXISTS person_actually_met_id,
    DROP COLUMN IF EXISTS person_actually_met_name;
