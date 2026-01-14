/*
  # Adicionar tipo 'evidencia' generico em os_anexos

  1. Alteracoes
    - Adiciona o tipo 'evidencia' generico a constraint
    - Necessario para evidencias que ainda nao foram categorizadas
*/

ALTER TABLE os_anexos DROP CONSTRAINT IF EXISTS os_anexos_tipo_check;

ALTER TABLE os_anexos ADD CONSTRAINT os_anexos_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'foto', 
    'video', 
    'documento',
    'peca_nova', 
    'peca_velha',
    'assinatura_tecnico', 
    'assinatura_cliente',
    'evidencia',
    'defeito',
    'reparo',
    'etiqueta_serial',
    'nota_fiscal',
    'menu_servico',
    'contador_erros',
    'qrcode_barras',
    'fachada'
  ]));
