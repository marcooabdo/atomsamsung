/*
# Normalize city names on insert/update

1. New Functions
  - `normalize_cidade_name()` - Trigger function that normalizes `cliente_cidade` to proper Title Case with correct accents for known Brazilian cities.

2. Changes
  - Adds a BEFORE INSERT OR UPDATE trigger on `os` table to auto-correct city names.
  - Updates all existing rows with inconsistent city name formatting.

3. Known cities mapped (with correct accents):
  - Teófilo Otoni, Montes Claros, Governador Valadares, Ipatinga, Manhuaçu, Uberlândia, etc.

4. Important Notes
  - Uses unaccented lowercase comparison to match cities regardless of input format.
  - Falls back to Title Case for unknown cities.
  - Non-destructive: only modifies `cliente_cidade` formatting, never loses the data.
*/

-- Create the normalization function
CREATE OR REPLACE FUNCTION public.normalize_cidade_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cidade_input text;
  cidade_key text;
  cidade_result text;
BEGIN
  cidade_input := TRIM(NEW.cliente_cidade);
  
  IF cidade_input IS NULL OR cidade_input = '' THEN
    RETURN NEW;
  END IF;

  -- Create normalized key (lowercase, no accents)
  cidade_key := LOWER(unaccent(cidade_input));

  -- Map known cities to their correct format
  cidade_result := CASE cidade_key
    WHEN 'teofilo otoni' THEN 'Teófilo Otoni'
    WHEN 'montes claros' THEN 'Montes Claros'
    WHEN 'governador valadares' THEN 'Governador Valadares'
    WHEN 'ipatinga' THEN 'Ipatinga'
    WHEN 'coronel fabriciano' THEN 'Coronel Fabriciano'
    WHEN 'timoteo' THEN 'Timóteo'
    WHEN 'caratinga' THEN 'Caratinga'
    WHEN 'manhuacu' THEN 'Manhuaçu'
    WHEN 'inhapim' THEN 'Inhapim'
    WHEN 'aimores' THEN 'Aimorés'
    WHEN 'itabira' THEN 'Itabira'
    WHEN 'joao monlevade' THEN 'João Monlevade'
    WHEN 'uberlandia' THEN 'Uberlândia'
    WHEN 'uberaba' THEN 'Uberaba'
    WHEN 'juiz de fora' THEN 'Juiz de Fora'
    WHEN 'belo horizonte' THEN 'Belo Horizonte'
    WHEN 'betim' THEN 'Betim'
    WHEN 'contagem' THEN 'Contagem'
    WHEN 'divinopolis' THEN 'Divinópolis'
    WHEN 'sete lagoas' THEN 'Sete Lagoas'
    WHEN 'pocos de caldas' THEN 'Poços de Caldas'
    WHEN 'patos de minas' THEN 'Patos de Minas'
    WHEN 'araguari' THEN 'Araguari'
    WHEN 'ituiutaba' THEN 'Ituiutaba'
    WHEN 'muriae' THEN 'Muriaé'
    WHEN 'vicosa' THEN 'Viçosa'
    WHEN 'barbacena' THEN 'Barbacena'
    WHEN 'lavras' THEN 'Lavras'
    WHEN 'varginha' THEN 'Varginha'
    WHEN 'pouso alegre' THEN 'Pouso Alegre'
    WHEN 'passos' THEN 'Passos'
    WHEN 'alfenas' THEN 'Alfenas'
    WHEN 'tres coracoes' THEN 'Três Corações'
    WHEN 'sao joao del rei' THEN 'São João del Rei'
    WHEN 'conselheiro lafaiete' THEN 'Conselheiro Lafaiete'
    WHEN 'ouro preto' THEN 'Ouro Preto'
    WHEN 'mariana' THEN 'Mariana'
    WHEN 'ponte nova' THEN 'Ponte Nova'
    WHEN 'leopoldina' THEN 'Leopoldina'
    WHEN 'cataguases' THEN 'Cataguases'
    WHEN 'uba' THEN 'Ubá'
    WHEN 'santos dumont' THEN 'Santos Dumont'
    WHEN 'itajuba' THEN 'Itajubá'
    WHEN 'sao lourenco' THEN 'São Lourenço'
    WHEN 'araxa' THEN 'Araxá'
    WHEN 'sacramento' THEN 'Sacramento'
    WHEN 'frutal' THEN 'Frutal'
    WHEN 'nanuque' THEN 'Nanuque'
    WHEN 'carlos chagas' THEN 'Carlos Chagas'
    WHEN 'almenara' THEN 'Almenara'
    WHEN 'aracuai' THEN 'Araçuaí'
    WHEN 'diamantina' THEN 'Diamantina'
    WHEN 'janauba' THEN 'Janaúba'
    WHEN 'januaria' THEN 'Januária'
    WHEN 'pirapora' THEN 'Pirapora'
    WHEN 'curvelo' THEN 'Curvelo'
    WHEN 'para de minas' THEN 'Pará de Minas'
    WHEN 'itauna' THEN 'Itaúna'
    WHEN 'formiga' THEN 'Formiga'
    WHEN 'bom despacho' THEN 'Bom Despacho'
    WHEN 'guanhaes' THEN 'Guanhães'
    WHEN 'novo cruzeiro' THEN 'Novo Cruzeiro'
    WHEN 'padre paraiso' THEN 'Padre Paraíso'
    WHEN 'pedra azul' THEN 'Pedra Azul'
    WHEN 'medina' THEN 'Medina'
    WHEN 'itaobim' THEN 'Itaobim'
    WHEN 'salinas' THEN 'Salinas'
    WHEN 'taiobeiras' THEN 'Taiobeiras'
    WHEN 'sao paulo' THEN 'São Paulo'
    WHEN 'rio de janeiro' THEN 'Rio de Janeiro'
    WHEN 'vitoria' THEN 'Vitória'
    WHEN 'vitoria da conquista' THEN 'Vitória da Conquista'
    WHEN 'salvador' THEN 'Salvador'
    WHEN 'brasilia' THEN 'Brasília'
    WHEN 'goiania' THEN 'Goiânia'
    WHEN 'curitiba' THEN 'Curitiba'
    WHEN 'florianopolis' THEN 'Florianópolis'
    WHEN 'porto alegre' THEN 'Porto Alegre'
    WHEN 'campinas' THEN 'Campinas'
    WHEN 'guarulhos' THEN 'Guarulhos'
    WHEN 'santo andre' THEN 'Santo André'
    WHEN 'sao bernardo do campo' THEN 'São Bernardo do Campo'
    WHEN 'osasco' THEN 'Osasco'
    WHEN 'ribeirao preto' THEN 'Ribeirão Preto'
    WHEN 'sorocaba' THEN 'Sorocaba'
    WHEN 'sao jose dos campos' THEN 'São José dos Campos'
    WHEN 'maceio' THEN 'Maceió'
    WHEN 'recife' THEN 'Recife'
    WHEN 'fortaleza' THEN 'Fortaleza'
    WHEN 'natal' THEN 'Natal'
    WHEN 'joao pessoa' THEN 'João Pessoa'
    WHEN 'manaus' THEN 'Manaus'
    WHEN 'belem' THEN 'Belém'
    WHEN 'sao luis' THEN 'São Luís'
    WHEN 'teresina' THEN 'Teresina'
    WHEN 'campo grande' THEN 'Campo Grande'
    WHEN 'cuiaba' THEN 'Cuiabá'
    ELSE NULL
  END;

  -- If not in the known list, apply title case
  IF cidade_result IS NULL THEN
    cidade_result := INITCAP(cidade_input);
  END IF;

  NEW.cliente_cidade := cidade_result;
  RETURN NEW;
END;
$$;

-- Enable unaccent extension if not already enabled
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_normalize_cidade ON public.os;
CREATE TRIGGER trg_normalize_cidade
  BEFORE INSERT OR UPDATE OF cliente_cidade ON public.os
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_cidade_name();

-- Normalize all existing city names in one pass
UPDATE public.os
SET cliente_cidade = cliente_cidade
WHERE cliente_cidade IS NOT NULL AND cliente_cidade != '';
