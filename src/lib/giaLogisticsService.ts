import { supabase } from './supabase';
import { geocodeAddress, geocodeCEP } from './geocoding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OSParaRoteirizar {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_cep: string | null;
  aparelho_linha: string | null;
  tecnico_designado_id: string | null;
  lat: number | null;
  lng: number | null;
  status_agendamento_gia: string | null;
  coluna_kanban: string | null;
  confirmado_com_cliente: boolean;
  unidade_id: string | null;
}

export interface RotaRascunho {
  id: string;
  nome: string;
  nome_sugerido: string | null;
  data_rota: string | null;
  status_rota: string;
  skill: string | null;
  cor: string | null;
  cidades: string[] | null;
  total_os: number;
  tecnico_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  unidade_id: string | null;
  os_list?: OSParaRoteirizar[];
}

export interface ResultadoProcessamento {
  total_os_encontradas: number;
  geolocalizadas: number;
  falhas_geocoding: number;
  rotas_criadas: number;
  erros: string[];
}

interface RotaConfig {
  id: string;
  nome: string;
  cor: string | null;
  coluna_kanban: string;
  cidades: string[];
}

interface Tecnico {
  id: string;
  nome: string;
  habilidades: string[] | null;
  horario_inicio_expediente: string | null;
  horario_fim_expediente: string | null;
}

