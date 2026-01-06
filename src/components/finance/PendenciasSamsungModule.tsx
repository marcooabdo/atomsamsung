import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign, AlertTriangle, CheckCircle, Download, Search,
  FileText, Calendar, Package
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PendenciasSamsungModuleProps {
  unidadeId: string | null;
  dataInicio: string;
  dataFim: string;
}

interface Pendencia {
  id: string;
  tipo: string;
  pn: string;
  id_samsung: string | null;
  valor: number;
  nf_samsung: string | null;
  status: string;
  data_quitacao: string | null;
  created_at: string;
  consumo?: {
    pn: string;
    descricao: string | null;
    data_consumo: string;
    os?: {
      numero_os_interna: string;
      numero_os_samsung: string | null;
    };
  };
  unidade?: { nome: string };
}

export default function PendenciasSamsungModule({ unidadeId, dataInicio, dataFim }: PendenciasSamsungModuleProps) {
  const [loading, setLoading] = useState(true);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    loadPendencias();
  }, [unidadeId, dataInicio, dataFim, filtroStatus, filtroTipo]);

  const loadPendencias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pendencias_pagamento_samsung')
        .select(`
          *,
          consumo:consumo_pecas(
            pn,
            descricao,
            data_consumo,
            os:os(numero_os_interna, numero_os_samsung)
          ),
          unidade:unidades(nome)
        `)
        .order('created_at', { ascending: false });

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }
      if (dataInicio) {
        query = query.gte('created_at', `${dataInicio}T00:00:00`);
      }
      if (dataFim) {
        query = query.lte('created_at', `${dataFim}T23:59:59`);
      }
      if (filtroStatus) {
        query = query.eq('status', filtroStatus);
      }
      if (filtroTipo) {
        query = query.eq('tipo', filtroTipo);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      setPendencias(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleQuitar = async (pendencia: Pendencia) => {
    try {
      const { error } = await supabase
        .from('pendencias_pagamento_samsung')
        .update({
          status: 'quitada',
          data_quitacao: new Date().toISOString().split('T')[0]
        })
        .eq('id', pendencia.id);

      if (error) throw error;
      loadPendencias();
    } catch (error) {
    }
  };

  const handleExportar = () => {
    const dadosExport = pendenciasFiltradas.map(p => ({
      'Data': new Date(p.created_at).toLocaleDateString('pt-BR'),
      'Tipo': p.tipo,
      'PN': p.pn,
      'ID Samsung': p.id_samsung || '',
      'Valor': p.valor,
      'NF Samsung': p.nf_samsung || '',
      'Status': p.status === 'quitada' ? 'Quitada' : 'Pendente',
      'Data Quitacao': p.data_quitacao ? new Date(p.data_quitacao).toLocaleDateString('pt-BR') : '',
      'OS': p.consumo?.os?.numero_os_samsung || p.consumo?.os?.numero_os_interna || '',
      'Unidade': p.unidade?.nome || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pendencias Samsung');
    XLSX.writeFile(wb, `pendencias_samsung_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const pendenciasFiltradas = pendencias.filter(p => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      p.pn.toLowerCase().includes(termo) ||
      p.id_samsung?.toLowerCase().includes(termo) ||
      p.nf_samsung?.toLowerCase().includes(termo)
    );
  });

  const totalPendente = pendenciasFiltradas
    .filter(p => p.status === 'pendente')
    .reduce((sum, p) => sum + p.valor, 0);

  const totalQuitado = pendenciasFiltradas
    .filter(p => p.status === 'quitada')
    .reduce((sum, p) => sum + p.valor, 0);

  const pendentesLP = pendenciasFiltradas.filter(p => p.tipo === 'LP' && p.status === 'pendente');
  const pendentesOW = pendenciasFiltradas.filter(p => p.tipo === 'OW' && p.status === 'pendente');

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
              placeholder="Buscar PN, ID, NF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="neon-input pl-10"
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="neon-input"
          >
            <option value="">Todos Status</option>
            <option value="pendente">Pendente</option>
            <option value="quitada">Quitada</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="neon-input"
          >
            <option value="">Todos Tipos</option>
            <option value="LP">LP</option>
            <option value="OW">OW</option>
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
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Total Pendente</p>
          <p className="text-2xl font-bold text-yellow-400">
            R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Total Quitado</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {totalQuitado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Package className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">LP</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Pendentes LP</p>
          <p className="text-2xl font-bold text-white">{pendentesLP.length}</p>
          <p className="text-xs text-gray-500">
            R$ {pendentesLP.reduce((s, p) => s + p.valor, 0).toFixed(2)}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Package className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">OW</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Pendentes OW</p>
          <p className="text-2xl font-bold text-white">{pendentesOW.length}</p>
          <p className="text-xs text-gray-500">
            R$ {pendentesOW.reduce((s, p) => s + p.valor, 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="premium-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Pendencias de Pagamento Samsung ({pendenciasFiltradas.length})
        </h3>

        <div className="space-y-3">
          {pendenciasFiltradas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma pendencia encontrada</p>
          ) : (
            pendenciasFiltradas.map((pendencia) => (
              <div
                key={pendencia.id}
                className={`p-4 rounded-lg border ${
                  pendencia.status === 'quitada'
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-yellow-500/5 border-yellow-500/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pendencia.tipo === 'LP'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {pendencia.tipo}
                      </span>
                      <span className="font-mono text-cyan-400">{pendencia.pn}</span>
                      {pendencia.id_samsung && (
                        <span className="text-xs text-gray-400">ID: {pendencia.id_samsung}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pendencia.status === 'quitada'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {pendencia.status === 'quitada' ? 'Quitada' : 'Pendente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(pendencia.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {pendencia.nf_samsung && (
                        <span>
                          <FileText className="w-3 h-3 inline mr-1" />
                          NF: {pendencia.nf_samsung}
                        </span>
                      )}
                      {pendencia.consumo?.os && (
                        <span>
                          OS: {pendencia.consumo.os.numero_os_samsung || pendencia.consumo.os.numero_os_interna}
                        </span>
                      )}
                      {pendencia.unidade && (
                        <span>{pendencia.unidade.nome}</span>
                      )}
                    </div>
                    {pendencia.data_quitacao && (
                      <p className="text-xs text-green-500 mt-1">
                        Quitado em {new Date(pendencia.data_quitacao).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <p className={`text-xl font-bold ${
                      pendencia.status === 'quitada' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      R$ {pendencia.valor.toFixed(2)}
                    </p>

                    {pendencia.status === 'pendente' && (
                      <button
                        onClick={() => handleQuitar(pendencia)}
                        className="p-2 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors"
                        title="Marcar como Quitada"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
