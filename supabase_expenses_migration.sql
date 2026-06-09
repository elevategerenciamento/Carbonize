-- ═══════════════════════════════════════
-- MIGRAÇÃO: Adiciona suporte a Planilhas Rápidas nos Custos
-- Execute este script no SQL Editor do Supabase se ainda não tiver feito
-- ═══════════════════════════════════════

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS spreadsheet_name TEXT;
CREATE INDEX IF NOT EXISTS idx_expenses_spreadsheet_name ON expenses(spreadsheet_name);
