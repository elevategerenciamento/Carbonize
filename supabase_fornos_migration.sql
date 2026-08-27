-- ═══════════════════════════════════════
-- MIGRAÇÃO: Adiciona suporte a Estágio do Forno no Histórico de Produção
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

ALTER TABLE production_history ADD COLUMN IF NOT EXISTS estagio VARCHAR(10);
