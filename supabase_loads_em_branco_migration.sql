-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Campos "deixar em branco no relatório" em `loads`
-- Execute este script no SQL Editor do Supabase.
--
-- Adiciona:
--   - saida_em_branco   (boolean) → data "Saída da Carvoaria" sai VAZIA no PDF
--   - entrada_em_branco (boolean) → data "Entrada no Destino" sai VAZIA no PDF
--
-- Quando marcadas no formulário do romaneio, a data correspondente é
-- omitida no relatório em PDF para ser preenchida à mão no papel.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE loads ADD COLUMN IF NOT EXISTS saida_em_branco BOOLEAN DEFAULT FALSE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS entrada_em_branco BOOLEAN DEFAULT FALSE;
