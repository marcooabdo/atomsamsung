import { resolveGIACommand, validateAndPlanRoute, saveRoutePlan, formatValidationErrors, formatConflicts, type GIARotaPlan, type GIARotaCommand } from '../../lib/giaRouteService';

export interface RouteCommandResult {
  handled: boolean;
  response?: string;
  plan?: GIARotaPlan;
  needsConfirmation?: boolean;
  confirmationMessage?: string;
}

const ROUTE_PATTERNS = [
  /monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:de|da)\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+)/i,
  /montar?\s+rota\s+(.+?)\s+(.+?)\s+t[ée]cnico\s+(.+)/i,
  /rota\s+(.+?)\s+(?:de|da)\s+(.+?)\s+(?:para|pro|pra)\s+(.+)/i,
  /gia[,.]?\s+monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:de|da)\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+)/i,
];

export function isRouteCommand(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return (
    (normalized.includes('monta') || normalized.includes('montar')) &&
    normalized.includes('rota') &&
    (normalized.includes('tecnico') || normalized.includes('técnico') || normalized.includes('para'))
  );
}

export function parseRouteCommand(text: string): GIARotaCommand | null {
  for (const pattern of ROUTE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        rota_nome: match[1].trim(),
        unidade_nome: match[2].trim(),
        tecnico_nome: match[3].trim(),
      };
    }
  }

  const normalized = text.toLowerCase();
  if (!normalized.includes('rota') || (!normalized.includes('monta') && !normalized.includes('montar'))) {
    return null;
  }

  return null;
}

export async function handleRouteCommand(text: string, dataInicio?: string): Promise<RouteCommandResult> {
  if (!isRouteCommand(text)) {
    return { handled: false };
  }

  const command = parseRouteCommand(text);
  if (!command) {
    return {
      handled: true,
      response: 'Não consegui entender o comando. Use o formato:\n\n"GIA, monta a rota [nome da rota] de [unidade] para o técnico [nome]"\n\nExemplo: "GIA, monta a rota rosa de Montes Claros para o técnico Erick"',
    };
  }

  const resolution = await resolveGIACommand(command);

  if ('type' in resolution) {
    return {
      handled: true,
      response: `Erro: ${resolution.message}`,
    };
  }

  const { unidade_id, tecnico_id, rota_id, rota_coluna_kanban } = resolution;

  const inicio = dataInicio || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await validateAndPlanRoute(unidade_id, tecnico_id, rota_id, rota_coluna_kanban, inicio);

  if ('errors' in result) {
    const errorMsg = formatValidationErrors(result.errors);
    return {
      handled: true,
      response: `Não consigo montar a rota. ${errorMsg}\n\nCorrija e peça novamente.`,
    };
  }

  const { plan } = result;

  if (plan.conflitos && plan.conflitos.length > 0) {
    const conflictMsg = formatConflicts(plan.conflitos);
    return {
      handled: true,
      plan,
      needsConfirmation: true,
      confirmationMessage: `Plano montado com ${plan.total_os} OS para ${plan.nome_tecnico} na ${plan.nome_rota}.\n\nPorém, ${conflictMsg}`,
    };
  }

  return {
    handled: true,
    plan,
    response: formatPlanSummary(plan),
  };
}

export async function confirmAndSaveRoute(plan: GIARotaPlan, criadoPor?: string): Promise<string> {
  const planoId = await saveRoutePlan(plan, criadoPor);
  if (!planoId) {
    return 'Erro ao salvar o plano da rota. Tente novamente.';
  }
  return `Rota salva com sucesso!\n\n${formatPlanSummary(plan)}\n\nVocê pode acompanhar o andamento na aba "GIA Rotas" do Otimizador.`;
}

function formatPlanSummary(plan: GIARotaPlan): string {
  const diasTotais = Math.max(...plan.paradas.map(p => p.dia));
  const totalTempo = plan.total_tempo_min;
  const horas = Math.floor(totalTempo / 60);
  const minutos = totalTempo % 60;

  let msg = `**Plano de Rota: ${plan.nome_rota}**\n`;
  msg += `Técnico: ${plan.nome_tecnico}\n`;
  msg += `Total: ${plan.total_os} OS em ${diasTotais} dia(s)\n`;
  msg += `Tempo estimado: ${horas}h${minutos > 0 ? `${minutos}min` : ''}\n\n`;

  for (let dia = 1; dia <= diasTotais; dia++) {
    const paradasDia = plan.paradas.filter(p => p.dia === dia);
    msg += `**Dia ${dia}** (${paradasDia.length} OS):\n`;
    for (const p of paradasDia) {
      const samsung = p.numero_samsung ? `${p.numero_samsung} | ` : '';
      const pecasStr = p.pecas.length > 0
        ? ` | Peças: ${p.pecas.map(pc => `${pc.pn}${pc.delivery ? ` (${pc.delivery})` : ''}`).join(', ')}`
        : '';
      msg += `  ${p.ordem}. ${samsung}${p.numero_interno} - ${p.cliente_nome} (${p.cidade || 'N/A'}) | ${p.tipo_reparo} ${p.tempo_estimado_min}min${pecasStr}\n`;
    }
    msg += '\n';
  }

  return msg;
}
