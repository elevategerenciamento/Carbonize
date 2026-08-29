-- ═══════════════════════════════════════
-- MIGRAÇÃO: Limites de Tempo Operacional Customizáveis por Forno
-- Execute este script no SQL Editor do Supabase para atualizar a tabela 'kilns'
-- ═══════════════════════════════════════

-- Adiciona as colunas de threshold caso ainda não existam
ALTER TABLE kilns ADD COLUMN IF NOT EXISTS threshold_carbonizacao INT DEFAULT NULL;
ALTER TABLE kilns ADD COLUMN IF NOT EXISTS threshold_resfriamento INT DEFAULT NULL;
ALTER TABLE kilns ADD COLUMN IF NOT EXISTS threshold_carga INT DEFAULT NULL;
ALTER TABLE kilns ADD COLUMN IF NOT EXISTS threshold_descarga INT DEFAULT NULL;

-- Nota: A coluna 'modelo' existente na tabela 'kilns' não será excluída fisicamente do banco
-- para evitar perda de dados antigos, mas a aplicação deixará de utilizá-la conforme solicitado.
