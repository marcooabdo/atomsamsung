import { supabase } from './supabase';

export type TipoRegraEnum = 'orcamento_aprovado' | 'pecas_recebidas' | 'escolha_rota' | 'peca_disponivel' | 'custom';
export type TipoMovimentacaoEnum = 'automatica' | 'manual';

export interface PipelineRegra {
  id: string;
  nome: string;
  descricao?: string;
  tipo_regra: TipoRegraEnum;
  coluna_origem: string;
  coluna_destino: string;
  condicoes: Record<string, any>;
  ativo: boolean;
  unidade_id?: string;
  execucoes_total: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineLog {
  id: string;
  os_id: string;
  regra_id?: string;
  coluna_origem: string;
  coluna_destino: string;
  tipo_movimentacao: TipoMovimentacaoEnum;
  motivo_texto?: string;
  usuario_id?: string;
  executado_em: string;
}

export interface PipelineErro {
  id: string;
  os_id: string;
  regra_id?: string;
  mensagem_erro: string;
  stack_trace?: string;
  timestamp: string;
}

export interface StatusPecasOS {
  os_id: string;
  total_pecas: number;
  pecas_recebidas_completas: number;
  pecas_pendentes: number;
  percentual_recebimento: number;
  todas_pecas_recebidas: boolean;
}

export const pipelineEngine = {
  async buscarRegras(unidadeId?: string): Promise<PipelineRegra[]> {
    let query = supabase
      .from('pipeline_regras')
      .select('*')
      .order('created_at', { ascending: false });

    if (unidadeId) {
      query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async buscarRegrasPorTipo(tipo: TipoRegraEnum, unidadeId?: string): Promise<PipelineRegra[]> {
    let query = supabase
      .from('pipeline_regras')
      .select('*')
      .eq('tipo_regra', tipo)
      .eq('ativo', true);

    if (unidadeId) {
      query = query.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async criarRegra(regra: Omit<PipelineRegra, 'id' | 'created_at' | 'updated_at' | 'execucoes_total'>): Promise<PipelineRegra> {
    const { data, error } = await supabase
      .from('pipeline_regras')
      .insert(regra)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async atualizarRegra(id: string, updates: Partial<PipelineRegra>): Promise<PipelineRegra> {
    const { data, error } = await supabase
      .from('pipeline_regras')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletarRegra(id: string): Promise<void> {
    const { error } = await supabase
      .from('pipeline_regras')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async alternarStatusRegra(id: string, ativo: boolean): Promise<void> {
    await this.atualizarRegra(id, { ativo });
  },

  async buscarLogsOS(osId: string): Promise<PipelineLog[]> {
    const { data, error } = await supabase
      .from('pipeline_logs')
      .select(`
        *,
        regra:pipeline_regras(nome, tipo_regra),
        usuario:usuarios(nome)
      `)
      .eq('os_id', osId)
      .order('executado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async buscarLogsPorPeriodo(dataInicio: string, dataFim: string, unidadeId?: string): Promise<PipelineLog[]> {
    let query = supabase
      .from('pipeline_logs')
      .select(`
        *,
        regra:pipeline_regras(nome, tipo_regra),
        usuario:usuarios(nome),
        os:os(numero_os_interna, unidade_id)
      `)
      .gte('executado_em', dataInicio)
      .lte('executado_em', dataFim)
      .order('executado_em', { ascending: false });

    if (unidadeId) {
      query = query.eq('os.unidade_id', unidadeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async buscarStatusPecasOS(osId: string): Promise<StatusPecasOS | null> {
    const { data, error } = await supabase
      .from('vw_os_status_pecas')
      .select('*')
      .eq('os_id', osId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async buscarErros(limite: number = 50): Promise<PipelineErro[]> {
    const { data, error } = await supabase
      .from('pipeline_erros')
      .select(`
        *,
        regra:pipeline_regras(nome, tipo_regra),
        os:os(numero_os_interna)
      `)
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return data || [];
  },

  async processar(osId: string, eventoGatilho?: string): Promise<void> {
    const { error } = await supabase.rpc('fn_processar_pipeline_automatico', {
      p_os_id: osId,
      p_evento_gatilho: eventoGatilho || null,
    });

    if (error) throw error;
  },

  async executarMovimentacao(
    osId: string,
    colunaDestino: string,
    regraId?: string,
    tipoMovimentacao: TipoMovimentacaoEnum = 'automatica',
    motivoTexto?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('fn_executar_movimentacao_pipeline', {
      p_os_id: osId,
      p_coluna_destino: colunaDestino,
      p_regra_id: regraId || null,
      p_tipo_movimentacao: tipoMovimentacao,
      p_motivo_texto: motivoTexto || null,
    });

    if (error) throw error;
    return data;
  },

  async atualizarQuantidadePeca(
    pecaId: string,
    quantidadeRecebida: number
  ): Promise<void> {
    const { error } = await supabase
      .from('os_pecas')
      .update({ quantidade_recebida: quantidadeRecebida })
      .eq('id', pecaId);

    if (error) throw error;
  },

  async registrarEntradaParcial(
    pecaId: string,
    quantidadeAdicional: number
  ): Promise<void> {
    const { data: peca } = await supabase
      .from('os_pecas')
      .select('quantidade_recebida')
      .eq('id', pecaId)
      .single();

    if (peca) {
      const novaQuantidade = (peca.quantidade_recebida || 0) + quantidadeAdicional;
      await this.atualizarQuantidadePeca(pecaId, novaQuantidade);
    }
  },

  async registrarEntradaTotal(pecaId: string): Promise<void> {
    const { data: peca } = await supabase
      .from('os_pecas')
      .select('quantidade_esperada')
      .eq('id', pecaId)
      .single();

    if (peca) {
      await this.atualizarQuantidadePeca(pecaId, peca.quantidade_esperada);
    }
  },

  async buscarPecasPendentesRecebimento(unidadeId?: string) {
    let query = supabase
      .from('os_pecas')
      .select(`
        *,
        os:os(
          id,
          numero_os_interna,
          numero_os_samsung,
          cliente_nome,
          unidade_id,
          coluna_kanban
        )
      `)
      .not('requisitada_em', 'is', null)
      .or('quantidade_recebida.lt.quantidade_esperada,quantidade_recebida.is.null');

    if (unidadeId) {
      query = query.eq('os.unidade_id', unidadeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async verificarBloqueioMovimentacao(osId: string): Promise<{ bloqueado: boolean; motivo?: string }> {
    const { data, error } = await supabase
      .from('os')
      .select('bloqueio_movimentacao_automatica, motivo_bloqueio')
      .eq('id', osId)
      .single();

    if (error) throw error;

    return {
      bloqueado: data?.bloqueio_movimentacao_automatica || false,
      motivo: data?.motivo_bloqueio,
    };
  },

  async alternarBloqueioMovimentacao(osId: string, bloqueado: boolean, motivo?: string): Promise<void> {
    const { error } = await supabase
      .from('os')
      .update({
        bloqueio_movimentacao_automatica: bloqueado,
        motivo_bloqueio: bloqueado ? motivo : null,
      })
      .eq('id', osId);

    if (error) throw error;
  },

  async buscarEficiencia(dataInicio: string, dataFim: string) {
    const { data, error } = await supabase
      .from('vw_pipeline_eficiencia')
      .select('*')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async buscarAuditRegras(regraId: string) {
    const { data, error } = await supabase
      .from('pipeline_regras_audit')
      .select(`
        *,
        usuario:usuarios(nome)
      `)
      .eq('regra_id', regraId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  gerarCondicoesIH(opcoes: {
    orçamentoAprovado?: boolean;
    todasPecasRecebidas?: boolean;
    cidadeEmRota?: boolean;
    requerPeca?: boolean;
  }): Record<string, any> {
    const condicoes: Record<string, any> = {
      tipo_atendimento: 'IH',
    };

    if (opcoes.todasPecasRecebidas !== undefined) {
      condicoes.todas_pecas_recebidas = opcoes.todasPecasRecebidas;
    }

    if (opcoes.cidadeEmRota !== undefined) {
      condicoes.cidade_cadastrada_em_rota = opcoes.cidadeEmRota;
    }

    if (opcoes.requerPeca !== undefined) {
      condicoes.requer_peca = opcoes.requerPeca;
    }

    return condicoes;
  },

  gerarCondicoesCI(opcoes: {
    requerPeca?: boolean;
  }): Record<string, any> {
    const condicoes: Record<string, any> = {
      tipo_atendimento: 'CI',
    };

    if (opcoes.requerPeca !== undefined) {
      condicoes.requer_peca = opcoes.requerPeca;
    }

    return condicoes;
  },

  gerarCondicoesSCACC(): Record<string, any> {
    return {
      tipo_os: ['SC', 'ACC'],
    };
  },
};
