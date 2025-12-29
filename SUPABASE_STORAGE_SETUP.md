# Configuração de Storage Buckets do Supabase

## Buckets que Precisam Ser Criados Manualmente

Os seguintes storage buckets precisam ser criados no Dashboard do Supabase:

### 1. cotacoes-anexos

**Usado em:** CotacaoModal.tsx (5 referências)
**Propósito:** Armazenar anexos de orçamentos (PDFs, imagens, documentos)

**Configuração:**
```
Nome do Bucket: cotacoes-anexos
Público: true
Allowed MIME types: */*
File size limit: 50MB
```

**Criar via Dashboard:**
1. Acesse Supabase Dashboard → Storage
2. Clique em "New bucket"
3. Nome: `cotacoes-anexos`
4. Marque "Public bucket"
5. Clique em "Create bucket"

**Políticas RLS já existem** (criadas na migração 026)

---

### 2. os-anexos (ou os_anexos)

**Usado em:** OSModal.tsx, OSLPModal.tsx, GIModal.tsx, CheckinModal.tsx, CheckoutModal.tsx
**Propósito:** Armazenar anexos de ordens de serviço (fotos, relatórios, documentos técnicos)

**Configuração:**
```
Nome do Bucket: os-anexos
Público: true
Allowed MIME types: */*
File size limit: 100MB
```

**Criar via Dashboard:**
1. Acesse Supabase Dashboard → Storage
2. Clique em "New bucket"
3. Nome: `os-anexos`
4. Marque "Public bucket"
5. Clique em "Create bucket"

**Políticas RLS já existem** (criadas na migração 134)

---

## Buckets Já Criados (via Migrações)

### ✅ chat-files
- Migração: 058_create_chat_storage_bucket.sql
- Status: Criado e funcionando
- Uso: Chat de mensagens (imagens, áudios, documentos)

### ✅ pagamentos-comprovantes
- Migração: 064_create_pagamentos_storage_bucket.sql
- Status: Criado e funcionando
- Uso: Comprovantes de pagamento (PDFs, imagens de recibos)

---

## Verificar Buckets Criados

Execute no SQL Editor do Supabase:

```sql
SELECT
  id,
  name,
  public,
  created_at
FROM storage.buckets
ORDER BY created_at DESC;
```

Você deve ver 4 buckets:
- chat-files ✅
- pagamentos-comprovantes ✅
- cotacoes-anexos ⚠️ (criar manualmente)
- os-anexos ⚠️ (criar manualmente)

---

## Políticas RLS de Storage

Todas as políticas RLS para os buckets já foram criadas nas migrações:
- Migration 026: Políticas para cotacoes-anexos
- Migration 058: Políticas para chat-files
- Migration 064: Políticas para pagamentos-comprovantes
- Migration 134: Políticas para os-anexos

Você pode verificar com:

```sql
SELECT
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
```

---

## Teste Após Criação

Após criar os buckets, teste:

1. **cotacoes-anexos**: Abra uma cotação e tente anexar um arquivo
2. **os-anexos**: Abra uma OS e tente anexar uma foto ou documento

Se houver erros de permissão, verifique se as políticas RLS estão ativas:

```sql
-- Verificar políticas do bucket cotacoes-anexos
SELECT * FROM storage.objects WHERE bucket_id = 'cotacoes-anexos' LIMIT 1;

-- Verificar políticas do bucket os-anexos
SELECT * FROM storage.objects WHERE bucket_id = 'os-anexos' LIMIT 1;
```
