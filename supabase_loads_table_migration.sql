-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Garante a existência da tabela `loads` (Romaneios/Cargas)
-- Execute este script no SQL Editor do Supabase.
--
-- Motivo: o app envia inserts em `loads` com as colunas abaixo, mas
-- nenhuma migração do repositório CRIava a tabela. Se a tabela não
-- existe (ou tem colunas diferentes), TODO insert falha silenciosamente
-- e as cargas "somem" ao sair e voltar ao sistema.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Cria a tabela `loads` se não existir, com TODAS as colunas usadas pelo app.
CREATE TABLE IF NOT EXISTS loads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    produto TEXT,
    identificador TEXT,
    placa TEXT,
    motorista TEXT,
    transportador TEXT,
    empreiteiro TEXT,
    observacao TEXT,
    data DATE,
    data_saida_carvoaria DATE,
    data_descarregamento DATE,
    metragem NUMERIC,
    tara NUMERIC,
    liquido NUMERIC,
    bruto NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Garante que colunas faltantes sejam adicionadas (caso a tabela já exista).
ALTER TABLE loads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS produto TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS identificador TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS motorista TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS transportador TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS empreiteiro TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS data DATE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS data_saida_carvoaria DATE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS data_descarregamento DATE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS metragem NUMERIC;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS tara NUMERIC;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS liquido NUMERIC;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS bruto NUMERIC;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3) Habilita Row Level Security e políticas por usuário.
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loads_select_own" ON loads;
CREATE POLICY "loads_select_own" ON loads
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "loads_insert_own" ON loads;
CREATE POLICY "loads_insert_own" ON loads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "loads_update_own" ON loads;
CREATE POLICY "loads_update_own" ON loads
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "loads_delete_own" ON loads;
CREATE POLICY "loads_delete_own" ON loads
    FOR DELETE USING (auth.uid() = user_id);

-- 4) Habilita Realtime para a tabela (ignora aviso se já estiver na publicação).
ALTER PUBLICATION supabase_realtime ADD TABLE loads;
