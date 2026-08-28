-- ═══════════════════════════════════════
-- MIGRAÇÃO: Tabela closed_months
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS closed_months (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_ref TEXT NOT NULL, -- Formato 'YYYY-MM', ex: '2026-08'
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_month UNIQUE (user_id, month_ref)
);

-- HABILITAR RLS (Row Level Security)
ALTER TABLE closed_months ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE SEGURANÇA
CREATE POLICY "Users can view own closed months"
    ON closed_months FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own closed months"
    ON closed_months FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own closed months"
    ON closed_months FOR DELETE
    USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_closed_months_user_month ON closed_months(user_id, month_ref);
