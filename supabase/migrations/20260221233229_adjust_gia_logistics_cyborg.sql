/*
  # GIA Logistics Cyborg — Ajustes de suporte ao modelo Human-Led, AI-Assisted

  ## Mudanças

  ### Tabela usuarios
  - `habilidades` TEXT[] — array de linhas de produto que o técnico atende
    (garantia de existência; se já foi criada por migration anterior, ignora)

  ### Tabela os
  - `whatsapp_sent_at` TIMESTAMPTZ — timestamp do último disparo de confirmação via WhatsApp
    Usado para rastrear timeout de resposta do cliente

  ### Função check_whatsapp_timeout_and_notify()
  - Cria tarefa no Mural da GIA para OSs que não receberam resposta em 2h
  - Evita duplicação verificando se já existe alerta pendente para a mesma OS
*/

-- 1. habilidades dos técnicos (já pode existir de migration anterior)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS habilidades TEXT[] DEFAULT '{}';

-- 2. controle de disparo de WhatsApp na OS
ALTER TABLE os ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- 3. Verifica quais colunas existem em gia_mural_tarefas para construir a fn corretamente
-- A função insere apenas as colunas garantidamente presentes na tabela

CREATE OR REPLACE FUNCTION check_whatsapp_timeout_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO gia_mural_tarefas (
    unidade_id,
    os_id,
    os_numero,
    titulo,
    descricao,
    gia_source,
    prioridade,
    status
  )
  SELECT
    o.unidade_id,
    o.id,
    COALESCE(o.numero_os_samsung, o.numero_os_interna, ''),
    'Cliente nao respondeu ao Agendamento',
    'O cliente da OS ' || COALESCE(o.numero_os_interna, o.numero_os_samsung, '') ||
    ' (' || COALESCE(o.cliente_nome, '') || ') nao respondeu ao WhatsApp ha mais de 2 horas. Ligar para confirmar.',
    'CONNECT',
    'alta',
    'pendente'
  FROM os o
  WHERE
    o.whatsapp_sent_at < NOW() - INTERVAL '2 hours'
    AND o.status_agendamento_gia = 'aguardando_confirmacao_cliente'
    AND o.confirmado_com_cliente = false
    AND o.id NOT IN (
      SELECT gm.os_id
      FROM gia_mural_tarefas gm
      WHERE
        gm.titulo = 'Cliente nao respondeu ao Agendamento'
        AND gm.status = 'pendente'
        AND gm.os_id IS NOT NULL
    );
END;
$$;
