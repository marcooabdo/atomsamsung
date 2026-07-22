import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, ShieldAlert, ShieldX, Loader2, CheckCircle,
  AlertTriangle, XCircle, Package, DollarSign, FileText, Wrench,
  Lock, Unlock, ChevronDown, ChevronUp, Zap, Archive,
} from 'lucide-react';
import {
  validarFechamentoOS,
  salvarAlertasFechamento,
  criarAlertasGIAWarranty,
  executarFechamentoOS,
  type AlertaFechamento,
  type ValidacaoResultado,
} from '../lib/osClosureValidation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FecharOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  osId: string;
  osNumero: string;
  unidadeId: string;
  onSuccess: () => void;
}

const CATEGORIA_CONFIG: Record<string, { icon: typeof Package; label: string; color: string }> = {
  pecas: { icon: Package, label: 'Peças', color: '#00D4FF' },
  financeiro: { icon: DollarSign, label: 'Financeiro', color: '#39FF14' },
  fiscal: { icon: FileText, label: 'Fiscal', color: '#FFA500' },
  operacional: { icon: Wrench, label: 'Operacional', color: '#FF6B35' },
};

export function FecharOSModal({ isOpen, onClose, osId, osNumero, unidadeId, onSuccess }: FecharOSModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resultado, setResultado] = useState<ValidacaoResultado | null>(null);
  const [fechando, setFechando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const [osFechada, setOsFechada] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    pecas: true, financeiro: true, fiscal: true, operacional: true,
  });
  const [forceClose, setForceClose] = useState(false);

  useEffect(() => {
    if (isOpen && osId) {
      runValidation();
    }
  }, [isOpen, osId]);

  async function runValidation() {
    setLoading(true);
    setResultado(null);
    setForceClose(false);
    setOsFechada(false);
    try {
      const res = await validarFechamentoOS(osId);
      setResultado(res);

      const allAlertas = [...res.bloqueios, ...res.alertas];
      await salvarAlertasFechamento(osId, unidadeId, allAlertas);

      if (allAlertas.length > 0) {
        await criarAlertasGIAWarranty(osId, osNumero, unidadeId, allAlertas, usuario?.id);
      }
    } catch {
      setResultado({
        aprovado: false,
        alertas: [],
        bloqueios: [{
          regra_codigo: 'ERRO_VALIDACAO',
          regra_titulo: 'Erro na validação',
          categoria: 'operacional',
          severidade: 'bloqueante',
          mensagem: 'Ocorreu um erro ao validar a OS. Tente novamente.',
          dados_contexto: {},
        }],
        totalChecks: 0,
        passedChecks: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleFechar() {
    if (!usuario) return;
    setFechando(true);
    try {
      if (forceClose && resultado) {
        const allAlertas = [...resultado.bloqueios, ...resultado.alertas];
        if (allAlertas.length > 0) {
          const bloqs = allAlertas.filter(a => a.severidade === 'bloqueante');
          const avs = allAlertas.filter(a => a.severidade === 'alerta');

          const descLinhas: string[] = [];
          if (bloqs.length > 0) {
            descLinhas.push(`BLOQUEIOS IGNORADOS (${bloqs.length}):`);
            bloqs.forEach(b => descLinhas.push(`- ${b.regra_titulo}: ${b.mensagem}`));
          }
          if (avs.length > 0) {
            descLinhas.push(`ALERTAS IGNORADOS (${avs.length}):`);
            avs.forEach(a => descLinhas.push(`- ${a.regra_titulo}: ${a.mensagem}`));
          }
          descLinhas.push('', `Forcado por: ${usuario.nome || usuario.id}`);

          await supabase.from('gia_mural_tarefas')
            .update({ status: 'concluido', concluido_at: new Date().toISOString() })
            .eq('os_id', osId)
            .eq('gia_source', 'GIA Warranty')
            .eq('status', 'pendente')
            .neq('metadata->>tipo', 'fechamento_forcado');

          await supabase.from('gia_mural_tarefas').insert({
            gia_source: 'GIA Warranty',
            gia_responsavel: 'GIA Warranty',
            prioridade: bloqs.length > 0 ? 'alta' : 'normal',
            titulo: `[FORCADO] OS ${osNumero} - ${allAlertas.length} desvio(s) ignorado(s)`,
            descricao: descLinhas.join('\n'),
            status: 'pendente',
            unidade_id: unidadeId,
            os_id: osId,
            os_numero: osNumero,
            metadata: {
              tipo: 'fechamento_forcado',
              forcado_por: usuario.id,
              forcado_por_nome: usuario.nome,
              total_bloqueios: bloqs.length,
              total_alertas: avs.length,
              regras: allAlertas.map(a => a.regra_codigo),
            },
          });

          await supabase.from('os_comentarios').insert({
            os_id: osId,
            usuario_id: usuario.id,
            comentario: ['[FECHAMENTO FORCADO] OS fechada com os seguintes desvios pendentes:', '', ...descLinhas].join('\n'),
            is_system: true,
          });
        }
      }
      const res = await executarFechamentoOS(osId, usuario.id);
      if (res.success) {
        setOsFechada(true);
      }
    } finally {
      setFechando(false);
    }
  }

  async function handleArquivar() {
    if (!usuario) return;
    setArquivando(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({ arquivada: true, updated_at: new Date().toISOString() })
        .eq('id', osId);
      if (!error) {
        onSuccess();
        onClose();
      }
    } finally {
      setArquivando(false);
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  function groupByCategoria(items: AlertaFechamento[]) {
    const groups: Record<string, AlertaFechamento[]> = {};
    for (const item of items) {
      if (!groups[item.categoria]) groups[item.categoria] = [];
      groups[item.categoria].push(item);
    }
    return groups;
  }

  if (!isOpen) return null;

  const allIssues = resultado ? [...resultado.bloqueios, ...resultado.alertas] : [];
  const groupedIssues = groupByCategoria(allIssues);
  const canClose = resultado?.aprovado || forceClose;
  const progressPercent = resultado ? (resultado.totalChecks > 0 ? (resultado.passedChecks / resultado.totalChecks) * 100 : 100) : 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1117 50%, #0a0a0a 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.4)',
          }}
        >
          <div
            className="px-6 py-5 shrink-0"
            style={{
              background: loading
                ? 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, transparent 100%)'
                : resultado?.aprovado
                ? 'linear-gradient(135deg, rgba(57,255,20,0.08) 0%, transparent 100%)'
                : resultado && resultado.bloqueios.length > 0
                ? 'linear-gradient(135deg, rgba(255,0,100,0.08) 0%, transparent 100%)'
                : 'linear-gradient(135deg, rgba(255,191,0,0.08) 0%, transparent 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl"
                  style={{
                    background: loading
                      ? 'rgba(0,212,255,0.15)'
                      : resultado?.aprovado
                      ? 'rgba(57,255,20,0.15)'
                      : 'rgba(255,0,100,0.15)',
                    border: `1px solid ${loading ? 'rgba(0,212,255,0.3)' : resultado?.aprovado ? 'rgba(57,255,20,0.3)' : 'rgba(255,0,100,0.3)'}`,
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  ) : resultado?.aprovado ? (
                    <ShieldCheck className="w-6 h-6 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 6px rgba(57,255,20,0.6))' }} />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-[#FF0064]" style={{ filter: 'drop-shadow(0 0 6px rgba(255,0,100,0.6))' }} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wide text-white">
                    FECHAR OS
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {osNumero} &bull; Validacao de fechamento
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 animate-spin" style={{ borderTopColor: '#00D4FF' }} />
                <Zap className="w-6 h-6 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">GIA Warranty analisando...</p>
                <p className="text-xs text-gray-500 mt-1">Verificando todas as regras de fechamento</p>
              </div>
            </div>
          ) : resultado ? (
            <>
              <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                    Progresso da Validacao
                  </span>
                  <span className="text-xs font-black" style={{ color: progressPercent === 100 ? '#39FF14' : progressPercent >= 60 ? '#FFBF00' : '#FF0064' }}>
                    {resultado.passedChecks}/{resultado.totalChecks} aprovados
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: progressPercent === 100
                        ? 'linear-gradient(90deg, #39FF14, #00D4FF)'
                        : progressPercent >= 60
                        ? 'linear-gradient(90deg, #FFBF00, #FF6B35)'
                        : 'linear-gradient(90deg, #FF0064, #FF6B35)',
                      boxShadow: `0 0 10px ${progressPercent === 100 ? 'rgba(57,255,20,0.4)' : progressPercent >= 60 ? 'rgba(255,191,0,0.4)' : 'rgba(255,0,100,0.4)'}`,
                    }}
                  />
                </div>

                <div className="flex items-center gap-4 mt-3">
                  {resultado.bloqueios.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-[#FF0064]" />
                      <span className="text-[11px] font-bold text-[#FF0064]">{resultado.bloqueios.length} bloqueio(s)</span>
                    </div>
                  )}
                  {resultado.alertas.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FFBF00]" />
                      <span className="text-[11px] font-bold text-[#FFBF00]">{resultado.alertas.length} alerta(s)</span>
                    </div>
                  )}
                  {resultado.passedChecks > 0 && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-[#39FF14]" />
                      <span className="text-[11px] font-bold text-[#39FF14]">{resultado.passedChecks} ok</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {resultado.aprovado && allIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)' }}>
                      <ShieldCheck className="w-10 h-10 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 12px rgba(57,255,20,0.5))' }} />
                    </div>
                    <p className="text-base font-black text-[#39FF14]">TODAS AS VERIFICAÇÕES APROVADAS</p>
                    <p className="text-xs text-gray-400 text-center max-w-xs">
                      A OS esta pronta para ser fechada. Todos os criterios de qualidade foram atendidos.
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedIssues).map(([categoria, items]) => {
                    const config = CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG.operacional;
                    const CatIcon = config.icon;
                    const isExpanded = expandedCategories[categoria];
                    const hasBloqueio = items.some(i => i.severidade === 'bloqueante');

                    return (
                      <div key={categoria} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${hasBloqueio ? 'rgba(255,0,100,0.2)' : 'rgba(255,191,0,0.15)'}` }}>
                        <button
                          onClick={() => toggleCategory(categoria)}
                          className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                          style={{ background: hasBloqueio ? 'rgba(255,0,100,0.05)' : 'rgba(255,191,0,0.03)' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <CatIcon className="w-4 h-4" style={{ color: config.color }} />
                            <span className="text-xs font-black tracking-wider uppercase" style={{ color: config.color }}>
                              {config.label}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                              background: hasBloqueio ? 'rgba(255,0,100,0.15)' : 'rgba(255,191,0,0.15)',
                              color: hasBloqueio ? '#FF0064' : '#FFBF00',
                            }}>
                              {items.length}
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 space-y-2">
                                {items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-3 p-3 rounded-lg"
                                    style={{
                                      background: item.severidade === 'bloqueante' ? 'rgba(255,0,100,0.06)' : 'rgba(255,191,0,0.04)',
                                      border: `1px solid ${item.severidade === 'bloqueante' ? 'rgba(255,0,100,0.15)' : 'rgba(255,191,0,0.12)'}`,
                                    }}
                                  >
                                    {item.severidade === 'bloqueante' ? (
                                      <ShieldX className="w-4 h-4 shrink-0 mt-0.5 text-[#FF0064]" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FFBF00]" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-xs font-bold text-white">{item.regra_titulo}</p>
                                        <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase" style={{
                                          background: item.severidade === 'bloqueante' ? 'rgba(255,0,100,0.2)' : 'rgba(255,191,0,0.2)',
                                          color: item.severidade === 'bloqueante' ? '#FF0064' : '#FFBF00',
                                        }}>
                                          {item.severidade}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-gray-400 leading-relaxed">{item.mensagem}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>

              <div
                className="px-6 py-4 shrink-0 flex items-center justify-between gap-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}
              >
                {osFechada ? (
                  <div className="w-full flex flex-col items-center gap-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 6px rgba(57,255,20,0.6))' }} />
                      <span className="text-sm font-black text-[#39FF14]">OS fechada com sucesso!</span>
                    </div>
                    {usuario?.tipo === 'master' ? (
                      <>
                        <p className="text-xs text-gray-400 text-center">
                          Deseja arquivar esta OS para removê-la do pipeline ativo?
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 transition-all hover:bg-white/5"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            Manter no Pipeline
                          </button>
                          <button
                            onClick={handleArquivar}
                            disabled={arquivando}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 100%)',
                              color: '#000',
                              boxShadow: '0 0 20px rgba(0,212,255,0.35)',
                            }}
                          >
                            {arquivando ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                            {arquivando ? 'Arquivando...' : 'ARQUIVAR'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => { onSuccess(); onClose(); }}
                        className="px-5 py-2.5 rounded-xl text-sm font-black transition-all mt-1"
                        style={{
                          background: 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 100%)',
                          color: '#000',
                          boxShadow: '0 0 20px rgba(0,212,255,0.35)',
                        }}
                      >
                        FECHAR
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {!resultado.aprovado && resultado.bloqueios.length > 0 && (
                        <button
                          onClick={() => setForceClose(!forceClose)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={{
                            background: forceClose ? 'rgba(255,0,100,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${forceClose ? 'rgba(255,0,100,0.4)' : 'rgba(255,255,255,0.1)'}`,
                            color: forceClose ? '#FF0064' : '#94a3b8',
                          }}
                        >
                          {forceClose ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {forceClose ? 'Forcado ativo' : 'Forcar fechamento'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 transition-all hover:bg-white/5"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleFechar}
                        disabled={!canClose || fechando}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: canClose
                            ? forceClose
                              ? 'linear-gradient(135deg, #FF0064 0%, #FF6B35 100%)'
                              : 'linear-gradient(135deg, #39FF14 0%, #00D4FF 100%)'
                            : 'rgba(255,255,255,0.05)',
                          color: canClose ? '#000' : '#666',
                          boxShadow: canClose ? `0 0 20px ${forceClose ? 'rgba(255,0,100,0.3)' : 'rgba(57,255,20,0.3)'}` : 'none',
                        }}
                      >
                        {fechando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : canClose ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <ShieldX className="w-4 h-4" />
                        )}
                        {fechando ? 'Fechando...' : forceClose ? 'FORCAR FECHAMENTO' : 'FECHAR OS'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
