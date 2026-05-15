-- ═══════════════════════════════════════
-- MIGRAÇÃO: Tabela fiscal_documents + Storage bucket
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════

-- 1. TABELA DE METADADOS DOS DOCUMENTOS FISCAIS
CREATE TABLE IF NOT EXISTS fiscal_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('nf_entrada', 'nf_saida', 'comprovante_pagamento', 'comprovante_recebimento', 'folha_pagamento', 'outros')),
    client TEXT NOT NULL,
    reference_date DATE NOT NULL,
    doc_number TEXT,
    description TEXT NOT NULL,
    value NUMERIC(12,2),
    file_path TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HABILITAR RLS (Row Level Security)
ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE SEGURANÇA
-- Usuários só veem seus próprios documentos
CREATE POLICY "Users can view own fiscal docs"
    ON fiscal_documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fiscal docs"
    ON fiscal_documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fiscal docs"
    ON fiscal_documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fiscal docs"
    ON fiscal_documents FOR DELETE
    USING (auth.uid() = user_id);

-- 4. CRIAR BUCKET DE STORAGE PARA ARQUIVOS FISCAIS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fiscal-docs',
    'fiscal-docs',
    false,
    52428800, -- 50MB limit
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- 5. POLÍTICAS DE STORAGE
-- Usuários podem fazer upload nos seus próprios diretórios
CREATE POLICY "Users can upload fiscal files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'fiscal-docs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Usuários podem ver seus próprios arquivos
CREATE POLICY "Users can view own fiscal files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'fiscal-docs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Usuários podem deletar seus próprios arquivos
CREATE POLICY "Users can delete own fiscal files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'fiscal-docs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- 6. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_user ON fiscal_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_category ON fiscal_documents(category);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_client ON fiscal_documents(client);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_date ON fiscal_documents(reference_date);
