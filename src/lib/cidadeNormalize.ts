const CIDADES_ACENTUADAS: Record<string, string> = {
  'teofilo otoni': 'Teófilo Otoni',
  'governador valadares': 'Governador Valadares',
  'montes claros': 'Montes Claros',
  'ipatinga': 'Ipatinga',
  'coronel fabriciano': 'Coronel Fabriciano',
  'timoteo': 'Timóteo',
  'caratinga': 'Caratinga',
  'manhuacu': 'Manhuaçu',
  'inhapim': 'Inhapim',
  'aimorés': 'Aimorés',
  'aimores': 'Aimorés',
  'itabira': 'Itabira',
  'joao monlevade': 'João Monlevade',
  'uberlandia': 'Uberlândia',
  'uberaba': 'Uberaba',
  'juiz de fora': 'Juiz de Fora',
  'belo horizonte': 'Belo Horizonte',
  'betim': 'Betim',
  'contagem': 'Contagem',
  'divinopolis': 'Divinópolis',
  'sete lagoas': 'Sete Lagoas',
  'pocos de caldas': 'Poços de Caldas',
  'patos de minas': 'Patos de Minas',
  'araguari': 'Araguari',
  'ituiutaba': 'Ituiutaba',
  'muriae': 'Muriaé',
  'vicosa': 'Viçosa',
  'barbacena': 'Barbacena',
  'lavras': 'Lavras',
  'varginha': 'Varginha',
  'pouso alegre': 'Pouso Alegre',
  'passos': 'Passos',
  'alfenas': 'Alfenas',
  'tres coracoes': 'Três Corações',
  'sao joao del rei': 'São João del Rei',
  'conselheiro lafaiete': 'Conselheiro Lafaiete',
  'ouro preto': 'Ouro Preto',
  'mariana': 'Mariana',
  'ponte nova': 'Ponte Nova',
  'leopoldina': 'Leopoldina',
  'cataguases': 'Cataguases',
  'uba': 'Ubá',
  'santos dumont': 'Santos Dumont',
  'itajuba': 'Itajubá',
  'sao lourenco': 'São Lourenço',
  'araxa': 'Araxá',
  'sacramento': 'Sacramento',
  'frutal': 'Frutal',
  'nanuque': 'Nanuque',
  'carlos chagas': 'Carlos Chagas',
  'almenara': 'Almenara',
  'aracuai': 'Araçuaí',
  'diamantina': 'Diamantina',
  'janauba': 'Janaúba',
  'januaria': 'Januária',
  'pirapora': 'Pirapora',
  'curvelo': 'Curvelo',
  'para de minas': 'Pará de Minas',
  'itauna': 'Itaúna',
  'formiga': 'Formiga',
  'bom despacho': 'Bom Despacho',
  'guanhaes': 'Guanhães',
  'novo cruzeiro': 'Novo Cruzeiro',
  'padre paraiso': 'Padre Paraíso',
  'pedra azul': 'Pedra Azul',
  'medina': 'Medina',
  'itaobim': 'Itaobim',
  'salinas': 'Salinas',
  'taiobeiras': 'Taiobeiras',
  'sao paulo': 'São Paulo',
  'rio de janeiro': 'Rio de Janeiro',
  'vitoria': 'Vitória',
  'vitoria da conquista': 'Vitória da Conquista',
  'salvador': 'Salvador',
  'brasilia': 'Brasília',
  'goiania': 'Goiânia',
  'curitiba': 'Curitiba',
  'florianopolis': 'Florianópolis',
  'porto alegre': 'Porto Alegre',
  'campinas': 'Campinas',
  'guarulhos': 'Guarulhos',
  'santo andre': 'Santo André',
  'sao bernardo do campo': 'São Bernardo do Campo',
  'osasco': 'Osasco',
  'ribeirao preto': 'Ribeirão Preto',
  'sorocaba': 'Sorocaba',
  'sao jose dos campos': 'São José dos Campos',
  'maceio': 'Maceió',
  'recife': 'Recife',
  'fortaleza': 'Fortaleza',
  'natal': 'Natal',
  'joao pessoa': 'João Pessoa',
  'manaus': 'Manaus',
  'belem': 'Belém',
  'sao luis': 'São Luís',
  'teresina': 'Teresina',
  'campo grande': 'Campo Grande',
  'cuiaba': 'Cuiabá',
};

const PREPOSICOES = new Set(['de', 'da', 'do', 'das', 'dos', 'del', 'e']);

export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toTitleCase(str: string): string {
  return str
    .split(' ')
    .filter(w => w.length > 0)
    .map((word, index) => {
      if (index > 0 && PREPOSICOES.has(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function normalizarCidade(cidade: string | null | undefined): string {
  if (!cidade) return '';
  const trimmed = cidade.trim();
  if (!trimmed) return '';

  const key = removeAccents(trimmed).toLowerCase();

  if (CIDADES_ACENTUADAS[key]) {
    return CIDADES_ACENTUADAS[key];
  }

  return toTitleCase(trimmed);
}
