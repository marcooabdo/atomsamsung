import { useEffect, useState } from 'react';
import { X, CheckCircle2, User, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBRL, STATUS_CONFIG, CATEGORIAS, type OcorrenciaComDetalhes, type Parcela } from './types';

interface Props {
  ocorrencia: OcorrenciaComDetalhes | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function Confetti() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 1.5 + Math.random() * 1.5;
        const colors = ['#00D4FF', '#4ADE80', '#FFD93D', '#FF9F43'];
        const color = colors[i % colors.length];
        return (
          <div key={i}
            className="absolute w-2 h-3 rounded-sm"
            style={{
              left: `${left}%`,
              top: '-10px',
              background: color,
              boxShadow: `0 0 8px ${color}`,
              animation: `confettiFall ${duration}s ${delay}s ease-in forwards`,
            }} />
        );
      })}
    </div>
  );
}

export function ComplianceDrawer({ ocorrencia, open, onClose, onUpdate }: Props) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!open) setShowConfetti(false);
  }, [open]);

  if (!open || !ocorrencia) return null;

  const statusCfg = STATUS_CONFIG[ocorrencia.status];
  const catCfg = CATEGORIAS.find(c => c.value === ocorrencia.categoria);

  const toggleParcela = async (parcela: Parcela) => {
    const deduzido = !parcela.deduzido;
    await supabase
      .from('compliance_parcelas')
      .update({
        deduzido,
        data_deducao: deduzido ? new Date().toISOString() : null,
      })
      .eq('id', parcela.id);

    const responsavel = ocorrencia.responsaveis.find(r => r.id === parcela.responsavel_id);
    if (responsavel) {
      const novaTotalPaga = responsavel.parcelas.reduce((s, p) =>
        s + (p.id === parcela.id ? (deduzido ? p.valor : 0) : (p.deduzido ? p.valor : 0)), 0);
      await supabase
        .from('compliance_responsaveis')
        .update({ valor_pago: novaTotalPaga })
        .eq('id', responsavel.id);
    }

    const todasParcelas = ocorrencia.responsaveis.flatMap(r => r.parcelas);
    const todasDeduzidas = todasParcelas.every(p => p.id === parcela.id ? deduzido : p.deduzido);
    const algumasDeduzidas = todasParcelas.some(p => p.id === parcela.id ? deduzido : p.deduzido);

    let novoStatus: 'aberto' | 'em_pagamento' | 'quitado' = 'em_pagamento';
    if (todasDeduzidas) novoStatus = 'quitado';
    else if (!algumasDeduzidas) novoStatus = 'aberto';

    if (novoStatus !== ocorrencia.status) {
      await supabase.from('compliance_ocorrencias').update({ status: novoStatus }).eq('id', ocorrencia.id);
      if (novoStatus === 'quitado') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);
      }
    }

    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,10,13,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="relative w-full max-w-xl h-full overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111114',
          borderLeft: '1px solid rgba(0,212,255,0.3)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(0,212,255,0.1)',
          animation: 'slideInRight 0.3s ease-out',
        }}>

        {showConfetti && <Confetti />}

        <div className="flex items-start justify-between px-6 py-5 border-b relative" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
              {catCfg && (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${catCfg.color}15`, border: `1px solid ${catCfg.color}40`, color: catCfg.color }}>
                  {catCfg.label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold truncate" style={{ color: '#E0E0E0' }}>{ocorrencia.titulo}</h2>
            <p className="text-xs mt-1" style={{ color: '#8899AA' }}>
              {new Date(ocorrencia.data_ocorrencia + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition">
            <X className="w-5 h-5" style={{ color: '#8899AA' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#8899AA' }}>Total</div>
              <div className="text-sm font-mono font-bold" style={{ color: '#E0E0E0' }}>{formatBRL(ocorrencia.valor_total)}</div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#4ADE80' }}>Pago</div>
              <div className="text-sm font-mono font-bold" style={{ color: '#4ADE80' }}>{formatBRL(ocorrencia.valor_pago_total)}</div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#FF6B6B' }}>Pendente</div>
              <div className="text-sm font-mono font-bold" style={{ color: '#FF6B6B' }}>{formatBRL(ocorrencia.valor_total - ocorrencia.valor_pago_total)}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Progresso</span>
              <span className="text-xs font-mono font-bold" style={{ color: '#00D4FF' }}>{ocorrencia.percentual_pago.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full transition-all duration-700"
                style={{
                  width: `${ocorrencia.percentual_pago}%`,
                  background: 'linear-gradient(90deg, rgba(0,212,255,0.8), rgba(74,222,128,1))',
                  boxShadow: '0 0 10px rgba(0,212,255,0.6)',
                }} />
            </div>
          </div>

          {ocorrencia.descricao && (
            <div className="p-3 rounded-lg text-xs leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#8899AA' }}>
              {ocorrencia.descricao}
            </div>
          )}

          <div className="space-y-4">
            {ocorrencia.responsaveis.map(resp => {
              const progresso = resp.valor_devido > 0 ? (resp.valor_pago / resp.valor_devido) * 100 : 0;
              return (
                <div key={resp.id} className="rounded-xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                        {resp.usuario_foto ? <img src={resp.usuario_foto} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5" style={{ color: '#00D4FF' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: '#E0E0E0' }}>{resp.usuario_nome}</div>
                        <div className="text-[10px]" style={{ color: '#8899AA' }}>{resp.percentual.toFixed(2)}% · {formatBRL(resp.valor_devido)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#8899AA' }}>Pago</div>
                        <div className="text-sm font-mono font-bold" style={{ color: '#4ADE80' }}>{formatBRL(resp.valor_pago)}</div>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full" style={{ width: `${progresso}%`, background: 'linear-gradient(90deg, rgba(0,212,255,0.8), rgba(74,222,128,1))' }} />
                    </div>
                  </div>

                  <div className="p-2 space-y-1.5">
                    {resp.parcelas.map(p => (
                      <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition hover:bg-white/5">
                        <button type="button" onClick={() => toggleParcela(p)}
                          className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition"
                          style={{
                            background: p.deduzido ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1.5px solid ${p.deduzido ? '#4ADE80' : 'rgba(255,255,255,0.08)'}`,
                            boxShadow: p.deduzido ? '0 0 10px rgba(74,222,128,0.4)' : 'none',
                          }}>
                          {p.deduzido && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#4ADE80' }} />}
                        </button>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className="text-xs font-mono font-bold w-12" style={{ color: '#00D4FF' }}>{p.numero_parcela}/{p.total_parcelas}</div>
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#8899AA' }}>
                            <Calendar className="w-3 h-3" />
                            {new Date(p.mes_referencia + 'T00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="text-sm font-mono font-bold" style={{ color: p.deduzido ? '#4ADE80' : '#E0E0E0' }}>
                          {formatBRL(p.valor)}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {ocorrencia.status === 'quitado' && (
            <div className="p-4 rounded-xl flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(0,212,255,0.1))',
                border: '1px solid rgba(74,222,128,0.3)',
                boxShadow: '0 0 30px rgba(74,222,128,0.2)',
              }}>
              <Sparkles className="w-5 h-5" style={{ color: '#4ADE80' }} />
              <div>
                <div className="text-sm font-bold" style={{ color: '#4ADE80' }}>Ocorrência Quitada</div>
                <div className="text-xs" style={{ color: '#8899AA' }}>Todos os valores foram deduzidos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
