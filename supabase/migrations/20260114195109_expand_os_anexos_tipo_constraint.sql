/*
  # Expandir tipos permitidos em os_anexos

  1. Alteracoes
    - Remove a constraint antiga que limitava tipo a ('foto', 'video', 'documento')
    - Adiciona nova constraint com tipos adicionais para suportar anexos do mobile:
      - peca_nova: Foto da peca nova instalada
      - peca_velha: Foto da peca substituida
      - evidencia: Fotos de evidencia do servico
      - assinatura_tecnico: Assinatura do tecnico
      - assinatura_cliente: Assinatura do cliente
  
  2. Notas
    - Essa mudanca permite que o aplicativo mobile salve anexos corretamente
    - Anteriormente os inserts falhavam silenciosamente devido a constraint
*/

-- Remove constraint antiga
ALTER TABLE os_anexos DROP CONSTRAINT IF EXISTS os_anexos_tipo_check;

-- Adiciona nova constraint com mais tipos
ALTER TABLE os_anexos ADD CONSTRAINT os_anexos_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'foto', 
    'video', 
    'documento', 
    'peca_nova', 
    'peca_velha', 
    'evidencia', 
    'assinatura_tecnico', 
    'assinatura_cliente'
  ]));
