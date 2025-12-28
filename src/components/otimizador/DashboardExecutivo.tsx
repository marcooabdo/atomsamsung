import { Activity, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, XCircle, Target, Settings, FileSpreadsheet, BarChart3, Zap } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface PerformanceMetrics {
  eficienciaOperacional: {
    tempoMedio: number; // em minutos
    tempoAlvo: number;
    percentualEficiencia: number;
    totalOS: number;
    variacao: number; // comparado com mês anterior
  };
  taxaAprovacao: {
    aprovadas: number;
    reprovadas: number;
    percentual: number;
    total: number;
    variacao: number;
  };
  receitaLP: {
    atual: number;
    meta: number;
    percentualMeta: number;
    variacao: number;
    totalOS: number;
  };
  receitaOW: {
    atual: number;
    meta: number;
    percentualMeta: number;
    variacao: number;
    totalOS: number;
  };
}

interface DetailedOS {
  numero_os: string;
  cliente_nome: string;
  created_at: string;
  data_conclusao: string | null;
  tempo_resolucao_minutos: number;
  tipo_orcamento: string;
  valor_total: number;
  status_final: string;
}

export default function DashboardExecutivo() {
  const { selectedUnidade, refreshKey } = useOtimizador();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailType, setDetailType] = useState<'eficiencia' | 'aprovacao' | 'receitaLP' | 'receitaOW' | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedOS[]>([]);

  const [metas, setMetas] = useState({
    meta_receita_lp: 0,
    meta_receita_ow: 0,
    tempo_medio_resolucao_alvo: 240,
    taxa_aprovacao_minima: 80
  });

  useEffect(() => {
    if (selectedUnidade) {
      loadMetrics();
      loadGoals();
    }
  }, [selectedUnidade, refreshKey]);

  const loadGoals = async () => {
    if (!selectedUnidade) return;

    try {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();

      // Buscar meta de receita
      const { data: metaReceita } = await supabase
        .from('metas_receita')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();

      // Buscar indicadores de performance
      const { data: indicadores } = await supabase
        .from('indicadores_performance')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .maybeSingle();

      setMetas({
        meta_receita_lp: metaReceita?.meta_receita_lp || 0,
        meta_receita_ow: metaReceita?.meta_receita_ow || 0,
        tempo_medio_resolucao_alvo: indicadores?.tempo_medio_resolucao_alvo || 240,
        taxa_aprovacao_minima: indicadores?.taxa_aprovacao_minima || 80
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const loadMetrics = async () => {
    if (!selectedUnidade) return;

    setLoading(true);
    try {
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();

      // Calcular mês anterior
      let mesAnterior = mesAtual - 1;
      let anoAnterior = anoAtual;
      if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior = anoAtual - 1;
      }

      // Período do mês atual
      const inicioMesAtual = new Date(anoAtual, mesAtual - 1, 1).toISOString();
      const fimMesAtual = new Date(anoAtual, mesAtual, 0, 23, 59, 59).toISOString();

      // Período do mês anterior
      const inicioMesAnterior = new Date(anoAnterior, mesAnterior - 1, 1).toISOString();
      const fimMesAnterior = new Date(anoAnterior, mesAnterior, 0, 23, 59, 59).toISOString();

      // Buscar OSs do mês atual (finalizadas ou fechadas)
      const { data: osAtual } = await supabase
        .from('os')
        .select(`
          id,
          numero_os,
          created_at,
          tipo_orcamento,
          coluna_kanban,
          clientes(nome),
          cotacoes(
            id,
            status_aprovacao,
            valor_total_com_taxas
          )
        `)
        .eq('unidade_id', selectedUnidade)
        .gte('created_at', inicioMesAtual)
        .lte('created_at', fimMesAtual)
        .in('coluna_kanban', ['finalizada', 'os_fechada']);

      // Buscar OSs do mês anterior
      const { data: osAnterior } = await supabase
        .from('os')
        .select(`
          id,
          tipo_orcamento,
          coluna_kanban,
          cotacoes(
            id,
            status_aprovacao,
            valor_total_com_taxas
          )
        `)
        .eq('unidade_id', selectedUnidade)
        .gte('created_at', inicioMesAnterior)
        .lte('created_at', fimMesAnterior)
        .in('coluna_kanban', ['finalizada', 'os_fechada']);

      // Buscar logs de auditoria para calcular tempo de resolução (mês atual)
      const { data: logs } = await supabase
        .from('os_audit_logs')
        .select('os_id, campo_alterado, valor_novo, created_at')
        .eq('unidade_id', selectedUnidade)
        .eq('campo_alterado', 'coluna_kanban')
        .in('valor_novo', ['finalizada', 'os_fechada'])
        .gte('created_at', inicioMesAtual)
        .lte('created_at', fimMesAtual)
        .order('created_at');

      // Calcular métricas do mês atual
      const metricsAtual = calculateMetrics(osAtual || [], logs || []);
      const metricsAnterior = calculateMetrics(osAnterior || [], []);

      setMetrics({
        eficienciaOperacional: {
          ...metricsAtual.eficiencia,
          variacao: calculateVariation(
            metricsAtual.eficiencia.tempoMedio,
            metricsAnterior.eficiencia.tempoMedio,
            true // inverter porque menor é melhor
          )
        },
        taxaAprovacao: {
          ...metricsAtual.aprovacao,
          variacao: calculateVariation(
            metricsAtual.aprovacao.percentual,
            metricsAnterior.aprovacao.percentual
          )
        },
        receitaLP: {
          ...metricsAtual.receitaLP,
          variacao: calculateVariation(
            metricsAtual.receitaLP.atual,
            metricsAnterior.receitaLP.atual
          )
        },
        receitaOW: {
          ...metricsAtual.receitaOW,
          variacao: calculateVariation(
            metricsAtual.receitaOW.atual,
            metricsAnterior.receitaOW.atual
          )
        }
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (osData: any[], logs: any[]) => {
    // Criar mapa de tempo de resolução
    const tempoResolucaoMap = new Map<string, number>();
    logs.forEach(log => {
      if (!tempoResolucaoMap.has(log.os_id)) {
        tempoResolucaoMap.set(log.os_id, 0);
      }
    });

    // Calcular tempo de resolução
    let totalTempoMinutos = 0;
    let countComTempo = 0;

    osData.forEach(os => {
      const logFinal = logs.find(l => l.os_id === os.id);
      if (logFinal && os.created_at) {
        const inicio = new Date(os.created_at);
        const fim = new Date(logFinal.created_at);
        const minutos = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60));
        if (minutos > 0) {
          totalTempoMinutos += minutos;
          countComTempo++;
        }
      }
    });

    const tempoMedio = countComTempo > 0 ? Math.floor(totalTempoMinutos / countComTempo) : 0;
    const percentualEficiencia = metas.tempo_medio_resolucao_alvo > 0
      ? Math.min(100, Math.max(0, ((metas.tempo_medio_resolucao_alvo / (tempoMedio || 1)) * 100)))
      : 0;

    // Calcular aprovação/reprovação
    let aprovadas = 0;
    let reprovadas = 0;

    osData.forEach(os => {
      if (os.cotacoes && os.cotacoes.length > 0) {
        const cotacao = os.cotacoes[0];
        if (cotacao.status_aprovacao === 'aprovado') aprovadas++;
        else if (cotacao.status_aprovacao === 'reprovado') reprovadas++;
      }
    });

    const totalAprovacao = aprovadas + reprovadas;
    const percentualAprovacao = totalAprovacao > 0 ? (aprovadas / totalAprovacao) * 100 : 0;

    // Calcular receitas
    let receitaLP = 0;
    let receitaOW = 0;
    let countLP = 0;
    let countOW = 0;

    osData.forEach(os => {
      if (os.cotacoes && os.cotacoes.length > 0) {
        const cotacao = os.cotacoes[0];
        if (cotacao.status_aprovacao === 'aprovado' && cotacao.valor_total_com_taxas) {
          if (os.tipo_orcamento === 'LP') {
            receitaLP += Number(cotacao.valor_total_com_taxas);
            countLP++;
          } else if (os.tipo_orcamento === 'OW') {
            receitaOW += Number(cotacao.valor_total_com_taxas);
            countOW++;
          }
        }
      }
    });

    return {
      eficiencia: {
        tempoMedio,
        tempoAlvo: metas.tempo_medio_resolucao_alvo,
        percentualEficiencia,
        totalOS: countComTempo,
        variacao: 0
      },
      aprovacao: {
        aprovadas,
        reprovadas,
        percentual: percentualAprovacao,
        total: totalAprovacao,
        variacao: 0
      },
      receitaLP: {
        atual: receitaLP,
        meta: metas.meta_receita_lp,
        percentualMeta: metas.meta_receita_lp > 0 ? (receitaLP / metas.meta_receita_lp) * 100 : 0,
        variacao: 0,
        totalOS: countLP
      },
      receitaOW: {
        atual: receitaOW,
        meta: metas.meta_receita_ow,
        percentualMeta: metas.meta_receita_ow > 0 ? (receitaOW / metas.meta_receita_ow) * 100 : 0,
        variacao: 0,
        totalOS: countOW
      }
    };
  };

  const calculateVariation = (atual: number, anterior: number, inverter = false): number => {
    if (anterior === 0) return 0;
    const variacao = ((atual - anterior) / anterior) * 100;
    return inverter ? -variacao : variacao;
  };

  const handleSaveGoals = async () => {
    if (!selectedUnidade) return;

    try {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();

      // Salvar meta de receita
      const { error: errorReceita } = await supabase
        .from('metas_receita')
        .upsert({
          unidade_id: selectedUnidade,
          mes,
          ano,
          meta_receita_lp: metas.meta_receita_lp,
          meta_receita_ow: metas.meta_receita_ow
        }, {
          onConflict: 'unidade_id,mes,ano'
        });

      if (errorReceita) throw errorReceita;

      // Salvar indicadores
      const { error: errorIndicadores } = await supabase
        .from('indicadores_performance')
        .upsert({
          unidade_id: selectedUnidade,
          tempo_medio_resolucao_alvo: metas.tempo_medio_resolucao_alvo,
          taxa_aprovacao_minima: metas.taxa_aprovacao_minima
        }, {
          onConflict: 'unidade_id'
        });

      if (errorIndicadores) throw errorIndicadores;

      setShowGoalsModal(false);
      loadMetrics();
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Erro ao salvar metas');
    }
  };

  const handleShowDetails = async (type: 'eficiencia' | 'aprovacao' | 'receitaLP' | 'receitaOW') => {
    if (!selectedUnidade) return;

    setDetailType(type);
    setLoading(true);

    try {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();
      const inicio = new Date(ano, mes - 1, 1).toISOString();
      const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      let query = supabase
        .from('os')
        .select(`
          numero_os,
          created_at,
          tipo_orcamento,
          coluna_kanban,
          clientes(nome),
          cotacoes(
            id,
            status_aprovacao,
            valor_total_com_taxas
          )
        `)
        .eq('unidade_id', selectedUnidade)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .in('coluna_kanban', ['finalizada', 'os_fechada']);

      if (type === 'receitaLP') {
        query = query.eq('tipo_orcamento', 'LP');
      } else if (type === 'receitaOW') {
        query = query.eq('tipo_orcamento', 'OW');
      }

      const { data: osData } = await query;

      // Buscar logs de conclusão
      const { data: logs } = await supabase
        .from('os_audit_logs')
        .select('os_id, created_at')
        .eq('unidade_id', selectedUnidade)
        .eq('campo_alterado', 'coluna_kanban')
        .in('valor_novo', ['finalizada', 'os_fechada'])
        .gte('created_at', inicio)
        .lte('created_at', fim);

      const logMap = new Map(logs?.map(l => [l.os_id, l.created_at]) || []);

      const detailed: DetailedOS[] = (osData || []).map(os => {
        const dataConclusao = logMap.get(os.id) || null;
        const tempoMinutos = dataConclusao
          ? Math.floor((new Date(dataConclusao).getTime() - new Date(os.created_at).getTime()) / (1000 * 60))
          : 0;

        const cotacao = os.cotacoes?.[0];

        return {
          numero_os: os.numero_os,
          cliente_nome: os.clientes?.nome || 'N/A',
          created_at: os.created_at,
          data_conclusao: dataConclusao,
          tempo_resolucao_minutos: tempoMinutos,
          tipo_orcamento: os.tipo_orcamento || 'N/A',
          valor_total: cotacao?.valor_total_com_taxas || 0,
          status_final: cotacao?.status_aprovacao || 'pendente'
        };
      });

      // Filtrar por tipo
      let filtered = detailed;
      if (type === 'aprovacao') {
        filtered = detailed.filter(d => d.status_final === 'aprovado' || d.status_final === 'reprovado');
      }

      setDetailedData(filtered);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (detailedData.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(
      detailedData.map(d => ({
        'Número OS': d.numero_os,
        'Cliente': d.cliente_nome,
        'Data Criação': new Date(d.created_at).toLocaleString('pt-BR'),
        'Data Conclusão': d.data_conclusao ? new Date(d.data_conclusao).toLocaleString('pt-BR') : 'N/A',
        'Tempo Resolução (min)': d.tempo_resolucao_minutos,
        'Tempo Resolução (horas)': (d.tempo_resolucao_minutos / 60).toFixed(2),
        'Tipo': d.tipo_orcamento,
        'Valor Total': d.valor_total.toFixed(2),
        'Status': d.status_final
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalhes');

    const fileName = `performance_${detailType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            Central ATOM - Performance
          </h2>
          <p className="text-gray-400 mt-1">Análise científica de performance operacional</p>
        </div>
        <button
          onClick={() => setShowGoalsModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all"
        >
          <Settings className="w-4 h-4" />
          Configurar Metas
        </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {/* Eficiência Operacional */}
          <div
            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer"
            onClick={() => handleShowDetails('eficiencia')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Eficiência Operacional</p>
                  <p className="text-xs text-gray-500">Tempo médio de resolução</p>
                </div>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-blue-400">
                  {Math.floor(metrics.eficienciaOperacional.tempoMedio / 60)}h {metrics.eficienciaOperacional.tempoMedio % 60}m
                </p>
                <div className="flex items-center gap-1 mb-2">
                  {metrics.eficienciaOperacional.variacao > 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : metrics.eficienciaOperacional.variacao < 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : null}
                  <span className={`text-sm ${
                    metrics.eficienciaOperacional.variacao > 0 ? 'text-red-400' :
                    metrics.eficienciaOperacional.variacao < 0 ? 'text-green-400' :
                    'text-gray-400'
                  }`}>
                    {metrics.eficienciaOperacional.variacao === 0 ? '0%' : `${Math.abs(metrics.eficienciaOperacional.variacao).toFixed(1)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Meta: {Math.floor(metas.tempo_medio_resolucao_alvo / 60)}h {metas.tempo_medio_resolucao_alvo % 60}m</span>
                <span className="text-blue-400">{metrics.eficienciaOperacional.totalOS} OSs</span>
              </div>

              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.eficienciaOperacional.percentualEficiencia >= 80 ? 'bg-green-500' :
                    metrics.eficienciaOperacional.percentualEficiencia >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.eficienciaOperacional.percentualEficiencia)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {metrics.eficienciaOperacional.percentualEficiencia.toFixed(1)}% de eficiência
              </p>
            </div>
          </div>

          {/* Taxa de Aprovação */}
          <div
            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-green-500/20 transition-all cursor-pointer"
            onClick={() => handleShowDetails('aprovacao')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Taxa de Aprovação</p>
                  <p className="text-xs text-gray-500">Aprovados vs Reprovados</p>
                </div>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-green-400">
                  {metrics.taxaAprovacao.percentual.toFixed(1)}%
                </p>
                <div className="flex items-center gap-1 mb-2">
                  {metrics.taxaAprovacao.variacao > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : metrics.taxaAprovacao.variacao < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : null}
                  <span className={`text-sm ${
                    metrics.taxaAprovacao.variacao > 0 ? 'text-green-400' :
                    metrics.taxaAprovacao.variacao < 0 ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {metrics.taxaAprovacao.variacao === 0 ? '0%' : `${Math.abs(metrics.taxaAprovacao.variacao).toFixed(1)}%`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400">Aprovadas: <strong className="text-green-400">{metrics.taxaAprovacao.aprovadas}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-gray-400">Reprovadas: <strong className="text-red-400">{metrics.taxaAprovacao.reprovadas}</strong></span>
                </div>
              </div>

              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.taxaAprovacao.percentual >= metas.taxa_aprovacao_minima ? 'bg-green-500' :
                    metrics.taxaAprovacao.percentual >= metas.taxa_aprovacao_minima * 0.8 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.taxaAprovacao.percentual)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Meta: {metas.taxa_aprovacao_minima}% • Total: {metrics.taxaAprovacao.total} OSs
              </p>
            </div>
          </div>

          {/* Receita do Mês LP */}
          <div
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer"
            onClick={() => handleShowDetails('receitaLP')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Receita do Mês LP</p>
                  <p className="text-xs text-gray-500">Lost Profit - Samsung</p>
                </div>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-purple-400">
                  R$ {(metrics.receitaLP.atual / 1000).toFixed(1)}k
                </p>
                <div className="flex items-center gap-1 mb-2">
                  {metrics.receitaLP.variacao > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : metrics.receitaLP.variacao < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : null}
                  <span className={`text-sm ${
                    metrics.receitaLP.variacao > 0 ? 'text-green-400' :
                    metrics.receitaLP.variacao < 0 ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {metrics.receitaLP.variacao === 0 ? '0%' : `${Math.abs(metrics.receitaLP.variacao).toFixed(1)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Meta: R$ {(metas.meta_receita_lp / 1000).toFixed(1)}k</span>
                <span className="text-purple-400">{metrics.receitaLP.totalOS} OSs</span>
              </div>

              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.receitaLP.percentualMeta >= 100 ? 'bg-green-500' :
                    metrics.receitaLP.percentualMeta >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.receitaLP.percentualMeta)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {metrics.receitaLP.percentualMeta.toFixed(1)}% da meta
              </p>
            </div>
          </div>

          {/* Receita do Mês OW */}
          <div
            className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-6 hover:shadow-lg hover:shadow-orange-500/20 transition-all cursor-pointer"
            onClick={() => handleShowDetails('receitaOW')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Receita do Mês OW</p>
                  <p className="text-xs text-gray-500">Out of Warranty</p>
                </div>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>

            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-orange-400">
                  R$ {(metrics.receitaOW.atual / 1000).toFixed(1)}k
                </p>
                <div className="flex items-center gap-1 mb-2">
                  {metrics.receitaOW.variacao > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : metrics.receitaOW.variacao < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : null}
                  <span className={`text-sm ${
                    metrics.receitaOW.variacao > 0 ? 'text-green-400' :
                    metrics.receitaOW.variacao < 0 ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {metrics.receitaOW.variacao === 0 ? '0%' : `${Math.abs(metrics.receitaOW.variacao).toFixed(1)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Meta: R$ {(metas.meta_receita_ow / 1000).toFixed(1)}k</span>
                <span className="text-orange-400">{metrics.receitaOW.totalOS} OSs</span>
              </div>

              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.receitaOW.percentualMeta >= 100 ? 'bg-green-500' :
                    metrics.receitaOW.percentualMeta >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.receitaOW.percentualMeta)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {metrics.receitaOW.percentualMeta.toFixed(1)}% da meta
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Metas */}
      {showGoalsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full shadow-2xl shadow-cyan-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-cyan-400" />
                <h3 className="text-2xl font-bold text-white">Configurar Metas</h3>
              </div>
              <button
                onClick={() => setShowGoalsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Meta Receita LP (R$)</label>
                  <input
                    type="number"
                    value={metas.meta_receita_lp}
                    onChange={(e) => setMetas({ ...metas, meta_receita_lp: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Meta Receita OW (R$)</label>
                  <input
                    type="number"
                    value={metas.meta_receita_ow}
                    onChange={(e) => setMetas({ ...metas, meta_receita_ow: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Tempo Médio Alvo (minutos)</label>
                  <input
                    type="number"
                    value={metas.tempo_medio_resolucao_alvo}
                    onChange={(e) => setMetas({ ...metas, tempo_medio_resolucao_alvo: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Taxa Aprovação Mínima (%)</label>
                  <input
                    type="number"
                    value={metas.taxa_aprovacao_minima}
                    onChange={(e) => setMetas({ ...metas, taxa_aprovacao_minima: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveGoals}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all font-bold"
                >
                  Salvar Metas
                </button>
                <button
                  onClick={() => setShowGoalsModal(false)}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-cyan-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-cyan-400" />
                <h3 className="text-2xl font-bold text-white">
                  Detalhes - {
                    detailType === 'eficiencia' ? 'Eficiência Operacional' :
                    detailType === 'aprovacao' ? 'Taxa de Aprovação' :
                    detailType === 'receitaLP' ? 'Receita LP' :
                    'Receita OW'
                  }
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Número OS</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Cliente</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Data Criação</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Data Conclusão</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Tempo (horas)</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Tipo</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Valor</th>
                    <th className="text-left text-gray-400 text-sm py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedData.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-4 text-white">{item.numero_os}</td>
                      <td className="py-3 px-4 text-white">{item.cliente_nome}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {item.data_conclusao ? new Date(item.data_conclusao).toLocaleString('pt-BR') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-white">{(item.tempo_resolucao_minutos / 60).toFixed(1)}h</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.tipo_orcamento === 'LP' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {item.tipo_orcamento}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-green-400">R$ {item.valor_total.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status_final === 'aprovado' ? 'bg-green-500/20 text-green-400' :
                          item.status_final === 'reprovado' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.status_final}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detailedData.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  Nenhum dado encontrado para o período selecionado
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