interface PacoteAgendamento {
  tecnico: Tecnico;
  dataRota: string;
  osIds: string[];
  osList: OSParaRoteirizar[];
  rotaConfig: RotaConfig;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function geocodificarOS(os: OSParaRoteirizar): Promise<{ lat: number; lng: number } | null> {
  try {
    if (os.cliente_cep) {
      const coords = await geocodeCEP(os.cliente_cep);
      if (coords) return coords;
    }
    const partes = [os.cliente_endereco, os.cliente_bairro, os.cliente_cidade, 'Brasil']
      .filter(Boolean)
      .join(', ');
    if (partes) {
      const result = await geocodeAddress(partes);
      if (result) return { lat: result.lat, lng: result.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function proximoDiaUtil(data: Date): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Decide a data da rota com base na hora atual e no horário fim de expediente
 * do técnico. Corte padrão: 16:30 (tempo para pelo menos 1 OS ainda no dia).
 */
function calcularDataRota(tecnico: Tecnico): string {
  const agora = new Date();
  const fimStr = tecnico.horario_fim_expediente ?? '18:00:00';
  const [fimH, fimM] = fimStr.split(':').map(Number);

  // Corte: 90 min antes do fim do expediente
  const corteMinutos = fimH * 60 + fimM - 90;
  const agoraMinutos = agora.getHours() * 60 + agora.getMinutes();

  const diaSemana = agora.getDay();
  const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;

  if (!ehFimDeSemana && agoraMinutos <= corteMinutos) {
    return toDateString(agora);
  }
  return toDateString(proximoDiaUtil(agora));
}

/**
 * Verifica se um técnico tem habilidade para atender uma linha de aparelho.
 * Regra: se habilidades for null/vazio → técnico atende qualquer linha.
 */
function tecnicoTemHabilidade(tecnico: Tecnico, aparelhoLinha: string | null): boolean {
  if (!tecnico.habilidades || tecnico.habilidades.length === 0) return true;
  if (!aparelhoLinha) return true;
  return tecnico.habilidades.some(
    h => h.trim().toLowerCase() === aparelhoLinha.trim().toLowerCase()
  );
}

/**
 * Entre os técnicos aptos, escolhe o que tem menos OSs na agenda para a data.
 */
async function selecionarMelhorTecnico(
  aptos: Tecnico[],
  dataRota: string,
  unidadeId: string
): Promise<Tecnico | null> {
  if (aptos.length === 0) return null;
  if (aptos.length === 1) return aptos[0];

  const contagens: Record<string, number> = {};

  for (const t of aptos) {
    const { count } = await supabase
      .from('os')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .eq('tecnico_designado_id', t.id)
      .eq('status_agendamento_gia', 'em_rascunho');

    contagens[t.id] = count ?? 0;
  }

  return aptos.reduce((melhor, t) =>
    (contagens[t.id] ?? 0) < (contagens[melhor.id] ?? 0) ? t : melhor
  );
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

/**
 * Passo A → busca OSs em colunas de rota (coluna_kanban LIKE 'rota_%')
 *           que ainda não foram confirmadas e não têm rota_id.
 * Passo B → geolocaliza just-in-time as que não têm coordenadas.
 * Passo C → agrupa APENAS por coluna_kanban (a rota dita as regras).
 * Passo D → para cada grupo, faz match de skill por técnico (Time-Aware).
 * Passo E → cria rascunho em rotas_otimizadas e vincula as OSs.
 */
export async function processarNovasRotas(unidadeId: string): Promise<ResultadoProcessamento> {
  const resultado: ResultadoProcessamento = {
    total_os_encontradas: 0,
    geolocalizadas: 0,
    falhas_geocoding: 0,
    rotas_criadas: 0,
    erros: [],
  };

  try {
    // --- PASSO A: Pipeline da rota ---
    const { data: osList, error: osError } = await supabase
      .from('os')
      .select(
        'id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, ' +
        'cliente_endereco, cliente_bairro, cliente_cidade, cliente_cep, aparelho_linha, ' +
        'tecnico_designado_id, lat, lng, status_agendamento_gia, coluna_kanban, ' +
        'confirmado_com_cliente, unidade_id'
      )
      .eq('unidade_id', unidadeId)
      .like('coluna_kanban', 'rota_%')
      .eq('confirmado_com_cliente', false)
      .is('rota_id', null);

    if (osError) throw new Error(`Erro ao buscar OSs: ${osError.message}`);
    if (!osList || osList.length === 0) return resultado;

    resultado.total_os_encontradas = osList.length;

    // --- PASSO B: Geolocalização just-in-time ---
    const osComCoords: OSParaRoteirizar[] = [];

    for (const os of osList as OSParaRoteirizar[]) {
      await new Promise(r => setTimeout(r, 300));

      let { lat, lng } = os;

      if (!lat || !lng) {
        const coords = await geocodificarOS(os);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          await supabase.from('os').update({ lat, lng }).eq('id', os.id);
          resultado.geolocalizadas++;
        } else {
          resultado.falhas_geocoding++;
        }
      } else {
        resultado.geolocalizadas++;
      }

      osComCoords.push({ ...os, lat, lng });
    }

    // --- PASSO C: Agrupamento primário por coluna_kanban (a rota) ---
    const gruposPorRota = new Map<string, OSParaRoteirizar[]>();

    for (const os of osComCoords) {
      const coluna = os.coluna_kanban ?? 'sem_rota';
      if (!gruposPorRota.has(coluna)) gruposPorRota.set(coluna, []);
      gruposPorRota.get(coluna)!.push(os);
    }

    // Busca configuração de todas as rotas ativas da unidade
    const { data: rotasConfig } = await supabase
      .from('rotas')
      .select('id, nome, cor, coluna_kanban, cidades')
      .eq('unidade_id', unidadeId)
      .eq('ativa', true);

    const rotaMap = new Map<string, RotaConfig>(
      (rotasConfig ?? []).map(r => [r.coluna_kanban, r as RotaConfig])
    );

    // Busca técnicos ativos da unidade com habilidades e horário
    const { data: tecnicos } = await supabase
      .from('usuarios')
      .select('id, nome, habilidades, horario_inicio_expediente, horario_fim_expediente')
      .eq('unidade_id', unidadeId)
      .eq('tipo', 'tecnico')
      .eq('ativo', true);

    const listaTecnicos: Tecnico[] = (tecnicos ?? []) as Tecnico[];

    // --- PASSO D: Inteligência por rota → skill → técnico (Time-Aware) ---
    const pacotes: PacoteAgendamento[] = [];

    for (const [coluna, osDoGrupo] of gruposPorRota) {
      const rotaConfig = rotaMap.get(coluna);

      // Agrupa as OSs dentro da rota pelo aparelho_linha para fazer match de skill
      const subGruposPorSkill = new Map<string, OSParaRoteirizar[]>();
      for (const os of osDoGrupo) {
        const skill = (os.aparelho_linha ?? 'Geral').trim();
        if (!subGruposPorSkill.has(skill)) subGruposPorSkill.set(skill, []);
        subGruposPorSkill.get(skill)!.push(os);
      }

      for (const [skill, osDoSkill] of subGruposPorSkill) {
        // Filtra técnicos que atendem este skill
        const aptosParaSkill = listaTecnicos.filter(t => tecnicoTemHabilidade(t, skill));

        // Técnico pré-designado nas OSs tem prioridade
        const tecnicoPreDesignado = osDoSkill.find(os => os.tecnico_designado_id)?.tecnico_designado_id;
        let tecnicoEscolhido: Tecnico | null = null;

        if (tecnicoPreDesignado) {
          tecnicoEscolhido = aptosParaSkill.find(t => t.id === tecnicoPreDesignado) ?? null;
        }

        if (!tecnicoEscolhido) {
          tecnicoEscolhido = await selecionarMelhorTecnico(aptosParaSkill, toDateString(new Date()), unidadeId);
        }

        if (!tecnicoEscolhido) {
          // Sem técnico apto: registra sem tecnico, segue para rascunho
          tecnicoEscolhido = { id: '', nome: 'Sem técnico', habilidades: null, horario_inicio_expediente: null, horario_fim_expediente: null };
        }

        const dataRota = calcularDataRota(tecnicoEscolhido);

        pacotes.push({
          tecnico: tecnicoEscolhido,
          dataRota,
          osIds: osDoSkill.map(o => o.id),
          osList: osDoSkill,
          rotaConfig: rotaConfig ?? {
            id: '',
            nome: coluna,
            cor: null,
            coluna_kanban: coluna,
            cidades: [],
          },
        });
      }
    }

    // --- PASSO E: Cria rascunhos em rotas_otimizadas ---
    for (const pacote of pacotes) {
      try {
        const nomeSugerido = pacote.rotaConfig.nome
          ? `${pacote.rotaConfig.nome} — ${pacote.tecnico.nome}`
          : `GIA Rota — ${pacote.tecnico.nome}`;

        const skills = [...new Set(pacote.osList.map(o => o.aparelho_linha ?? 'Geral'))].join(', ');
        const cidades = [...new Set(pacote.osList.map(o => o.cliente_cidade).filter(Boolean))] as string[];

        const { data: rota, error: rotaError } = await supabase
          .from('rotas_otimizadas')
          .insert({
            unidade_id: unidadeId,
            tecnico_id: pacote.tecnico.id || null,
            nome: nomeSugerido,
            nome_sugerido: nomeSugerido,
            data_rota: pacote.dataRota,
            status_rota: 'rascunho',
            skill: skills,
            cor: pacote.rotaConfig.cor ?? null,
            cidades,
            total_os: pacote.osIds.length,
            metadata: {
              gerado_por: 'GIA Logistics',
              coluna_kanban_origem: pacote.rotaConfig.coluna_kanban,
              os_ids: pacote.osIds,
            },
          })
          .select('id')
          .single();

        if (rotaError || !rota) {
          resultado.erros.push(
            `Falha ao criar rota para ${pacote.rotaConfig.nome}/${skills}: ${rotaError?.message}`
          );
          continue;
        }

        await supabase
          .from('os')
          .update({ rota_id: rota.id, status_agendamento_gia: 'em_rascunho' })
          .in('id', pacote.osIds);

        resultado.rotas_criadas++;
      } catch (err) {
        resultado.erros.push(`Erro no pacote ${pacote.rotaConfig.nome}: ${err}`);
      }
    }
  } catch (err) {
    resultado.erros.push(`Erro geral: ${err}`);
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function buscarRotasRascunho(unidadeId: string): Promise<RotaRascunho[]> {
  const { data, error } = await supabase
    .from('rotas_otimizadas')
    .select('*')
    .eq('unidade_id', unidadeId)
    .eq('status_rota', 'rascunho')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as RotaRascunho[];
}

export async function buscarOSdaRota(rotaId: string): Promise<OSParaRoteirizar[]> {
  const { data, error } = await supabase
    .from('os')
    .select(
      'id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, ' +
      'cliente_endereco, cliente_bairro, cliente_cidade, cliente_cep, aparelho_linha, ' +
      'tecnico_designado_id, lat, lng, status_agendamento_gia, coluna_kanban, ' +
      'confirmado_com_cliente, unidade_id'
    )
    .eq('rota_id', rotaId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as OSParaRoteirizar[];
}

export async function descartarRota(rotaId: string): Promise<boolean> {
  try {
    await supabase
      .from('os')
      .update({ rota_id: null, status_agendamento_gia: 'pronta_para_roteirizar' })
      .eq('rota_id', rotaId);

    const { error } = await supabase
      .from('rotas_otimizadas')
      .delete()
      .eq('id', rotaId);

    return !error;
  } catch {
    return false;
  }
}

export async function aprovarRota(rotaId: string, osIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('rotas_otimizadas')
      .update({ status_rota: 'aprovada_notificando' })
      .eq('id', rotaId);

    if (error) return false;

    await supabase
      .from('os')
      .update({ status_agendamento_gia: 'aguardando_confirmacao_cliente' })
      .in('id', osIds);

    return true;
  } catch {
    return false;
  }
}

export async function marcarRotaLiberada(rotaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('rotas_otimizadas')
    .update({ status_rota: 'liberada_tecnico' })
    .eq('id', rotaId);
  return !error;
}
