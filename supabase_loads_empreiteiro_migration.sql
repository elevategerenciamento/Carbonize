-- ═══════════════════════════════════════════
-- MIGRAÇÃO: Novos campos em `loads` (Cargas/Romaneios)
-- Execute este script no SQL Editor do Supabase.
--
-- Adiciona:
--   - empreiteiro          (texto, opcional)
--   - data_saida_carvoaria (data, opcional)
--
-- Observação: a coluna `data` passa a representar a "Entrada no Destino".
-- ═══════════════════════════════════════════

ALTER TABLE loads ADD COLUMN IF NOT EXISTS empreiteiro TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS data_saida_carvoaria DATE;
