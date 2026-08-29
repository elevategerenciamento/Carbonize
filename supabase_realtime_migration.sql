-- ═══════════════════════════════════════
-- MIGRAÇÃO: Habilitação de Sincronização em Tempo Real (Realtime)
-- Execute este script no SQL Editor do Supabase para ativar a transmissão em tempo real nas tabelas
-- ═══════════════════════════════════════

-- Habilita o Realtime para as tabelas principais operacionais
-- Caso o comando retorne que a tabela já está na publicação, pode ignorar o aviso.
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE kilns;
ALTER PUBLICATION supabase_realtime ADD TABLE production_history;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance;
