/*
  # Adicionar coluna descricao à tabela os_anexos

  1. Alterações
    - Adiciona coluna `descricao` (text, opcional) à tabela `os_anexos`
    - Permite armazenar descrições detalhadas dos anexos (ex: "Foto da Peça Nova: PN123 - Display LCD")
  
  2. Notas
    - Coluna é opcional (NULL permitido)
    - Melhora rastreabilidade e organização dos anexos
*/

ALTER TABLE os_anexos ADD COLUMN IF NOT EXISTS descricao text;
