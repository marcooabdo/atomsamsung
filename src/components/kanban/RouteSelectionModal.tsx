import { useState, useEffect } from 'react';
import { AlertCircle, MapPin, Pencil, Check } from 'lucide-react';

interface RouteSelectionModalProps {
  isOpen: boolean;
  cidade: string;
  clienteNome?: string;
  osNumero?: string;
  clienteBairro?: string;
  onSelectRoute: (rotaColumn: string, cidadeCorrigida: string) => void;
  onConfirmCity?: (cidadeEditada: string) => void;
  onCancel: () => void;
}

const ROTAS_OPTIONS = [
  { kanban: 'rota_preta', label: 'Preta', cor: '#1a1a1a', border: '#555' },
  { kanban: 'rota_vermelha', label: 'Vermelha', cor: '#EF4444', border: '#EF4444' },
  { kanban: 'rota_azul', label: 'Azul', cor: '#3B82F6', border: '#3B82F6' },
  { kanban: 'rota_verde', label: 'Verde', cor: '#10B981', border: '#10B981' },
  { kanban: 'rota_rosa', label: 'Rosa', cor: '#EC4899', border: '#EC4899' },
  { kanban: 'rota_amarela', label: 'Amarela', cor: '#EAB308', border: '#EAB308' },
  { kanban: 'rota_laranja', label: 'Laranja', cor: '#F97316', border: '#F97316' },
];

export function RouteSelectionModal({
  isOpen,
  cidade,
  clienteNome,
  osNumero,
  clienteBairro,
  onSelectRoute,
  onConfirmCity,
  onCancel,
}: RouteSelectionModalProps) {
  const [editandoCidade, setEditandoCidade] = useState(false);
  const [cidadeEditada, setCidadeEditada] = useState(cidade || '');

  useEffect(() => {
    if (isOpen) {
      setCidadeEditada(cidade || '');
      setEditandoCidade(false);
    }
  }, [isOpen, cidade]);

  if (!isOpen) return null;

  const cidadeAtual = editandoCidade ? cidadeEditada : (cidade || '');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
      <div
        className="rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '2px solid #F59E0B',
          backdropFilter: 'blur(20px)',
          minWidth: 420,
          maxWidth: 520,
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: '#F59E0B30', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F59E0B20' }}>
              <AlertCircle className="w-6 h-6" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                COR DE ROTA NAO CADASTRADA
              </span>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Defina qual cor de rota esta cidade pertence
              </p>
            </div>
          </div>
          {(osNumero || clienteNome) && (
            <div className="flex items-center gap-3 mt-3 p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div>
                {osNumero && (
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-accent)' }}>
                    {osNumero}
                  </p>
                )}
                {clienteNome && (
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {clienteNome}
                  </p>
                )}
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs font-bold" style={{ color: '#FFBF00' }}>
                  {cidade || 'Sem cidade'}
                </p>
                {clienteBairro && (
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {clienteBairro}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* City edit section */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(255,191,0,0.15), rgba(245,158,11,0.08))' }}>
            {!editandoCidade ? (
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  A cidade
                </p>
                <p className="text-lg font-bold my-1" style={{ color: '#FFBF00' }}>
                  {cidade || 'SEM CIDADE'}
                </p>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  pertence a qual rota?
                </p>
                <button
                  onClick={() => {
                    setCidadeEditada(cidade || '');
                    setEditandoCidade(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    color: '#3B82F6'
                  }}
                >
                  <Pencil className="w-3 h-3" />
                  Alterar Nome da Cidade
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" style={{ color: '#3B82F6' }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3B82F6' }}>
                    Alterar Nome da Cidade
                  </span>
                </div>
                <input
                  type="text"
                  value={cidadeEditada}
                  onChange={(e) => setCidadeEditada(e.target.value)}
                  placeholder="Digite o nome correto da cidade"
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(59,130,246,0.5)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setEditandoCidade(false)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#EF4444'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const trimmed = cidadeEditada.trim();
                      if (onConfirmCity && trimmed) {
                        onConfirmCity(trimmed);
                      } else {
                        setEditandoCidade(false);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: '#10B981'
                    }}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" />
                      Confirmar
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs font-medium uppercase tracking-wider mb-3 text-center" style={{ color: 'var(--text-secondary)' }}>
            Selecione a cor da rota
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ROTAS_OPTIONS.map(rota => (
              <button
                key={rota.kanban}
                onClick={() => onSelectRoute(rota.kanban, cidadeEditada.trim() || cidade || '')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: rota.cor + '15',
                  border: `2px solid ${rota.border}40`,
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = rota.border;
                  e.currentTarget.style.boxShadow = `0 0 16px ${rota.cor}40`;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = rota.border + '40';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="w-8 h-8 rounded-full"
                  style={{
                    backgroundColor: rota.cor,
                    border: rota.cor === '#1a1a1a' ? '2px solid #555' : 'none',
                    boxShadow: `0 0 12px ${rota.cor}60`,
                  }}
                />
                <span className="text-[11px] font-semibold" style={{ color: rota.cor === '#1a1a1a' ? 'var(--text-primary)' : rota.cor }}>
                  {rota.label}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <p className="text-[10px] text-center" style={{ color: 'rgba(59,130,246,0.9)' }}>
              A cidade sera automaticamente cadastrada na rota selecionada. Nas proximas vezes, esta cidade ja tera sua rota definida.
            </p>
          </div>

          <button
            onClick={onCancel}
            className="w-full mt-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444',
            }}
          >
            Cancelar Movimentacao
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
