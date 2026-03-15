/*
  # Fix tipo_os for samsung_contigo and acessorios

  OS records with tipo_orcamento = 'samsung_contigo' or 'acessorios' must always
  have tipo_os = 'OW'. This migration corrects existing records that are incorrectly
  set to 'LP'.
*/

UPDATE os
SET tipo_os = 'OW'
WHERE tipo_orcamento IN ('samsung_contigo', 'acessorios')
  AND tipo_os != 'OW';
