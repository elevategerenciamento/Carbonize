-- ═══════════════════════════════════════
-- MIGRAÇÃO: Adiciona suporte a Estágio do Forno no Histórico de Produção
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

ALTER TABLE production_history ADD COLUMN IF NOT EXISTS estagio VARCHAR(10);

-- Status persistente do forno: operacional ou manutencao.
ALTER TABLE kilns ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'operacional';
ALTER TABLE kilns DROP CONSTRAINT IF EXISTS kilns_status_check;
ALTER TABLE kilns ADD CONSTRAINT kilns_status_check CHECK (status IN ('operacional', 'manutencao'));
