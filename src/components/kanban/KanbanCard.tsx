import { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { formatTipoAtendimentoShort } from '../../lib/supabase';
import {
  Search, AlertCircle, Clock, Package, Calendar, CheckCircle,
  DollarSign, Copy, User, ArrowRightLeft, MessageCircle,
  ShieldAlert, ShieldCheck, ChevronsUpDown, ChevronRight, Archive,
} from 'lucide-react';
import type { Database } from '../../lib/database.types';

type OS = Database['public']['Tables']['os']['Row'];

export interface BadgeFilters {
  pedidoAtivo: boolean;
  pecaTransito: boolean;
  comTecnico: boolean;
  agendamento: boolean;
  financeiro: boolean;
  lucro: boolean;
  sla: boolean;
  status: boolean;
  iniciarReparo: boolean;
  analiseConcluida: boolean;
  tecnico: boolean;
  fecharOS: boolean;
}

export interface KanbanCardProps {
  os: OS;
  colunaId: string;
  colunaColor: string;
  textColor: string;
  badgeFilters: BadgeFilters;
  mostrarInfoFinanceira: boolean;
  searchMatchSource: Record<string, 'hidden' | 'visible'>;
  isDragged: boolean;
  onDragStart: (e: React.DragEvent, os: OS) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardDragOver: (e: React.DragEvent, colunaId: string, index: number) => void;
  onCardClick: (os: OS) => void;
  onAnalise: (os: OS) => void;
  onIniciarReparo: (os: OS) => void;
  onFecharOS: (os: OS) => void;
  onMoveOS: (os: OS, targetColumn: string) => void;
  onArchive?: (os: OS) => void;
  allColunas: { id: string; label: string }[];
  index: number;
}

function getTATLimite(tipoOS: string, tipoAtendimento: string): number {
  if (tipoOS === 'LP') {
    return tipoAtendimento === 'CI' ? 3 : 6;
  }
  return tipoAtendimento === 'CI' ? 5 : 10;
}

function getTATColor(createdAt: string, tipoOS: string, tipoAtendimento: string) {
  const diasAberto = Math.floor(
    (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const limite = getTATLimite(tipoOS, tipoAtendimento);
  const percentual = (diasAberto / limite) * 100;

  if (percentual <= 70) {
    return {
      background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.15) 100%)',
      color: '#10b981',
      border: '1px solid rgba(16,185,129,0.5)',
      boxShadow: '0 0 8px rgba(16,185,129,0.3)'
    };
  } else if (percentual <= 100) {
    return {
      background: 'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.15) 100%)',
      color: '#fbbf24',
      border: '1px solid rgba(251,191,36,0.5)',
      boxShadow: '0 0 8px rgba(251,191,36,0.3)'
    };
  }
  return {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.15) 100%)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,0.5)',
    boxShadow: '0 0 8px rgba(239,68,68,0.3)'
  };
}

