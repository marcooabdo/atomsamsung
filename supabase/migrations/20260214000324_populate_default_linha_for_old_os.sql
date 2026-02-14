/*
  # Popular Linha Padrão em OSs Antigas

  1. Objetivo
    - Popular o campo `aparelho_linha` em OSs antigas que não têm esse valor
    - Facilita a visualização de serviços disponíveis sem precisar editar cada OS

  2. Estratégia
    - Define "MX - Celular" como padrão para OSs sem linha definida
    - Mantém OSs que já têm linha definida inalteradas
    - Não afeta novas OSs criadas após esta migration

  3. Nota
    - Esta é uma migration de dados, não estrutural
    - O usuário pode alterar a linha manualmente em cada OS se necessário
*/

-- Popular linha padrão "MX - Celular" em OSs sem linha definida
UPDATE os
SET aparelho_linha = 'MX - Celular'
WHERE aparelho_linha IS NULL OR aparelho_linha = '';
