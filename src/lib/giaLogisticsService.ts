import { supabase } from './supabase';
import { geocodeAddress, geocodeCEP } from './geocoding';

export interface OSParaRoteirizar {
  id: string;
  numero_os_interna: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_cep: string | null;
  equipamento_linha: string | null;
  tecnico_designado: string | null;
  lat: number | null;
  lng: number | null;
  status_agendamento_gia: string | null;
}

export interface GrupoRota {
  cidade: string;
  skill: string;
  tecnico_id: string | null;
  os_ids: string[];
  os_list: OSParaRoteirizar[];
}

export interface ResultadoProcessamento {
  total_os_encontradas: number;
  geolocalizadas: number;
  falhas_geocoding: number;
  rotas_criadas: number;
  erros: string[];
}

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

export async function processarNovasRotas(unidadeId: string): Promise<ResultadoProcessamento> {
  const resultado: ResultadoProcessamento = {
    total_os_encontradas: 0,
    geolocalizadas: 0,
    falhas_geocoding: 0,
    rotas_criadas: 0,
    erros: [],
  };

  try {
    const { data: osList, error } = await supabase
      .from('os')
      .select('id, numero_os_interna, cliente_nome, cliente_telefone, cliente_endereco, cliente_bairro, cliente_cidade, cliente_cep, equipamento_linha, tecnico_designado, lat, lng, status_agendamento_gia')
      .eq('unidade_id', unidadeId)
      .eq('status_agendamento_gia', 'pronta_para_roteirizar');

    if (error) throw new Error(`Erro ao buscar OSs: ${error.message}`);
    if (!osList || osList.length === 0) return resultado;

    resultado.total_os_encontradas = osList.length;

    const osComCoords: OSParaRoteirizar[] = [];

    for (const os of osList as OSParaRoteirizar[]) {
      await new Promise(r => setTimeout(r, 300));

      let lat = os.lat;
      let lng = os.lng;

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

    const grupos: Map<string, GrupoRota> = new Map();

    for (const os of osComCoords) {
      const cidade = (os.cliente_cidade || 'Sem Cidade').trim();
      const skill = (os.equipamento_linha || 'Geral').trim();
      const chave = `${cidade}::${skill}`;

      if (!grupos.has(chave)) {
        grupos.set(chave, { cidade, skill, tecnico_id: os.tecnico_designado, os_ids: [], os_list: [] });
      }

      const grupo = grupos.get(chave)!;
      grupo.os_ids.push(os.id);
      grupo.os_list.push(os);
      if (!grupo.tecnico_id && os.tecnico_designado) {
        grupo.tecnico_id = os.tecnico_designado;
      }
    }

    for (const [, grupo] of grupos) {
      try {
        const { data: rota, error: rotaError } = await supabase
          .from('rotas_otimizadas')
          .insert({
            unidade_id: unidadeId,
            tecnico_id: grupo.tecnico_id,
            nome: `GIA - ${grupo.cidade} (${grupo.skill})`,
            data_rota: new Date().toISOString().split('T')[0],
            status_rota: 'rascunho',
            skill: grupo.skill,
            cidades: [grupo.cidade],
            total_os: grupo.os_ids.length,
            metadata: { gerado_por: 'GIA Logistics', os_ids: grupo.os_ids },
          })
          .select('id')
          .single();

        if (rotaError || !rota) {
          resultado.erros.push(`Falha ao criar rota para ${grupo.cidade}/${grupo.skill}: ${rotaError?.message}`);
          continue;
        }

        await supabase
          .from('os')
          .update({ rota_id: rota.id, status_agendamento_gia: 'em_rascunho' })
          .in('id', grupo.os_ids);

        resultado.rotas_criadas++;
      } catch (err) {
        resultado.erros.push(`Erro no grupo ${grupo.cidade}/${grupo.skill}: ${err}`);
      }
    }
  } catch (err) {
    resultado.erros.push(`Erro geral: ${err}`);
  }

  return resultado;
}

export interface RotaRascunho {
  id: string;
  nome: string;
  data_rota: string | null;
  status_rota: string;
  skill: string | null;
  cidades: string[] | null;
  total_os: number;
  tecnico_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  unidade_id: string | null;
  os_list?: OSParaRoteirizar[];
}

export async function buscarRotasRascunho(unidadeId: string): Promise<RotaRascunho[]> {
  const { data, error } = await supabase
    .from('rotas_otimizadas')
    .select('*')
    .eq('unidade_id', unidadeId)
    .eq('status_rota', 'rascunho')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as RotaRascunho[];
}

export async function buscarOSdaRota(rotaId: string): Promise<OSParaRoteirizar[]> {
  const { data, error } = await supabase
    .from('os')
    .select('id, numero_os_interna, cliente_nome, cliente_telefone, cliente_endereco, cliente_bairro, cliente_cidade, cliente_cep, equipamento_linha, tecnico_designado, lat, lng, status_agendamento_gia')
    .eq('rota_id', rotaId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as OSParaRoteirizar[];
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
