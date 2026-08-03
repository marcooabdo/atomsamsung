import { resolveGIACommand, validateAndPlanRoute, saveRoutePlan, formatValidationErrors, formatConflicts, type GIARotaPlan, type GIARotaCommand } from '../../lib/giaRouteService';

export interface RouteCommandResult {
  handled: boolean;
  response?: string;
  plan?: GIARotaPlan;
  needsConfirmation?: boolean;
  confirmationMessage?: string;
}

const ROUTE_PATTERNS = [
  // "GIA monta a rota X para o técnico Y da unidade Z a partir do dia W"
  /monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+?)\s+a\s+partir\s+(?:do\s+)?dia\s+(.+)/i,
  // "monta a rota X para técnico Y da unidade Z"
  /monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+)/i,
  // "GIA, monta a rota X para Y da unidade Z a partir do dia W"
  /gia[,.]?\s+monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+?)\s+a\s+partir\s+(?:do\s+)?dia\s+(.+)/i,
  // "GIA, monta a rota X para Y da unidade Z"
  /gia[,.]?\s+monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[ée]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+)/i,
];

export function isRouteCommand(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return (
    (normalized.includes('monta') || normalized.includes('montar')) &&
    normalized.includes('rota') &&
    (normalized.includes('tecnico') || normalized.includes('técnico') || normalized.includes('para'))
  );
}

export function parseRouteCommand(text: string): (GIARotaCommand & { data_inicio?: string }) | null {
  for (const pattern of ROUTE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        rota_nome: match[1].trim(),
        tecnico_nome: match[2].trim(),
        unidade_nome: match[3].trim(),
        data_inicio: match[4]?.trim() || undefined,
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
      response: 'Não consegui entender o comando. Use o formato:\n\n"GIA monta a rota [nome] para o técnico [nome] da unidade [nome] a partir do dia [data]"\n\nExemplo: "GIA monta a rota rosa para o técnico Erick da unidade Montes Claros a partir do dia 10/08"',
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

  const inicio = parseDataInicio(command.data_inicio) || dataInicio || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

function parseDataInicio(input?: string): string | undefined {
  if (!input) return undefined;
  const clean = input.trim().replace(/^de\s+/i, '').replace(/^do\s+/i, '');

  // Format: dd/mm or dd/mm/yyyy or dd/mm/yy
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3]
      ? (slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }

  // Format: dd-mm-yyyy
  const dashMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const day = dashMatch[1].padStart(2, '0');
    const month = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3].length === 2 ? `20${dashMatch[3]}` : dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format: already yyyy-mm-dd
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return clean;

  // Just a number (day of current month)
  const dayOnly = clean.match(/^(\d{1,2})$/);
  if (dayOnly) {
    const now = new Date();
    const day = dayOnly[1].padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  return undefined;
}
