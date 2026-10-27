-- ============================================================================
-- BROKER MASTER MODULE MIGRATION
-- Table: public.brokers
-- Execute this script directly in the Supabase SQL Editor.
--
-- SAFETY GUARANTEE:
-- 1. Uses 'CREATE TABLE IF NOT EXISTS' - will NOT drop or alter any existing table.
-- 2. Uses 'ALTER TABLE ... ADD COLUMN IF NOT EXISTS' - completely non-destructive.
-- 3. Uses 'CREATE INDEX IF NOT EXISTS' - completely non-destructive.
-- 4. Isolated to 'brokers' table only - zero impact on leads, users, products, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Foreign Key to logged-in user who added the broker
    created_by_name TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    email TEXT NOT NULL,
    business_name TEXT,
    deal_preferred TEXT NOT NULL,
    pan TEXT NOT NULL,
    aadhar_no TEXT NOT NULL,
    business_address TEXT NOT NULL,
    rera_no TEXT NOT NULL,
    photo_url TEXT,
    business_photo_url TEXT,
    project_type TEXT NOT NULL,
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Non-destructive column addition (if table was already created earlier)
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Indexes for fast searching and filtering (Non-destructive)
CREATE INDEX IF NOT EXISTS idx_brokers_user_id ON public.brokers(user_id);
CREATE INDEX IF NOT EXISTS idx_brokers_phone ON public.brokers(phone);
CREATE INDEX IF NOT EXISTS idx_brokers_email ON public.brokers(email);
CREATE INDEX IF NOT EXISTS idx_brokers_pan ON public.brokers(pan);
CREATE INDEX IF NOT EXISTS idx_brokers_rera ON public.brokers(rera_no);
CREATE INDEX IF NOT EXISTS idx_brokers_project_type ON public.brokers(project_type);
CREATE INDEX IF NOT EXISTS idx_brokers_deal_preferred ON public.brokers(deal_preferred);
CREATE INDEX IF NOT EXISTS idx_brokers_created_at ON public.brokers(created_at DESC);

-- Enable Row Level Security (RLS) safely
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon access (matches existing app RLS policies)
DROP POLICY IF EXISTS "Allow all access on brokers" ON public.brokers;
CREATE POLICY "Allow all access on brokers" ON public.brokers FOR ALL USING (true) WITH CHECK (true);
