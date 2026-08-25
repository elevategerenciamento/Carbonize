-- ═══════════════════════════════════════
-- MIGRAÇÃO: Adiciona suporte à Data de Descarregamento nas Cargas
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

ALTER TABLE loads ADD COLUMN IF NOT EXISTS data_descarregamento DATE;
