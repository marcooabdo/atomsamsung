/*
  # Expandir tipos de evidencias permitidos em os_anexos

  1. Alteracoes
    - Remove a constraint antiga que nao incluia todos os tipos de evidencia
    - Adiciona nova constraint com TODOS os tipos usados pelo mobile:
      - Tipos basicos: foto, video, documento
      - Tipos de peca: peca_nova, peca_velha
      - Tipos de assinatura: assinatura_tecnico, assinatura_cliente
      - Tipos de evidencia: defeito, reparo, etiqueta_serial, nota_fiscal, 
        menu_servico, contador_erros, qrcode_barras, fachada
  
  2. Notas
    - Essa mudanca corrige o problema das fotos do mobile nao aparecendo
    - Os inserts estavam falhando devido a constraint restritiva
*/

-- Remove constraint antiga
ALTER TABLE os_anexos DROP CONSTRAINT IF EXISTS os_anexos_tipo_check;

-- Adiciona nova constraint com TODOS os tipos
ALTER TABLE os_anexos ADD CONSTRAINT os_anexos_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    -- Tipos basicos
    'foto', 
    'video', 
    'documento',
    -- Tipos de peca
    'peca_nova', 
    'peca_velha',
    -- Tipos de assinatura
    'assinatura_tecnico', 
    'assinatura_cliente',
    -- Tipos de evidencia
    'defeito',
    'reparo',
    'etiqueta_serial',
    'nota_fiscal',
    'menu_servico',
    'contador_erros',
    'qrcode_barras',
    'fachada'
  ]));
