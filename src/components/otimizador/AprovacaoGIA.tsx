import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  RefreshCw,
  Route,
  Trash2,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import {
  aprovarRota,
  buscarOSdaRota,
  buscarRotasRascunho,
  descartarRota,
  processarNovasRotas,
  type OSParaRoteirizar,
  type ResultadoProcessamento,
  type RotaRascunho,
} from '../../lib/giaLogisticsService';
import { enviarLoteConfirmacoes } from '../../lib/whatsappGIA';

interface ToastMsg {
  id: number;
  tipo: 'sucesso' | 'erro' | 'info';
  texto: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    rascunho: { label: 'RASCUNHO', bg: 'rgba(251,191,36,0.15)', color: '#FCD34D' },
    aprovada_notificando: { label: 'NOTIFICANDO', bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
    liberada_tecnico: { label: 'LIBERADA', bg: 'rgba(52,211,153,0.15)', color: '#34D399' },
  };
  const s = cfg[status] || { label: status.toUpperCase(), bg: 'rgba(100,116,139,0.15)', color: '#94A3B8' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black font-mono tracking-widest"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function OSRow({ os, index }: { os: OSParaRoteirizar; index: number }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black font-mono mt-0.5"
        style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-bold text-slate-200 truncate">{os.cliente_nome || 'Cliente sem nome'}</span>
          {os.numero_os_interna && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">#{os.numero_os_interna}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{[os.cliente_endereco, os.cliente_bairro, os.cliente_cidade].filter(Boolean).join(', ') || 'Endereço não informado'}</span>
        </div>
        {os.cliente_telefone && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-600">
            <MessageCircle className="w-3 h-3" />
            <span className="font-mono">{os.cliente_telefone}</span>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {os.lat && os.lng ? (
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <Navigation className="w-2.5 h-2.5" />GPS OK
          </span>
        ) : (
          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />Sem GPS
          </span>
        )}
        {os.equipamento_linha && (
          <span className="text-[9px] font-mono text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">{os.equipamento_linha}</span>
        )}
      </div>
    </div>
  );
}

export default function AprovacaoGIA() {
  const { selectedUnidade } = useOtimizador();

  const [rotas, setRotas] = useState<RotaRascunho[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaRascunho | null>(null);
  const [osListRota, setOsListRota] = useState<OSParaRoteirizar[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const [loadingOS, setLoadingOS] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [resultadoProcessamento, setResultadoProcessamento] = useState<ResultadoProcessamento | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  function addToast(tipo: ToastMsg['tipo'], texto: string) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, tipo, texto }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }

  const carregarRotas = useCallback(async () => {
    if (!selectedUnidade) return;
    setLoadingRotas(true);
    const data = await buscarRotasRascunho(selectedUnidade);
    setRotas(data);
    setLoadingRotas(false);
  }, [selectedUnidade]);

  useEffect(() => {
    carregarRotas();
  }, [carregarRotas]);

  async function handleSelecionarRota(rota: RotaRascunho) {
    setRotaSelecionada(rota);
    setLoadingOS(true);
    const os = await buscarOSdaRota(rota.id);
    setOsListRota(os);
    setLoadingOS(false);
  }

  async function handleProcessarNovas() {
    if (!selectedUnidade) return;
    setProcessando(true);
    setResultadoProcessamento(null);
    const resultado = await processarNovasRotas(selectedUnidade);
    setResultadoProcessamento(resultado);
    setProcessando(false);
    await carregarRotas();
    if (resultado.rotas_criadas > 0) {
      addToast('sucesso', `${resultado.rotas_criadas} rota(s) criada(s) com sucesso`);
    } else {
      addToast('info', 'Nenhuma OS nova para roteirizar encontrada');
    }
  }

  async function handleDescartar() {
    if (!rotaSelecionada) return;
    setDescartando(true);
    const ok = await descartarRota(rotaSelecionada.id);
    setDescartando(false);
    if (ok) {
      addToast('info', 'Rota descartada. OSs voltaram para fila.');
      setRotaSelecionada(null);
      setOsListRota([]);
      await carregarRotas();
    } else {
      addToast('erro', 'Falha ao descartar rota');
    }
  }

  async function handleAprovarENotificar() {
    if (!rotaSelecionada || !selectedUnidade) return;
    setAprovando(true);

    const aprovado = await aprovarRota(rotaSelecionada.id, osListRota.map(o => o.id));
    if (!aprovado) {
      addToast('erro', 'Falha ao aprovar rota');
      setAprovando(false);
      return;
    }

    const osComTelefone = osListRota.filter(o => o.cliente_telefone);
    if (osComTelefone.length > 0) {
      const resultado = await enviarLoteConfirmacoes(
        osComTelefone.map(o => ({
          os_id: o.id,
          cliente_nome: o.cliente_nome || 'Cliente',
          telefone: o.cliente_telefone!,
          data_agendamento: rotaSelecionada.data_rota || 'a definir',
          tecnico_nome: 'nosso técnico',
          unidade_id: selectedUnidade,
        }))
      );
      addToast(
        'sucesso',
        `Rota aprovada! ${resultado.enviados}/${resultado.total} clientes notificados via WhatsApp`
      );
    } else {
      addToast('sucesso', 'Rota aprovada! Nenhum cliente com telefone para notificar.');
    }

    setRotaSelecionada(null);
    setOsListRota([]);
    setAprovando(false);
    await carregarRotas();
  }

  if (!selectedUnidade) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 font-mono text-sm">Selecione uma unidade para continuar</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.tipo === 'sucesso' ? 'rgba(16,24,40,0.98)' : t.tipo === 'erro' ? 'rgba(16,24,40,0.98)' : 'rgba(16,24,40,0.98)',
              border: t.tipo === 'sucesso' ? '1px solid rgba(52,211,153,0.4)' : t.tipo === 'erro' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(59,130,246,0.4)',
              color: t.tipo === 'sucesso' ? '#34D399' : t.tipo === 'erro' ? '#F87171' : '#60A5FA',
              backdropFilter: 'blur(12px)',
            }}
          >
            {t.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4" /> : t.tipo === 'erro' ? <XCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            {t.texto}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 text-slate-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))', border: '1px solid rgba(0,212,255,0.3)' }}>
                <Bot className="w-4 h-4 text-[#00D4FF]" />
              </div>
              GIA Logistics — Despacho de Rotas
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-mono">
              Revise e aprove as rotas geradas pela IA antes do envio aos técnicos
            </p>
          </div>

          <button
            onClick={handleProcessarNovas}
            disabled={processando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm font-mono tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))',
              border: '1px solid rgba(0,212,255,0.4)',
              color: '#00D4FF',
              boxShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}
          >
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {processando ? 'PROCESSANDO...' : 'PROCESSAR NOVAS OSs'}
          </button>
        </div>

        {/* RESULTADO DO PROCESSAMENTO */}
        {resultadoProcessamento && (
          <div className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}>
            {[
              { label: 'OSs encontradas', val: resultadoProcessamento.total_os_encontradas, color: '#94A3B8' },
              { label: 'Geolocalizadas', val: resultadoProcessamento.geolocalizadas, color: '#34D399' },
              { label: 'Falhas GPS', val: resultadoProcessamento.falhas_geocoding, color: '#FBBF24' },
              { label: 'Rotas criadas', val: resultadoProcessamento.rotas_criadas, color: '#00D4FF' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-black font-mono" style={{ color: item.color }}>{item.val}</p>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* LAYOUT PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* LISTA DE ROTAS (esquerda) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Route className="w-3.5 h-3.5" />
                Rotas em Rascunho ({rotas.length})
              </h3>
              <button onClick={carregarRotas} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Atualizar">
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingRotas ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingRotas ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">Carregando...</span>
              </div>
            ) : rotas.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <Route className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-mono">Nenhum rascunho pendente</p>
                <p className="text-xs text-slate-700 mt-1">Clique em "Processar Novas OSs" para gerar rotas</p>
              </div>
            ) : (
              rotas.map(rota => (
                <button
                  key={rota.id}
                  onClick={() => handleSelecionarRota(rota)}
                  className="w-full text-left rounded-xl p-4 transition-all hover:scale-[1.01]"
                  style={{
                    background: rotaSelecionada?.id === rota.id
                      ? 'rgba(0,212,255,0.08)'
                      : 'rgba(255,255,255,0.02)',
                    border: rotaSelecionada?.id === rota.id
                      ? '1px solid rgba(0,212,255,0.35)'
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: rotaSelecionada?.id === rota.id ? '0 0 16px rgba(0,212,255,0.1)' : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-200 leading-snug">{rota.nome}</span>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${rotaSelecionada?.id === rota.id ? 'text-[#00D4FF] rotate-90' : 'text-slate-600'}`} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <StatusBadge status={rota.status_rota} />
                    {rota.skill && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/60">
                        {rota.skill}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Package className="w-3 h-3" />
                      <span className="font-mono">{rota.total_os} OS{rota.total_os !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono truncate">{(rota.cidades || []).join(', ') || 'Sem cidade'}</span>
                    </div>
                    {rota.data_rota && (
                      <div className="flex items-center gap-1.5 text-slate-500 col-span-2">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{new Date(rota.data_rota + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* PAINEL DETALHES (direita) */}
          <div className="lg:col-span-3">
            {!rotaSelecionada ? (
              <div className="rounded-xl h-full flex flex-col items-center justify-center py-20 gap-3" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                <Bot className="w-10 h-10 text-slate-700" />
                <p className="text-sm text-slate-600 font-mono">Selecione uma rota para ver detalhes</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(8,12,30,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {/* HEADER DO PAINEL */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,212,255,0.04)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-100 text-base">{rotaSelecionada.nome}</h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <StatusBadge status={rotaSelecionada.status_rota} />
                        {rotaSelecionada.skill && (
                          <span className="text-[10px] font-mono text-slate-500">{rotaSelecionada.skill}</span>
                        )}
                        <span className="text-[10px] font-mono text-slate-600">{rotaSelecionada.total_os} OS</span>
                      </div>
                    </div>
                    {rotaSelecionada.tecnico_id && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400 font-mono">Técnico sugerido</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* LISTA DE OS */}
                <div className="px-5 py-3">
                  <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Navigation className="w-3 h-3" />
                    Sequência de Atendimentos
                  </p>

                  {loadingOS ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-mono">Carregando OSs...</span>
                    </div>
                  ) : osListRota.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-700 font-mono">Nenhuma OS vinculada</p>
                  ) : (
                    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      {osListRota.map((os, i) => (
                        <OSRow key={os.id} os={os} index={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* ACOES */}
                <div className="px-5 py-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={handleDescartar}
                    disabled={descartando || aprovando}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black font-mono tracking-wider transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#F87171',
                    }}
                  >
                    {descartando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {descartando ? 'DESCARTANDO...' : 'DESCARTAR RASCUNHO'}
                  </button>

                  <button
                    onClick={handleAprovarENotificar}
                    disabled={aprovando || descartando || osListRota.length === 0}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black font-mono tracking-wider transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40"
                    style={{
                      background: aprovando
                        ? 'rgba(255,255,255,0.04)'
                        : 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(52,211,153,0.12))',
                      border: '1px solid rgba(52,211,153,0.5)',
                      color: '#34D399',
                      boxShadow: aprovando ? 'none' : '0 0 24px rgba(52,211,153,0.2)',
                    }}
                  >
                    {aprovando ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {aprovando ? 'NOTIFICANDO...' : 'APROVAR E NOTIFICAR CLIENTES'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