function calcularTAT(createdAt: string) {
  return Math.floor(
    (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatTempoNaEtapa(updatedAt: string) {
  const diffMs = new Date().getTime() - new Date(updatedAt).getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const parts: string[] = [];
  if (dias > 0) parts.push(`${dias}d`);
  if (horas > 0) parts.push(`${horas}h`);
  if (minutos > 0 || parts.length === 0) parts.push(`${minutos}m`);
  return parts.join(' ');
}

function calcularValorPecas(os: any) {
  if (!os.requisicoes || os.requisicoes.length === 0) return 0;
  return os.requisicoes.reduce((total: number, req: any) => total + (req.valor_peca || 0), 0);
}

function calcularValorGSPN(os: any) {
  let totalGSPN = 0;
  if (os.cotacao_pecas?.length > 0) {
    totalGSPN += os.cotacao_pecas.reduce((total: number, peca: any) => {
      return total + ((peca.valor_base_gspn || 0) * (peca.quantidade || 1));
    }, 0);
  }
  if (os.os_pecas?.length > 0) {
    totalGSPN += os.os_pecas.reduce((total: number, peca: any) => total + (peca.valor_gspn || 0), 0);
  }
  return totalGSPN;
}

function calcularSubtotal(os: any) {
  if (os.tipo_os !== 'OW') return null;
  return (os.valor_total || 0) + (os.valor_desconto_calculado || 0);
}

function calcularLucro(os: any) {
  if (os.tipo_os !== 'OW') return null;
  const receitaLiquida = os.valor_total || 0;
  const custoPecasGSPN = calcularValorGSPN(os);
  const taxasCartao = (os.pagamentos || []).reduce((sum: number, pag: any) => sum + (pag.taxa_valor || 0), 0);
  return receitaLiquida - custoPecasGSPN - taxasCartao;
}

export const ClosedOSCard = memo(function ClosedOSCard({
  os, colunaId, colunaColor, textColor, isDragged,
  onDragStart, onDragEnd, onCardDragOver, onCardClick, onArchive, index
}: Pick<KanbanCardProps, 'os' | 'colunaId' | 'colunaColor' | 'textColor' | 'isDragged' | 'onDragStart' | 'onDragEnd' | 'onCardDragOver' | 'onCardClick' | 'index'> & { onArchive?: (os: OS) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, os)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onCardDragOver(e, colunaId, index)}
      onClick={() => onCardClick(os)}
      className="rounded-lg p-2 cursor-pointer group relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.2) 100%)',
        border: `1px solid ${textColor}20`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        opacity: isDragged ? 0.4 : 1
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${textColor}50`;
        e.currentTarget.style.boxShadow = `0 2px 8px ${colunaColor}20`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${textColor}20`;
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-[#39FF14] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 3px var(--neon-green))' }} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[10px] text-white truncate">
            {os.numero_os_samsung || os.numero_os_interna || 'S/N'}
          </p>
          <p className="text-[9px] text-gray-400 truncate">{os.cliente_nome}</p>
        </div>
        {onArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(os); }}
            className="px-2 py-1 rounded-md text-[9px] font-bold transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
            style={{
              background: 'linear-gradient(135deg, rgba(251,146,60,0.2) 0%, rgba(251,146,60,0.05) 100%)',
              border: '1px solid rgba(251,146,60,0.5)',
              color: '#FB923C',
              boxShadow: '0 0 8px rgba(251,146,60,0.2)'
            }}
            title="Arquivar OS"
          >
            <Archive className="w-3 h-3" />
            ARQUIVAR
          </button>
        )}
      </div>
    </div>
  );
});

