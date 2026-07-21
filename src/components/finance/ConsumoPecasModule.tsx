import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package, Search, Download, AlertTriangle, CheckCircle,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ConsumoPecasModuleProps {
  unidadeId: string | null;
  dataInicio: string;
  dataFim: string;
}

interface PecaConsumida {
  id: string;
  cotacao_peca_id: string | null;
  os_id: string | null;
  cotacao_id: string | null;
  codigo_peca: string;
  descricao: string | null;
  status: string;
  tipo_devolucao: string | null;
  gi_postada_em: string;
  peca_estoque_id: string | null;
  valor_peca: number;
  unidade_id: string;
  cotacao_peca?: {
    pn: string;
    descricao: string | null;
    quantidade: number;
    valor_base_gspn: number;
  };
  peca_estoque?: {
    id_numerico: number;
    valor_com_impostos: number | null;
  };
  os?: {
    numero_os_interna: string | null;
    numero_os_samsung: string | null;
    cliente_nome: string;
    tipo_os: string;
  };
  cotacao?: {
    numero_cotacao: number;
    tipo_os: string | null;
    cliente_nome: string | null;
  };
}

export default function ConsumoPecasModule({ unidadeId, dataInicio, dataFim }: ConsumoPecasModuleProps) {
  const [loading, setLoading] = useState(true);
  const [pecas, setPecas] = useState<PecaConsumida[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [selectedPeca, setSelectedPeca] = useState<PecaConsumida | null>(null);
  const [unidades, setUnidades] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    loadPecas();
  }, [unidadeId, dataInicio, dataFim, filtroTipo, filtroStatus]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(u => { map[u.id] = u.nome; });
      setUnidades(map);
    }
  };

  const loadPecas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          cotacao_peca:cotacoes_pecas(pn, descricao, quantidade, valor_base_gspn),
          peca_estoque:estoque_pecas(id_numerico, valor_com_impostos),
          os:os(numero_os_interna, numero_os_samsung, cliente_nome, tipo_os),
          cotacao:cotacoes(numero_cotacao, tipo_os, cliente_nome)
        `)
        .not('gi_postada_em', 'is', null)
        .order('gi_postada_em', { ascending: false });

      if (dataInicio) {
        query = query.gte('gi_postada_em', `${dataInicio}T00:00:00`);
      }
      if (dataFim) {
        query = query.lte('gi_postada_em', `${dataFim}T23:59:59`);
      }
      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }

      const { data: requisicoes, error } = await query.limit(500);
      if (error) throw error;

      let filteredData = requisicoes || [];

      if (filtroTipo) {
        filteredData = filteredData.filter(p => {
          const tipoOS = p.os?.tipo_os || p.cotacao?.tipo_os;
          return tipoOS === filtroTipo;
        });
      }

      if (filtroStatus) {
        if (filtroStatus === 'com_id') {
          filteredData = filteredData.filter(p => p.peca_estoque_id);
        } else if (filtroStatus === 'sem_id') {
          filteredData = filteredData.filter(p => !p.peca_estoque_id);
        } else if (filtroStatus === 'usada') {
          filteredData = filteredData.filter(p => p.tipo_devolucao === 'usada');
        }
      }

      setPecas(filteredData);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getValorReal = (peca: PecaConsumida) => {
    if (peca.peca_estoque?.valor_com_impostos) {
      return Number(peca.peca_estoque.valor_com_impostos);
    }
    if (peca.cotacao_peca?.valor_base_gspn) {
      return Number(peca.cotacao_peca.valor_base_gspn);
    }
    return Number(peca.valor_peca) || 0;
  };

  const handleExportar = () => {
    const dadosExport = pecasFiltradas.map(p => {
      const tipoOS = p.os?.tipo_os || p.cotacao?.tipo_os || '';
      const valorReal = getValorReal(p);
      const pn = p.cotacao_peca?.pn || p.codigo_peca;
      return {
        'Data GI': p.gi_postada_em ? new Date(p.gi_postada_em).toLocaleDateString('pt-BR') : '',
        'Tipo': tipoOS,
        'PN': pn,
        'Descricao': p.cotacao_peca?.descricao || p.descricao || '',
        'ID Peca': p.peca_estoque?.id_numerico || 'Sem ID',
        'Valor GSPN': p.cotacao_peca?.valor_base_gspn || p.valor_peca || 0,
        'Valor Real (ID)': valorReal,
        'OS': p.os?.numero_os_samsung || p.os?.numero_os_interna || '',
        'Cotacao': p.cotacao?.numero_cotacao || '',
        'Cliente': p.os?.cliente_nome || p.cotacao?.cliente_nome || '',
        'Unidade': unidades[p.unidade_id] || '',
        'Status': p.status,
        'Tipo Devolucao': p.tipo_devolucao || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consumo Peças');
    XLSX.writeFile(wb, `consumo_pecas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const pecasFiltradas = pecas.filter(p => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    const pn = p.cotacao_peca?.pn || p.codigo_peca || '';
    return (
      pn.toLowerCase().includes(termo) ||
      p.cotacao_peca?.descricao?.toLowerCase().includes(termo) ||
      p.descricao?.toLowerCase().includes(termo) ||
      p.os?.numero_os_interna?.toLowerCase().includes(termo) ||
      p.os?.numero_os_samsung?.toLowerCase().includes(termo) ||
      p.os?.cliente_nome?.toLowerCase().includes(termo) ||
      p.cotacao?.cliente_nome?.toLowerCase().includes(termo) ||
      String(p.peca_estoque?.id_numerico || '').includes(termo)
    );
  });

  const totalLP = pecasFiltradas
    .filter(p => (p.os?.tipo_os || p.cotacao?.tipo_os) === 'LP')
    .reduce((sum, p) => sum + getValorReal(p), 0);

  const totalOW = pecasFiltradas
    .filter(p => (p.os?.tipo_os || p.cotacao?.tipo_os) === 'OW')
    .reduce((sum, p) => sum + getValorReal(p), 0);

  const comID = pecasFiltradas.filter(p => p.peca_estoque_id).length;
  const semID = pecasFiltradas.filter(p => !p.peca_estoque_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar PN, OS, cliente, ID..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="neon-input pl-10"
            />
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="neon-input"
          >
            <option value="">Todos Tipos</option>
            <option value="LP">LP</option>
            <option value="OW">OW</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="neon-input"
          >
            <option value="">Todos</option>
            <option value="com_id">Com ID (Estoque)</option>
            <option value="sem_id">Sem ID (GSPN)</option>
            <option value="usada">Devolvida Usada</option>
          </select>
        </div>

        <button
          onClick={handleExportar}
          className="neon-button flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Package className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">LP</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Consumo LP</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {totalLP.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Package className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">OW</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Consumo OW</p>
          <p className="text-2xl font-bold text-orange-400">
            R$ {totalOW.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <CheckCircle className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Com ID (Estoque)</p>
          <p className="text-2xl font-bold text-cyan-400">{comID}</p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Sem ID (GSPN)</p>
          <p className="text-2xl font-bold text-yellow-400">{semID}</p>
        </div>
      </div>

      <div className="premium-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Peças Consumidas - GI Postada ({pecasFiltradas.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Data GI</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Tipo</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">PN</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">ID Peca</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">OS</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Cliente</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">Valor Real</th>
                <th className="text-center py-3 px-2 text-gray-400 font-medium">Fonte</th>
                <th className="text-center py-3 px-2 text-gray-400 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pecasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    Nenhuma peca consumida no periodo
                  </td>
                </tr>
              ) : (
                pecasFiltradas.map((peca) => {
                  const tipoOS = peca.os?.tipo_os || peca.cotacao?.tipo_os;
                  const valorReal = getValorReal(peca);
                  const temID = !!peca.peca_estoque_id;
                  const pn = peca.cotacao_peca?.pn || peca.codigo_peca;
                  return (
                    <tr key={peca.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="py-3 px-2 text-white">
                        {peca.gi_postada_em ? new Date(peca.gi_postada_em).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          tipoOS === 'LP'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {tipoOS || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-cyan-400 font-mono">{pn}</td>
                      <td className="py-3 px-2">
                        {peca.peca_estoque?.id_numerico ? (
                          <span className="text-white font-mono">#{peca.peca_estoque.id_numerico}</span>
                        ) : (
                          <span className="text-yellow-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Sem ID
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-white">
                        {peca.os?.numero_os_samsung || peca.os?.numero_os_interna || `COT-${peca.cotacao?.numero_cotacao}`}
                      </td>
                      <td className="py-3 px-2 text-gray-300">
                        {peca.os?.cliente_nome || peca.cotacao?.cliente_nome || '-'}
                      </td>
                      <td className="py-3 px-2 text-right text-white font-medium">
                        R$ {valorReal.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          temID
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {temID ? 'Estoque' : 'GSPN'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => setSelectedPeca(peca)}
                          className="p-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPeca && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Detalhes da Peca Consumida</h3>
              <button onClick={() => setSelectedPeca(null)} className="text-gray-400 hover:text-white">
                <Package className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Tipo OS</p>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    (selectedPeca.os?.tipo_os || selectedPeca.cotacao?.tipo_os) === 'LP'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {selectedPeca.os?.tipo_os || selectedPeca.cotacao?.tipo_os || 'N/A'}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Part Number</p>
                  <p className="text-lg font-mono text-cyan-400">
                    {selectedPeca.cotacao_peca?.pn || selectedPeca.codigo_peca}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Descricao</p>
                  <p className="text-white">{selectedPeca.cotacao_peca?.descricao || selectedPeca.descricao || '-'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">ID Peca Estoque</p>
                  {selectedPeca.peca_estoque?.id_numerico ? (
                    <p className="text-white font-mono">#{selectedPeca.peca_estoque.id_numerico}</p>
                  ) : (
                    <p className="text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Sem ID - Usando valor GSPN
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Status Requisicao</p>
                  <p className="text-white capitalize">{selectedPeca.status}</p>
                </div>

                {selectedPeca.tipo_devolucao && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Tipo Devolucao</p>
                    <p className="text-white capitalize">{selectedPeca.tipo_devolucao.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Data GI Postada</p>
                  <p className="text-green-400 font-medium">
                    {selectedPeca.gi_postada_em ? new Date(selectedPeca.gi_postada_em).toLocaleString('pt-BR') : '-'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">OS</p>
                  <p className="text-cyan-400">
                    {selectedPeca.os?.numero_os_samsung || selectedPeca.os?.numero_os_interna || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Cotacao</p>
                  <p className="text-white">COT-{selectedPeca.cotacao?.numero_cotacao || '-'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Cliente</p>
                  <p className="text-white">{selectedPeca.os?.cliente_nome || selectedPeca.cotacao?.cliente_nome || '-'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Unidade</p>
                  <p className="text-white">{unidades[selectedPeca.unidade_id] || '-'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <h4 className="text-sm font-bold text-white mb-4">Valores</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="premium-card p-4 bg-yellow-500/10 border-yellow-500/30">
                  <p className="text-xs text-gray-400 uppercase">Valor GSPN</p>
                  <p className="text-xl font-bold text-yellow-400">
                    R$ {(selectedPeca.cotacao_peca?.valor_base_gspn || selectedPeca.valor_peca || 0).toFixed(2)}
                  </p>
                </div>
                <div className="premium-card p-4 bg-cyan-500/10 border-cyan-500/30">
                  <p className="text-xs text-gray-400 uppercase">Valor Real (ID)</p>
                  <p className="text-xl font-bold text-cyan-400">
                    R$ {getValorReal(selectedPeca).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedPeca.peca_estoque_id ? 'Do Estoque (ID)' : 'Do GSPN'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  GI Postada em {selectedPeca.gi_postada_em ? new Date(selectedPeca.gi_postada_em).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPeca(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
