import { supabase } from './supabase';

interface InstanciaEvolution {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  unidade_id: string | null;
  status: string;
}

function formatarTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

async function buscarInstancia(unidadeId: string): Promise<InstanciaEvolution | null> {
  const { data } = await supabase
    .from('atom_connect_instancias')
    .select('id, instance_name, api_url, api_key, unidade_id, status')
    .eq('unidade_id', unidadeId)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as InstanciaEvolution | null;
}

async function enviarMensagemEvolution(
  instancia: InstanciaEvolution,
  telefone: string,
  mensagem: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${instancia.api_url}/message/sendText/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: instancia.api_key,
        },
        body: JSON.stringify({
          number: telefone,
          text: mensagem,
        }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export interface DadosConfirmacaoAgendamento {
  os_id: string;
  cliente_nome: string;
  telefone: string;
  data_agendamento: string;
  tecnico_nome: string;
  unidade_id: string;
}

export async function enviarConfirmacaoAgendamento(
  dados: DadosConfirmacaoAgendamento
): Promise<{ sucesso: boolean; motivo?: string }> {
  const { os_id, cliente_nome, telefone, data_agendamento, tecnico_nome, unidade_id } = dados;

  const instancia = await buscarInstancia(unidade_id);

  if (!instancia) {
    return { sucesso: false, motivo: 'Nenhuma instância WhatsApp conectada para esta unidade' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  const mensagem =
    `Olá *${cliente_nome}*! Aqui é a assistente virtual da Autorizada Samsung. ` +
    `Seu atendimento com o técnico *${tecnico_nome}* foi pré-agendado para *${data_agendamento}*.\n\n` +
    `Por favor, responda com:\n` +
    `*[ 1 ]* - Para CONFIRMAR.\n` +
    `*[ 2 ]* - Para REMARCAR.`;

  const sucesso = await enviarMensagemEvolution(instancia, telefoneFormatado, mensagem);

  if (sucesso) {
    await supabase
      .from('os')
      .update({ status_agendamento_gia: 'aguardando_confirmacao_cliente' })
      .eq('id', os_id);
  }

  return { sucesso, motivo: sucesso ? undefined : 'Falha na API do WhatsApp' };
}

export async function enviarLoteConfirmacoes(
  osList: DadosConfirmacaoAgendamento[]
): Promise<{ total: number; enviados: number; falhas: number }> {
  let enviados = 0;
  let falhas = 0;

  for (const os of osList) {
    await new Promise(r => setTimeout(r, 500));
    const resultado = await enviarConfirmacaoAgendamento(os);
    if (resultado.sucesso) {
      enviados++;
    } else {
      falhas++;
    }
  }

  return { total: osList.length, enviados, falhas };
}
