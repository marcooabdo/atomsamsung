export interface ScriptStep {
  id: string;
  aiText: string;
  thinkingDuration: number;
  cards: CardData[];
}

export interface CardData {
  id: string;
  type: 'alert' | 'metric' | 'chart' | 'status' | 'list';
  title: string;
  value?: string;
  subtitle?: string;
  color: 'red' | 'green' | 'cyan' | 'amber' | 'blue';
  icon?: string;
  items?: { label: string; value: string; status?: 'good' | 'bad' | 'neutral' }[];
  chartData?: { label: string; value: number }[];
  delay?: number;
}

export const GIA_SCRIPT: ScriptStep[] = [
  {
    id: 'greeting',
    aiText: 'Ola! Sou a GIA, sua assistente inteligente do ATOM. Vou analisar os dados operacionais em tempo real para voce. Iniciando varredura completa dos sistemas...',
    thinkingDuration: 2000,
    cards: [
      {
        id: 'system-status',
        type: 'status',
        title: 'Status dos Sistemas',
        color: 'cyan',
        items: [
          { label: 'Pipeline Operacional', value: 'Online', status: 'good' },
          { label: 'ATOM Finance', value: 'Online', status: 'good' },
          { label: 'Nucleo de Pecas', value: 'Online', status: 'good' },
          { label: 'Samsung GSPN', value: 'Sincronizado', status: 'good' },
        ],
        delay: 500,
      },
    ],
  },
  {
    id: 'pendencias',
    aiText: 'Encontrei 5 pendencias criticas na unidade Sao Bernardo. Existem ordens de servico aguardando aprovacao de orcamento ha mais de 48 horas. Recomendo atencao imediata.',
    thinkingDuration: 3000,
    cards: [
      {
        id: 'pendencias-sbc',
        type: 'alert',
        title: 'Pendencias SBC',
        value: '5',
        subtitle: 'Orcamentos aguardando > 48h',
        color: 'red',
        delay: 200,
      },
      {
        id: 'pendencias-detail',
        type: 'list',
        title: 'Detalhamento',
        color: 'red',
        items: [
          { label: 'OS #4521', value: 'iPhone 15 Pro - Tela', status: 'bad' },
          { label: 'OS #4518', value: 'Galaxy S24 - Placa', status: 'bad' },
          { label: 'OS #4515', value: 'MacBook Air - Bateria', status: 'bad' },
          { label: 'OS #4512', value: 'Galaxy Z Flip - Display', status: 'bad' },
          { label: 'OS #4509', value: 'iPad Pro - Conector', status: 'bad' },
        ],
        delay: 800,
      },
    ],
  },
  {
    id: 'faturamento',
    aiText: 'Excelente noticia! O faturamento de hoje atingiu 112% da meta diaria. A unidade Campinas liderou com R$ 18.400 em receita. O ticket medio subiu 8% em comparacao com a semana passada.',
    thinkingDuration: 2500,
    cards: [
      {
        id: 'faturamento-hoje',
        type: 'metric',
        title: 'Faturamento Hoje',
        value: 'R$ 42.850',
        subtitle: '112% da meta | +R$ 4.600',
        color: 'green',
        delay: 300,
      },
      {
        id: 'faturamento-chart',
        type: 'chart',
        title: 'Faturamento por Unidade',
        color: 'green',
        chartData: [
          { label: 'Campinas', value: 18400 },
          { label: 'Sao Bernardo', value: 12300 },
          { label: 'Osasco', value: 8150 },
          { label: 'Santo Andre', value: 4000 },
        ],
        delay: 900,
      },
    ],
  },
  {
    id: 'estoque',
    aiText: 'Atencao ao estoque de pecas Samsung. Temos 12 SKUs com estoque critico, incluindo telas Galaxy S24 Ultra e baterias do A54. Sugiro fazer um pedido de reposicao ainda hoje para evitar paradas na producao.',
    thinkingDuration: 2800,
    cards: [
      {
        id: 'estoque-critico',
        type: 'alert',
        title: 'Estoque Critico',
        value: '12',
        subtitle: 'SKUs abaixo do minimo',
        color: 'amber',
        delay: 400,
      },
      {
        id: 'estoque-items',
        type: 'list',
        title: 'Itens Prioritarios',
        color: 'amber',
        items: [
          { label: 'Tela S24 Ultra', value: '2 un.', status: 'bad' },
          { label: 'Bateria A54', value: '3 un.', status: 'bad' },
          { label: 'Conector iPhone 15', value: '5 un.', status: 'neutral' },
          { label: 'Display Z Flip 5', value: '1 un.', status: 'bad' },
        ],
        delay: 1000,
      },
    ],
  },
  {
    id: 'produtividade',
    aiText: 'A produtividade da equipe esta em alta. O time de Campinas completou 23 OS hoje, superando a media. O tecnico Rafael lidera o ranking Skywalker com 847 pontos. Parabens a equipe!',
    thinkingDuration: 2200,
    cards: [
      {
        id: 'produtividade-geral',
        type: 'metric',
        title: 'OS Concluidas Hoje',
        value: '67',
        subtitle: '+15% vs. media semanal',
        color: 'cyan',
        delay: 200,
      },
      {
        id: 'ranking-chart',
        type: 'chart',
        title: 'Ranking Skywalker - Top 4',
        color: 'blue',
        chartData: [
          { label: 'Rafael', value: 847 },
          { label: 'Ana', value: 792 },
          { label: 'Lucas', value: 685 },
          { label: 'Marcos', value: 620 },
        ],
        delay: 700,
      },
    ],
  },
];
