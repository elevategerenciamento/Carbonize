-- ═══════════════════════════════════════
-- MIGRAÇÃO: Tabela user_settings para tempos médios operacionais
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    threshold_carbonizacao INT DEFAULT 2,
    threshold_resfriamento INT DEFAULT 2,
    threshold_carga INT DEFAULT 1,
    threshold_descarga INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HABILITAR RLS (Row Level Security)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE SEGURANÇA
CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
