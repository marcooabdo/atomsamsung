import type { BadgeConfig, GIAAgentConfig, MuralTarefa } from './types';

export function getTaskBadge(titulo = '', descricao = ''): BadgeConfig {
  const text = `${titulo} ${descricao}`.toLowerCase();
  if (/aprovado|pix/.test(text))
    return { label: 'APROVADO', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.55)', color: '#34D399', glow: 'rgba(52,211,153,0.3)' };
  if (/orçamento|cotação|orcamento|cotacao/.test(text))
    return { label: 'ORÇAMENTO', bg: 'rgba(234,179,8,0.18)', border: 'rgba(234,179,8,0.5)', color: '#FACC15', glow: 'rgba(234,179,8,0.3)' };
  if (/garantia/.test(text))
    return { label: 'GARANTIA', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.5)', color: '#C084FC', glow: 'rgba(168,85,247,0.25)' };
  if (/status|acompanhamento/.test(text))
    return { label: 'ACOMPANHAMENTO', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.5)', color: '#22D3EE', glow: 'rgba(6,182,212,0.25)' };
  return { label: 'TRIAGEM', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', color: '#64748B', glow: null };
}

export function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${num}`, '_blank');
}

export function agentMatchesTask(agent: GIAAgentConfig, task: MuralTarefa): boolean {
  const resp = (task.gia_responsavel || '').toLowerCase();
  const agentLower = agent.name.toLowerCase();
  const shortLower = agent.shortName.toLowerCase();
  return resp.includes(shortLower) || resp.includes(agentLower.replace('gia ', ''));
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function sortTasks(list: MuralTarefa[]): MuralTarefa[] {
  return [...list].sort((a, b) => {
    if (a.prioridade === 'alta' && b.prioridade !== 'alta') return -1;
    if (a.prioridade !== 'alta' && b.prioridade === 'alta') return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
