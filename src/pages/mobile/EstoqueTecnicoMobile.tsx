import { useState, useEffect } from 'react';
import { Package, RefreshCw, CheckCircle, Clock, AlertTriangle, RotateCcw, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PecaTecnico {
  req_id: string;
  peca_id: string | null;
  id_numerico: number | null;
  codigo_peca: string;
  descricao: string;
  quantidade_requisitada: number;
  req_status: string;
  peca_status: string | null;
  os_id: string;
  numero_os: string;
  cliente_nome: string;
  aparelho_modelo: string | null;
  created_at: string;
}

const REQ_STATUS_INFO: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendente: { label: 'Pendente', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  atendida: { label: 'Enviada', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  em_uso: { label: 'Em Uso', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  devolucao_pendente: { label: 'Dev. Pendente', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  gi_postada: { label: 'GI Postada', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  devolvida_samsung: { label: 'Dev. Samsung', bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
};

const PECA_STATUS_INFO: Record<string, { label: string; icon: typeof Package; color: string }> = {
  disponivel: { label: 'Disponivel no estoque', icon: Package, color: 'text-gray-400' },
  reservada: { label: 'Reservada', icon: Clock, color: 'text-yellow-400' },
  vinculada_tecnico: { label: 'Com voce', icon: Package, color: 'text-cyan-400' },
  em_rota: { label: 'Em rota', icon: Package, color: 'text-blue-400' },
  em_uso: { label: 'Em uso (reparo em andamento)', icon: Wrench, color: 'text-orange-400' },
  usada: { label: 'Usada - aguardando GI', icon: CheckCircle, color: 'text-green-400' },
  devolucao_pendente: { label: 'Aguardando devolucao', icon: RotateCcw, color: 'text-amber-400' },
  devolvida_nova: { label: 'Devolvida (nova)', icon: RotateCcw, color: 'text-teal-400' },
  devolvida_defeito: { label: 'Devolvida com defeito', icon: AlertTriangle, color: 'text-red-400' },
  usada_upc: { label: 'Devolvida UPC', icon: CheckCircle, color: 'text-green-300' },
  devolvida_upc: { label: 'Devolvida UPC', icon: CheckCircle, color: 'text-green-300' },
  devolvida_samsung: { label: 'Devolvida Samsung', icon: RotateCcw, color: 'text-teal-300' },
  devolucao_completa: { label: 'Devolução Completa', icon: CheckCircle, color: 'text-emerald-400' },
};

type FiltroTab = 'aguardando' | 'com_tecnico' | 'em_uso' | 'devolvidas' | 'todas';

const TABS: { id: FiltroTab; label: string }[] = [
  { id: 'aguardando', label: 'Aguardando' },
  { id: 'com_tecnico', label: 'Comigo' },
  { id: 'em_uso', label: 'Em Uso' },
  { id: 'devolvidas', label: 'Devolvidas' },
  { id: 'todas', label: 'Todas' },
];

export function EstoqueTecnicoMobile() {
  const { usuario } = useAuth();
  const [pecas, setPecas] = useState<PecaTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTab, setFiltroTab] = useState<FiltroTab>('com_tecnico');
  const [aceitandoId, setAceitandoId] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) loadEstoque();
  }, [usuario]);

  const loadEstoque = async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const { data: osDoTecnico } = await supabase
        .from('os')
        .select('id')
        .eq('tecnico_agendado_id', usuario.id);

      const osIds = (osDoTecnico || []).map((o: any) => o.id);

      let reqQuery = supabase
        .from('requisicoes_pecas')
        .select(`
          id,
          codigo_peca,
          descricao,
          quantidade_requisitada,
          status,
          created_at,
          os_id,
          tecnico_id,
          peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
            id,
            id_numerico,
            status
          ),
          os:os!requisicoes_pecas_os_id_fkey(
            numero_os_interna,
            numero_os_samsung,
            cliente_nome,
            aparelho_modelo
          )
        `)
        .not('status', 'in', '("cancelada","reprovada")')
        .order('created_at', { ascending: false });

      if (osIds.length > 0) {
        reqQuery = reqQuery.or(`tecnico_id.eq.${usuario.id},os_id.in.(${osIds.join(',')})`);
      } else {
        reqQuery = reqQuery.eq('tecnico_id', usuario.id);
      }

      const { data, error } = await reqQuery;

      if (error) throw error;

      const formatadas: PecaTecnico[] = (data || []).map((r: any) => ({
        req_id: r.id,
        peca_id: r.peca_estoque?.id || null,
        id_numerico: r.peca_estoque?.id_numerico || null,
        codigo_peca: r.codigo_peca,
        descricao: r.descricao || '',
        quantidade_requisitada: r.quantidade_requisitada,
        req_status: r.status,
        peca_status: r.peca_estoque?.status || null,
        os_id: r.os_id,
        numero_os: r.os?.numero_os_samsung || r.os?.numero_os_interna || 'S/N',
        cliente_nome: r.os?.cliente_nome || '',
        aparelho_modelo: r.os?.aparelho_modelo || null,
        created_at: r.created_at,
      }));

      setPecas(formatadas);
    } catch (err) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const aceitarPeca = async (peca: PecaTecnico) => {
    if (!peca.peca_id) return;
    setAceitandoId(peca.req_id);
    try {
      const { error: pecaError } = await supabase
        .from('estoque_pecas')
        .update({ status: 'vinculada_tecnico' })
        .eq('id', peca.peca_id);

      if (pecaError) throw pecaError;

      const { error: reqError } = await supabase
        .from('requisicoes_pecas')
        .update({ status: 'em_uso' })
        .eq('id', peca.req_id);

      if (reqError) throw reqError;

      await loadEstoque();
    } catch (err) {
      // ignored
    } finally {
      setAceitandoId(null);
    }
  };

  const filteredPecas = pecas.filter((p) => {
    if (filtroTab === 'todas') return true;
    if (filtroTab === 'aguardando') return p.req_status === 'pendente' || p.req_status === 'atendida';
    if (filtroTab === 'com_tecnico') return p.peca_status === 'vinculada_tecnico' || p.peca_status === 'em_rota';
    if (filtroTab === 'em_uso') return p.req_status === 'em_uso' || p.peca_status === 'em_uso';
    if (filtroTab === 'devolvidas') return ['devolucao_pendente', 'gi_postada', 'devolvida_samsung'].includes(p.req_status) || ['devolucao_pendente', 'devolvida_nova', 'devolvida_defeito', 'usada', 'usada_upc', 'devolvida_upc', 'devolvida_samsung', 'devolucao_completa'].includes(p.peca_status || '');
    return true;
  });

  const countTab = (tab: FiltroTab) => {
    return pecas.filter((p) => {
      if (tab === 'todas') return true;
      if (tab === 'aguardando') return p.req_status === 'pendente' || p.req_status === 'atendida';
      if (tab === 'com_tecnico') return p.peca_status === 'vinculada_tecnico' || p.peca_status === 'em_rota';
      if (tab === 'em_uso') return p.req_status === 'em_uso' || p.peca_status === 'em_uso';
      if (tab === 'devolvidas') return ['devolucao_pendente', 'gi_postada', 'devolvida_samsung'].includes(p.req_status) || ['devolucao_pendente', 'devolvida_nova', 'devolvida_defeito', 'usada', 'usada_upc', 'devolvida_upc', 'devolvida_samsung', 'devolucao_completa'].includes(p.peca_status || '');
      return true;
    }).length;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meu Estoque</h1>
          <p className="text-gray-400 text-sm">{pecas.length} peca{pecas.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button
          onClick={loadEstoque}
          disabled={loading}
          className="p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => {
          const count = countTab(tab.id);
          const isActive = filtroTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFiltroTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                  : 'bg-gray-800 border border-gray-700 text-gray-400'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-cyan-500/30 text-cyan-300' : 'bg-gray-700 text-gray-300'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPecas.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium">Nenhuma peca nesta categoria</p>
          <p className="text-gray-600 text-sm mt-1">As pecas apareceram aqui quando requisitadas para voce</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPecas.map((peca) => {
            const reqInfo = REQ_STATUS_INFO[peca.req_status] || REQ_STATUS_INFO.pendente;
            const pecaInfo = peca.peca_status ? PECA_STATUS_INFO[peca.peca_status] : null;
            const precisaAceitar = (peca.req_status === 'atendida') && peca.peca_id;

            return (
              <div
                key={peca.req_id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-bold font-mono text-sm">{peca.codigo_peca}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${reqInfo.bg} ${reqInfo.text} ${reqInfo.border}`}>
                        {reqInfo.label}
                      </span>
                    </div>
                    {peca.descricao && (
                      <p className="text-gray-400 text-xs line-clamp-2">{peca.descricao}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-300 text-xs">Qtd</p>
                    <p className="text-white font-bold">{peca.quantidade_requisitada}</p>
                  </div>
                </div>

                {peca.id_numerico && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">ID peca:</span>
                    <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                      #{peca.id_numerico}
                    </span>
                  </div>
                )}

                {pecaInfo && (
                  <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2">
                    <pecaInfo.icon className={`w-4 h-4 flex-shrink-0 ${pecaInfo.color}`} />
                    <span className={`text-xs font-medium ${pecaInfo.color}`}>{pecaInfo.label}</span>
                  </div>
                )}

                <div className="bg-gray-800/40 rounded-xl px-3 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">OS</span>
                    <span className="text-white font-bold text-sm font-mono">#{peca.numero_os}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Cliente</span>
                    <span className="text-gray-300 text-xs text-right">{peca.cliente_nome}</span>
                  </div>
                  {peca.aparelho_modelo && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Aparelho</span>
                      <span className="text-gray-300 text-xs">{peca.aparelho_modelo}</span>
                    </div>
                  )}
                </div>

                {precisaAceitar && (
                  <button
                    onClick={() => aceitarPeca(peca)}
                    disabled={aceitandoId === peca.req_id}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {aceitandoId === peca.req_id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Aceitar Peca
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
