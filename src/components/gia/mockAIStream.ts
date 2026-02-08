import type { CardData } from './giaScript';

export interface StreamChunk {
  type: 'TEXT' | 'SHOW_CARD' | 'DONE';
  content?: string;
  card?: CardData;
}

interface MockScenario {
  chunks: StreamChunk[];
}

const SCENARIOS: MockScenario[] = [
  {
    chunks: [
      { type: 'TEXT', content: 'Analisando os dados operacionais em tempo real' },
      { type: 'TEXT', content: '... ' },
      { type: 'TEXT', content: 'Encontrei informacoes relevantes.\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'os-hoje',
          type: 'metric',
          title: 'OS Concluidas Hoje',
          value: '67',
          subtitle: '+15% vs. media semanal',
          color: 'cyan',
        },
      },
      { type: 'TEXT', content: 'Foram **67 ordens de servico** concluidas hoje, ' },
      { type: 'TEXT', content: 'representando um aumento de 15% em relacao a media semanal.\n\n' },
      { type: 'TEXT', content: 'Encontrei um **gargalo na expedicao**' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'shipping_alert',
          type: 'alert',
          title: 'Gargalo Expedicao',
          value: '12',
          subtitle: 'OS aguardando despacho > 24h',
          color: 'red',
        },
      },
      { type: 'TEXT', content: ' - existem 12 OS aguardando despacho ha mais de 24 horas.\n\n' },
      { type: 'TEXT', content: 'O faturamento esta em **R$ 42.850** ate agora,' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'faturamento',
          type: 'chart',
          title: 'Faturamento por Unidade',
          color: 'green',
          chartData: [
            { label: 'Campinas', value: 18400 },
            { label: 'Sao Bernardo', value: 12300 },
            { label: 'Osasco', value: 8150 },
            { label: 'Santo Andre', value: 4000 },
          ],
        },
      },
      { type: 'TEXT', content: ' atingindo **112%** da meta diaria. Campinas lidera com R$ 18.400.' },
      { type: 'DONE' },
    ],
  },
  {
    chunks: [
      { type: 'TEXT', content: 'Verificando o status do estoque...\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'estoque-status',
          type: 'status',
          title: 'Status Geral Estoque',
          color: 'cyan',
          items: [
            { label: 'Pecas Samsung', value: '342 un.', status: 'good' },
            { label: 'Pecas Apple', value: '89 un.', status: 'neutral' },
            { label: 'Pecas Xiaomi', value: '12 un.', status: 'bad' },
            { label: 'Acessorios', value: '567 un.', status: 'good' },
          ],
        },
      },
      { type: 'TEXT', content: '**Atencao ao estoque de pecas.**\n\n' },
      { type: 'TEXT', content: 'Temos **12 SKUs com estoque critico**, incluindo telas Galaxy S24 Ultra ' },
      { type: 'TEXT', content: 'e baterias do A54.\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'estoque-critico',
          type: 'alert',
          title: 'Estoque Critico',
          value: '12',
          subtitle: 'SKUs abaixo do minimo',
          color: 'amber',
        },
      },
      { type: 'TEXT', content: 'Sugiro fazer um **pedido de reposicao** ainda hoje para evitar paradas na producao.\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
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
        },
      },
      { type: 'DONE' },
    ],
  },
  {
    chunks: [
      { type: 'TEXT', content: 'Analisando a produtividade da equipe...\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'produtividade-geral',
          type: 'metric',
          title: 'Produtividade Hoje',
          value: '94%',
          subtitle: 'Acima da meta de 85%',
          color: 'green',
        },
      },
      { type: 'TEXT', content: 'A produtividade da equipe esta em **94%**, acima da meta de 85%.\n\n' },
      { type: 'TEXT', content: 'O time de Campinas completou **23 OS** hoje, superando a media. ' },
      { type: 'TEXT', content: 'O tecnico Rafael lidera o ranking Skywalker.\n\n' },
      {
        type: 'SHOW_CARD',
        card: {
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
        },
      },
      { type: 'TEXT', content: '**Destaques do dia:**\n' },
      { type: 'TEXT', content: '- Rafael completou 8 OS complexas\n' },
      { type: 'TEXT', content: '- Ana teve a melhor avaliacao do cliente\n' },
      { type: 'TEXT', content: '- Lucas reduziu o tempo medio de reparo em 12%' },
      {
        type: 'SHOW_CARD',
        card: {
          id: 'tempo-medio',
          type: 'metric',
          title: 'Tempo Medio de Reparo',
          value: '2h 15min',
          subtitle: '-12% vs. semana anterior',
          color: 'cyan',
        },
      },
      { type: 'DONE' },
    ],
  },
];

let scenarioIndex = 0;

export function createMockAIStream(
  onTextChunk: (text: string) => void,
  onCardTrigger: (card: CardData) => void,
  onDone: (fullText: string) => void,
): () => void {
  const scenario = SCENARIOS[scenarioIndex % SCENARIOS.length];
  scenarioIndex++;

  let cancelled = false;
  let fullText = '';
  let chunkIndex = 0;

  const processNext = () => {
    if (cancelled || chunkIndex >= scenario.chunks.length) return;

    const chunk = scenario.chunks[chunkIndex];
    chunkIndex++;

    if (chunk.type === 'TEXT' && chunk.content) {
      let charIndex = 0;
      const text = chunk.content;
      const streamChars = () => {
        if (cancelled) return;
        if (charIndex < text.length) {
          const charsToSend = Math.min(
            Math.floor(Math.random() * 3) + 1,
            text.length - charIndex,
          );
          const chars = text.slice(charIndex, charIndex + charsToSend);
          fullText += chars;
          onTextChunk(chars);
          charIndex += charsToSend;
          setTimeout(streamChars, 18 + Math.random() * 25);
        } else {
          setTimeout(processNext, 40);
        }
      };
      streamChars();
    } else if (chunk.type === 'SHOW_CARD' && chunk.card) {
      onCardTrigger(chunk.card);
      setTimeout(processNext, 80);
    } else if (chunk.type === 'DONE') {
      onDone(fullText);
    }
  };

  setTimeout(processNext, 600);

  return () => {
    cancelled = true;
  };
}