export const KanbanCard = memo(function KanbanCard({
  os, colunaId, colunaColor, textColor, badgeFilters, mostrarInfoFinanceira,
  searchMatchSource, isDragged, onDragStart, onDragEnd, onCardDragOver,
  onCardClick, onAnalise, onIniciarReparo, onFecharOS, onMoveOS, onArchive, allColunas, index
}: KanbanCardProps) {
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const moveRef = useRef<HTMLDivElement>(null);
  const moveBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!moveOpen) return;
    function handleClick(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node) &&
          moveBtnRef.current && !moveBtnRef.current.contains(e.target as Node)) {
        setMoveOpen(false);
        setMoveSearch('');
      }
    }
    function handleScroll(e: Event) {
      if (moveRef.current && moveRef.current.contains(e.target as Node)) return;
      setMoveOpen(false);
      setMoveSearch('');
    }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [moveOpen]);

  useEffect(() => {
    if (moveOpen && moveBtnRef.current) {
      const rect = moveBtnRef.current.getBoundingClientRect();
      const dropdownWidth = 240;
      const dropdownHeight = 280;
      let left = rect.right - dropdownWidth;
      let top = rect.bottom + 6;
      if (left < 8) left = 8;
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 6;
      }
      setDropdownPos({ top, left });
    }
  }, [moveOpen]);

  const filteredColunas = allColunas.filter(c =>
    c.id !== colunaId &&
    c.label.toLowerCase().includes(moveSearch.toLowerCase())
  );

  if (colunaId === 'os_fechada') {
    return (
      <ClosedOSCard
        os={os} colunaId={colunaId} colunaColor={colunaColor} textColor={textColor}
        isDragged={isDragged} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onCardDragOver={onCardDragOver} onCardClick={onCardClick} onArchive={onArchive} index={index}
      />
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, os)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onCardDragOver(e, colunaId, index)}
      onClick={() => onCardClick(os)}
      className="rounded-xl p-3 cursor-pointer group relative overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        border: `1px solid ${textColor}15`,
        boxShadow: 'var(--card-shadow)',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.25s ease',
        opacity: isDragged ? 0.4 : 1
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${textColor}45`;
        e.currentTarget.style.boxShadow = `0 6px 20px ${colunaColor}18, 0 0 16px ${colunaColor}10`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${textColor}15`;
        e.currentTarget.style.boxShadow = 'var(--card-shadow)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: `linear-gradient(90deg, ${colunaColor}, ${colunaColor}40, transparent)`,
      }}></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <h5 className="font-bold text-xs truncate" style={{ color: 'var(--text-primary)' }}>
              {os.numero_os_samsung || os.numero_os_interna || 'S/N'}
            </h5>
            {searchMatchSource[os.id] === 'hidden' && (
              <div
                className="p-0.5 rounded flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.2) 0%, rgba(var(--neon-green-rgb),0.1) 100%)',
                  border: '1px solid rgba(var(--neon-green-rgb),0.4)',
                  boxShadow: '0 0 8px rgba(var(--neon-green-rgb),0.3)'
                }}
                title="Correspondência encontrada em comentários, peças ou histórico"
              >
                <Search className="w-2.5 h-2.5 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 3px var(--neon-green))' }} />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const textToCopy = os.numero_os_samsung || os.numero_os_interna || '';
                navigator.clipboard.writeText(textToCopy);
                const btn = e.currentTarget;
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<span style="color: #39FF14;">&#10003;</span>';
                setTimeout(() => { btn.innerHTML = originalHTML; }, 1000);
              }}
              className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              title="Copiar número da OS"
            >
              <Copy className="w-3 h-3 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 4px var(--text-accent))' }} />
            </button>
          </div>
          <p className="text-[10px] text-gray-500 truncate">{os.cliente_nome}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {os.cliente_telefone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const phone = os.cliente_telefone!.replace(/\D/g, '');
                navigate(`/atom-connect?os_id=${os.id}&phone=${phone}`);
              }}
              className="p-1 rounded-md transition-all opacity-0 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.05) 100%)',
                border: '1px solid rgba(0,212,255,0.3)',
              }}
              title="Abrir conversa no Atom Connect"
            >
              <MessageCircle className="w-3 h-3 text-cyan-400" style={{ filter: 'drop-shadow(0 0 3px #00D4FF)' }} />
            </button>
          )}
          {/* Move button */}
          <div className="relative">
            <button
              ref={moveBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setMoveOpen(o => !o);
                setMoveSearch('');
              }}
              className="p-1 rounded-md transition-all opacity-0 group-hover:opacity-100"
              style={{
                background: moveOpen
                  ? 'linear-gradient(135deg, rgba(255,191,0,0.25) 0%, rgba(255,191,0,0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(255,191,0,0.12) 0%, rgba(255,191,0,0.04) 100%)',
                border: `1px solid ${moveOpen ? 'rgba(255,191,0,0.5)' : 'rgba(255,191,0,0.25)'}`,
              }}
              title="Mover OS para outra coluna"
            >
              <ChevronsUpDown className="w-3 h-3 text-[#FFBF00]" style={{ filter: 'drop-shadow(0 0 3px rgba(255,191,0,0.6))' }} />
            </button>

            {moveOpen && dropdownPos && createPortal(
              <div
                ref={moveRef}
                className="fixed z-[99999] rounded-xl overflow-hidden"
                style={{
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: 240,
                  background: 'linear-gradient(135deg, #0d1117 0%, #0a0a0a 100%)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-black text-[#FFBF00] uppercase tracking-wider mb-2">Mover para</p>
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Buscar coluna..."
                      value={moveSearch}
                      onChange={e => setMoveSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && filteredColunas.length > 0) {
                          onMoveOS(os, filteredColunas[0].id);
                          setMoveOpen(false);
                          setMoveSearch('');
                        }
                        if (e.key === 'Escape') {
                          setMoveOpen(false);
                          setMoveSearch('');
                        }
                      }}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg text-[11px] bg-white/5 text-white placeholder-gray-600 outline-none"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-56" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                  {filteredColunas.length === 0 ? (
                    <p className="text-[10px] text-gray-600 text-center py-4">Nenhuma coluna encontrada</p>
                  ) : filteredColunas.map(col => (
                    <button
                      key={col.id}
                      onClick={() => {
                        onMoveOS(os, col.id);
                        setMoveOpen(false);
                        setMoveSearch('');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,191,0,0.08)';
                        (e.currentTarget as HTMLElement).style.color = '#FFBF00';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      <span className="text-[11px] font-medium truncate pr-2">{col.label}</span>
                      <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-40" />
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>
          {os.alerta_divergencia_gspn && (
            <div className="p-1 rounded-md flex-shrink-0" style={{
              backgroundColor: 'rgba(255,0,100,0.15)',
              border: '1px solid rgba(255,0,100,0.4)'
            }}>
              <AlertCircle className="w-3 h-3 text-[#FF0064]" style={{ filter: 'drop-shadow(0 0 4px rgba(255, 0, 100, 0.8))' }} />
            </div>
          )}
          {(() => {
            const alertas = (os as any).alertas_fechamento?.filter((a: any) => !a.resolvido) || [];
            const bloqueios = alertas.filter((a: any) => a.severidade === 'bloqueante');
            if (alertas.length === 0) return null;
            return (
              <div
                className="p-1 rounded-md flex-shrink-0 flex items-center gap-0.5"
                style={{
                  backgroundColor: bloqueios.length > 0 ? 'rgba(255,0,100,0.12)' : 'rgba(255,191,0,0.12)',
                  border: `1px solid ${bloqueios.length > 0 ? 'rgba(255,0,100,0.35)' : 'rgba(255,191,0,0.35)'}`,
                }}
                title={`${alertas.length} alerta(s) de fechamento${bloqueios.length > 0 ? ` (${bloqueios.length} bloqueante(s))` : ''}`}
              >
                <ShieldAlert className="w-3 h-3" style={{ color: bloqueios.length > 0 ? '#FF0064' : '#FFBF00', filter: `drop-shadow(0 0 3px ${bloqueios.length > 0 ? 'rgba(255,0,100,0.6)' : 'rgba(255,191,0,0.6)'})` }} />
                <span className="text-[8px] font-black" style={{ color: bloqueios.length > 0 ? '#FF0064' : '#FFBF00' }}>{alertas.length}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Badges area */}
      <div className="space-y-1.5 text-xs">
        {/* Type badges + TAT */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{
              background: os.tipo_atendimento === 'IH'
                ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.1) 100%)',
              color: os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316',
              border: `1px solid ${os.tipo_atendimento === 'IH' ? 'rgba(16,185,129,0.5)' : 'rgba(249,115,22,0.5)'}`,
              boxShadow: `0 0 8px ${os.tipo_atendimento === 'IH' ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.2)'}`
            }}
          >
            {formatTipoAtendimentoShort(os.tipo_atendimento)}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{
              background: os.tipo_os === 'LP'
                ? 'linear-gradient(135deg, rgba(255,165,0,0.25) 0%, rgba(255,165,0,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(var(--accent-rgb),0.25) 0%, rgba(var(--accent-rgb),0.1) 100%)',
              color: os.tipo_os === 'LP' ? '#FFA500' : 'var(--text-accent)',
              border: `1px solid ${os.tipo_os === 'LP' ? 'rgba(255,165,0,0.5)' : 'rgba(var(--accent-rgb),0.5)'}`,
              boxShadow: `0 0 8px ${os.tipo_os === 'LP' ? 'rgba(255,165,0,0.2)' : 'rgba(var(--accent-rgb),0.2)'}`
            }}
          >
            {os.tipo_os}
          </span>
          {os.tipo_orcamento === 'samsung_contigo' && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{
                background: 'linear-gradient(135deg, rgba(255,165,0,0.25) 0%, rgba(255,165,0,0.1) 100%)',
                color: '#FFA500',
                border: '1px solid rgba(255,165,0,0.5)',
                boxShadow: '0 0 8px rgba(255,165,0,0.2)'
              }}
              title="Samsung Contigo"
            >
              SC
            </span>
          )}
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold ml-auto"
            style={getTATColor(os.created_at, os.tipo_os, os.tipo_atendimento)}
            title={`TAT: ${calcularTAT(os.created_at)}d - Limite: ${getTATLimite(os.tipo_os, os.tipo_atendimento)}d (${os.tipo_os} ${os.tipo_atendimento})`}
          >
            TAT: {calcularTAT(os.created_at)}d
          </span>
        </div>

        {/* Versao orcamento */}
        {(os as any).versao_orcamento > 1 && (
          <div className="mt-1.5 rounded-md p-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,0,100,0.15) 0%, rgba(255,0,100,0.05) 100%)',
              border: '1px solid rgba(255,0,100,0.4)',
              boxShadow: '0 0 10px rgba(255,0,100,0.2)',
              animation: 'pulse 2s infinite'
            }}
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-[#FF0064] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #FF0064)' }} />
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,0,100,0.3) 0%, rgba(255,0,100,0.15) 100%)',
                  color: '#FF0064',
                  border: '1px solid rgba(255,0,100,0.5)'
                }}
              >
                {(os as any).versao_orcamento}o ORCAMENTO
              </span>
            </div>
          </div>
        )}

        {/* Samsung status */}
        {badgeFilters.status && os.numero_os_samsung && ((os as any).status_samsung_desc || (os as any).status_samsung_reason) && (
          <div className="mt-1.5 rounded-md p-1.5"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.03) 100%)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 10px rgba(139,92,246,0.1)'
            }}
          >
            <div className="text-[9px] space-y-1">
              {(os as any).status_samsung_desc && (
                <>
                  <span className="text-[#8B5CF6] font-bold block">Status:</span>
                  <span className="text-gray-200 font-medium block">{(os as any).status_samsung_desc}</span>
                </>
              )}
              {(os as any).status_samsung_reason && (
                <>
                  <span className="text-[#8B5CF6] font-bold block mt-1">Motivo:</span>
                  <span className="text-gray-200 font-medium block">{(os as any).status_samsung_reason}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pecas em transito */}
        {badgeFilters.pecaTransito && (() => {
          const pecasEmTransito = (os as any).requisicoes?.filter((req: any) =>
            req.status === 'pedido_feito'
          ) || [];
          if (pecasEmTransito.length === 0) return null;
          return (
            <div className="mt-1.5 rounded-md p-1.5 space-y-1"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.1) 0%, rgba(var(--accent-rgb),0.03) 100%)',
                border: '1px solid rgba(var(--accent-rgb),0.3)',
                boxShadow: '0 0 10px rgba(var(--accent-rgb),0.1)'
              }}
            >
              <div className="flex items-center gap-1.5">
                <Package className="w-3 h-3 text-[#00D4FF] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px var(--text-accent))' }} />
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.3) 0%, rgba(var(--accent-rgb),0.15) 100%)',
                    color: 'var(--text-accent)',
                    border: '1px solid rgba(var(--accent-rgb),0.5)'
                  }}
                >
                  {pecasEmTransito.length} PECA{pecasEmTransito.length > 1 ? 'S' : ''} EM TRANSITO
                </span>
              </div>
              {pecasEmTransito.map((req: any) => {
                const diasDesdeRequisicao = Math.floor(
                  (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={req.id} className="text-[9px] space-y-0.5 pl-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 truncate flex-1 pr-1">{req.codigo_peca}</span>
                      <span className="text-[#FFBF00] font-bold flex-shrink-0">{diasDesdeRequisicao}d</span>
                    </div>
                    {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                      <div className="text-[#00D4FF] font-mono truncate">
                        Pedido: {req.numero_pedido_samsung}
                      </div>
                    )}
                    {req.peca_estoque?.delivery && (
                      <div className="text-[#39FF14] font-mono truncate">
                        Delivery: {req.peca_estoque.delivery}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Agendamento */}
        {badgeFilters.agendamento && os.data_agendamento && os.tecnico_agendado_id && os.confirmado_com_cliente && (
          <div className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
            style={{
              borderColor: 'rgba(var(--neon-green-rgb),0.3)',
              background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.1) 0%, rgba(var(--neon-green-rgb),0.03) 100%)',
              boxShadow: '0 0 10px rgba(var(--neon-green-rgb),0.1)'
            }}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#39FF14] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px var(--neon-green))' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.3) 0%, rgba(var(--neon-green-rgb),0.15) 100%)',
                      color: 'var(--neon-green)',
                      border: '1px solid rgba(var(--neon-green-rgb),0.5)'
                    }}
                  >
                    AGENDADO
                  </span>
                  <CheckCircle className="w-2.5 h-2.5 text-[#39FF14]" />
                </div>
                <p className="text-[10px] text-gray-300 font-medium">
                  {new Date(os.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                {(os as any).tecnico_agendado?.nome && (
                  <p className="text-[9px] text-gray-500 truncate">{(os as any).tecnico_agendado.nome}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tecnico designado */}
        {badgeFilters.tecnico && os.tecnico_designado_id && (os as any).tecnico_designado?.nome && (
          <div className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
            style={{
              borderColor: 'rgba(var(--accent-rgb),0.3)',
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.1) 0%, rgba(var(--accent-rgb),0.03) 100%)',
              boxShadow: '0 0 10px rgba(var(--accent-rgb),0.1)'
            }}
          >
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-[#00D4FF] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px var(--text-accent))' }} />
              <div className="flex-1 min-w-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.3) 0%, rgba(var(--accent-rgb),0.15) 100%)',
                    color: 'var(--text-accent)',
                    border: '1px solid rgba(var(--accent-rgb),0.5)'
                  }}
                >
                  TECNICO
                </span>
                <p className="text-[10px] text-gray-300 font-medium truncate">{(os as any).tecnico_designado.nome}</p>
              </div>
            </div>
          </div>
        )}

        {/* Financeiro */}
        {badgeFilters.financeiro && mostrarInfoFinanceira && os.valor_total && os.valor_total > 0 && (
          <div className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
            style={{
              borderColor: os.status_pagamento === 'pago' ? 'rgba(var(--neon-green-rgb),0.3)' :
                           os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.3)' : 'rgba(255,0,100,0.3)',
              background: os.status_pagamento === 'pago' ? 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.1) 0%, rgba(var(--neon-green-rgb),0.03) 100%)' :
                               os.status_pagamento === 'parcial' ? 'linear-gradient(135deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.03) 100%)' : 'linear-gradient(135deg, rgba(255,0,100,0.1) 0%, rgba(255,0,100,0.03) 100%)',
              boxShadow: `0 0 10px ${os.status_pagamento === 'pago' ? 'rgba(var(--neon-green-rgb),0.1)' : os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.1)' : 'rgba(255,0,100,0.1)'}`
            }}
          >
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 flex-shrink-0"
                style={{
                  color: os.status_pagamento === 'pago' ? 'var(--neon-green)' :
                         os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064',
                  filter: `drop-shadow(0 0 4px ${os.status_pagamento === 'pago' ? 'var(--neon-green)' : os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064'})`
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-1"
                  style={{
                    background: os.status_pagamento === 'pago' ? 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.3) 0%, rgba(var(--neon-green-rgb),0.15) 100%)' :
                                       os.status_pagamento === 'parcial' ? 'linear-gradient(135deg, rgba(255,191,0,0.3) 0%, rgba(255,191,0,0.15) 100%)' : 'linear-gradient(135deg, rgba(255,0,100,0.3) 0%, rgba(255,0,100,0.15) 100%)',
                    color: os.status_pagamento === 'pago' ? 'var(--neon-green)' :
                           os.status_pagamento === 'parcial' ? '#FFBF00' : '#FF0064',
                    border: `1px solid ${os.status_pagamento === 'pago' ? 'rgba(var(--neon-green-rgb),0.5)' :
                                          os.status_pagamento === 'parcial' ? 'rgba(255,191,0,0.5)' : 'rgba(255,0,100,0.5)'}`
                  }}
                >
                  {os.status_pagamento === 'pago' ? 'PAGO' :
                   os.status_pagamento === 'parcial' ? 'PARCIAL' : 'PENDENTE'}
                </span>
                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total:</span>
                    <span className="text-white font-mono font-bold">R$ {(os.valor_total || 0).toFixed(2)}</span>
                  </div>
                  {os.valor_pago > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Pago:</span>
                      <span className="text-[#39FF14] font-mono">R$ {(os.valor_pago || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Saldo:</span>
                    <span className={`font-mono font-bold ${(os.saldo_restante || 0) > 0 ? 'text-[#FFBF00]' : 'text-[#39FF14]'}`}>
                      R$ {(os.saldo_restante || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lucro */}
        {badgeFilters.lucro && mostrarInfoFinanceira && (() => {
          const valorPecas = calcularValorPecas(os);
          const valorGSPN = calcularValorGSPN(os);
          const lucro = calcularLucro(os);
          const subtotal = calcularSubtotal(os);
          if (!valorPecas && !valorGSPN && !subtotal) return null;
          return (
            <div className="space-y-1 mt-1.5 pt-1.5 border-t" style={{ borderColor: `${textColor}20` }}>
              {valorPecas > 0 && (
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-accent)', textShadow: '0 0 6px rgba(var(--accent-rgb),0.5)' }}>PECAS:</span>
                  <span className="font-mono text-white text-[10px] font-bold">
                    R$ {valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {valorGSPN > 0 && (
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold" style={{ color: '#FFA500', textShadow: '0 0 6px rgba(255,165,0,0.5)' }}>GSPN:</span>
                  <span className="font-mono text-[#FFA500] text-[10px] font-bold">
                    R$ {valorGSPN.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {os.tipo_os === 'OW' && subtotal && subtotal > 0 && (
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-accent)', textShadow: '0 0 6px rgba(var(--accent-rgb),0.5)' }}>ORCAM:</span>
                  <span className="font-mono text-[#00F5FF] text-[10px] font-bold">
                    R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {os.tipo_os === 'OW' && lucro !== null && subtotal && subtotal > 0 && (
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold" style={{
                    color: lucro >= 0 ? 'var(--neon-green)' : '#FF0064',
                    textShadow: `0 0 6px ${lucro >= 0 ? 'rgba(var(--neon-green-rgb),0.5)' : 'rgba(255,0,100,0.5)'}`
                  }}>LUCRO:</span>
                  <span className={`font-mono text-[10px] font-bold ${lucro >= 0 ? 'text-[#39FF14]' : 'text-[#FF0064]'}`}>
                    R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tempo na etapa */}
        {badgeFilters.sla && (
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t" style={{ borderColor: `${textColor}20` }}>
            <Clock className="w-3 h-3 text-[#FFBF00]" style={{ filter: 'drop-shadow(0 0 4px #FFBF00)' }} />
            <span className="text-[#FFBF00] font-bold text-[10px]">
              Tempo na Etapa: {formatTempoNaEtapa(os.updated_at)}
            </span>
          </div>
        )}

        {/* Pedido ativo */}
        {badgeFilters.pedidoAtivo && (os as any).requisicoes?.filter((r: any) => r.status === 'pedido_feito').map((req: any) => (
          <div key={req.id} className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
            style={{
              borderColor: 'rgba(255,191,0,0.3)',
              background: 'linear-gradient(135deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.03) 100%)',
              boxShadow: '0 0 10px rgba(255,191,0,0.1)'
            }}
          >
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3 text-[#FFBF00] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #FFBF00)' }} />
              <div className="flex-1 min-w-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,191,0,0.3) 0%, rgba(255,191,0,0.15) 100%)',
                    color: '#FFBF00',
                    border: '1px solid rgba(255,191,0,0.5)'
                  }}
                >
                  PEDIDO ATIVO
                </span>
                <p className="text-[10px] text-gray-300 font-medium truncate">{req.peca_estoque?.pn || req.codigo_peca}</p>
                <p className="text-[9px] text-gray-400 truncate">{req.descricao}</p>
                <div className="flex flex-col gap-1 mt-0.5">
                  {req.is_lote && req.pecas_lote?.length > 0 ? (
                    req.pecas_lote.map((peca: any) => (
                      <div key={peca.id} className="flex items-center gap-1.5 flex-wrap">
                        {peca.estoque_etiquetas?.[0]?.id_sequencial && (
                          <span className="text-[8px] text-cyan-400 font-mono font-bold">ID: {peca.estoque_etiquetas[0].id_sequencial}</span>
                        )}
                        {peca.estoque_etiquetas?.[0]?.delivery && (
                          <span className="text-[8px] text-orange-400">{peca.estoque_etiquetas[0].delivery}</span>
                        )}
                        {peca.gi_postada_em && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
                            GI {new Date(peca.gi_postada_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} por {peca.usuario_gi_postado?.nome || 'N/A'}
                          </span>
                        )}
                        {!peca.gi_postada_em && req.status === 'gi_postada' && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            GI Pendente
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {req.peca_estoque?.estoque_etiquetas?.[0]?.id_sequencial && (
                        <span className="text-[8px] text-cyan-400 font-mono font-bold">ID: {req.peca_estoque.estoque_etiquetas[0].id_sequencial}</span>
                      )}
                      {req.peca_estoque?.estoque_etiquetas?.[0]?.delivery && (
                        <span className="text-[8px] text-orange-400">Delivery: {req.peca_estoque.estoque_etiquetas[0].delivery}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Com tecnico / GI */}
        {badgeFilters.comTecnico && (os as any).requisicoes?.filter((r: any) => ['atendida', 'em_uso', 'gi_postada'].includes(r.status)).map((req: any) => (
          <div key={req.id} className="mt-1.5 pt-1.5 border-t rounded-md p-1.5"
            style={{
              borderColor: 'rgba(var(--neon-green-rgb),0.3)',
              background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.1) 0%, rgba(var(--neon-green-rgb),0.03) 100%)',
              boxShadow: '0 0 10px rgba(var(--neon-green-rgb),0.1)'
            }}
          >
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3 text-[#39FF14] flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px var(--neon-green))' }} />
              <div className="flex-1 min-w-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mb-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.3) 0%, rgba(var(--neon-green-rgb),0.15) 100%)',
                    color: 'var(--neon-green)',
                    border: '1px solid rgba(var(--neon-green-rgb),0.5)'
                  }}
                >
                  {req.status === 'atendida' ? 'COM TECNICO' : req.status === 'em_uso' ? 'EM USO' : 'GI PENDENTE'}
                </span>
                <p className="text-[10px] text-gray-300 font-medium truncate">{req.peca_estoque?.pn || req.codigo_peca}</p>
                <p className="text-[9px] text-gray-400 truncate">{req.descricao}</p>
                <div className="flex flex-col gap-1 mt-0.5">
                  {req.is_lote && req.pecas_lote?.length > 0 ? (
                    req.pecas_lote.map((peca: any) => (
                      <div key={peca.id} className="flex items-center gap-1.5 flex-wrap">
                        {peca.estoque_etiquetas?.[0]?.id_sequencial && (
                          <span className="text-[8px] text-cyan-400 font-mono font-bold">ID: {peca.estoque_etiquetas[0].id_sequencial}</span>
                        )}
                        {peca.estoque_etiquetas?.[0]?.delivery && (
                          <span className="text-[8px] text-orange-400">{peca.estoque_etiquetas[0].delivery}</span>
                        )}
                        {peca.gi_postada_em && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
                            GI {new Date(peca.gi_postada_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} por {peca.usuario_gi_postado?.nome || 'N/A'}
                          </span>
                        )}
                        {!peca.gi_postada_em && req.status === 'gi_postada' && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            GI Pendente
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {req.peca_estoque?.estoque_etiquetas?.[0]?.id_sequencial && (
                        <span className="text-[8px] text-cyan-400 font-mono font-bold">ID: {req.peca_estoque.estoque_etiquetas[0].id_sequencial}</span>
                      )}
                      {req.peca_estoque?.estoque_etiquetas?.[0]?.delivery && (
                        <span className="text-[8px] text-orange-400">Delivery: {req.peca_estoque.estoque_etiquetas[0].delivery}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Iniciar Reparo */}
        {badgeFilters.iniciarReparo && colunaId === 'os_nova' && os.tipo_atendimento === 'CI' && os.tipo_orcamento !== 'samsung_contigo' && os.tipo_orcamento !== 'acessorios' && (
          <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: 'rgba(var(--accent-rgb),0.2)' }}>
            {os.tecnico_designado_id && (os as any).tecnico_designado && (
              <div className="rounded-lg p-2" style={{
                background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.1) 0%, rgba(var(--neon-green-rgb),0.03) 100%)',
                border: '1px solid rgba(var(--neon-green-rgb),0.3)'
              }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3 h-3 text-[#39FF14] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-gray-400">Tecnico:</p>
                      <p className="text-[10px] font-bold text-[#39FF14] truncate">
                        {(os as any).tecnico_designado.nome}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onIniciarReparo(os); }}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Alterar tecnico"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-[#FFBF00]" />
                  </button>
                </div>
              </div>
            )}
            {!os.tecnico_designado_id && (
              <button
                onClick={(e) => { e.stopPropagation(); onIniciarReparo(os); }}
                className="w-full px-3 py-2 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.2) 0%, rgba(var(--neon-green-rgb),0.05) 100%)',
                  border: '1px solid var(--neon-green)',
                  color: 'var(--neon-green)',
                  boxShadow: '0 0 10px rgba(var(--neon-green-rgb),0.2)'
                }}
              >
                <User className="w-3.5 h-3.5" />
                INICIAR REPARO
              </button>
            )}
          </div>
        )}

        {/* Analise Concluida */}
        {badgeFilters.analiseConcluida && colunaId === 'diagnostico' && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(var(--accent-rgb),0.2)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAnalise(os); }}
              className="w-full px-3 py-2 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                border: '1px solid var(--text-accent)',
                color: 'var(--text-accent)',
                boxShadow: '0 0 10px rgba(var(--accent-rgb),0.2)'
              }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              ANALISE CONCLUIDA
            </button>
          </div>
        )}

        {/* Fechar OS */}
        {badgeFilters.fecharOS && (colunaId === 'fechar_os' || colunaId === 'aguardando_fechamento') && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onFecharOS(os); }}
              className="w-full px-3 py-2 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)',
                border: '1px solid rgba(34,197,94,0.6)',
                color: '#22C55E',
                boxShadow: '0 0 10px rgba(34,197,94,0.2)'
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              FECHAR OS
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
