import { useState, useEffect } from 'react';
import {
  Search, Filter, ChevronDown, Users, Phone, Mail, MapPin,
  CheckCircle, Clock, Award, ShoppingCart, Package, ChevronRight,
  FileText, Hash, Wrench, Eye, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClienteCI, VendedorCI, OSRecord, GLASS, GLASS_INNER,
  KANBAN_LABELS, KANBAN_COLORS, CI_FILTER_COLORS,
  formatCurrency, formatDate, getValorCliente
} from './types';

interface Props {
  clientes: ClienteCI[];
  vendedores: VendedorCI[];
  isGerente: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  selectedVendedorFilter: string | null;
  onVendedorFilterChange: (v: string | null) => void;
}

export default function CICarteiraTab({
  clientes, vendedores, isGerente, searchTerm, onSearchChange,
  selectedVendedorFilter, onVendedorFilterChange
}: Props) {
  const [selectedCliente, setSelectedCliente] = useState<ClienteCI | null>(null);
  const [expandedOS, setExpandedOS] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCliente && !clientes.find(c => c.id === selectedCliente.id)) {
      setSelectedCliente(null);
      setExpandedOS(null);
    }
  }, [clientes, selectedCliente]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar cliente por nome, documento ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex items-center gap-3">
          {vendedores.length > 0 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
              <select
                value={selectedVendedorFilter || ''}
                onChange={(e) => onVendedorFilterChange(e.target.value || null)}
                className="pl-10 pr-8 py-2.5 rounded-xl text-sm focus:outline-none appearance-none cursor-pointer min-w-[180px]"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Todos Vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>
          )}
          <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`${GLASS} p-4 lg:col-span-4 max-h-[720px] overflow-y-auto ci-scrollbar`}>
          <h3
            className="text-base font-semibold mb-3 sticky top-0 backdrop-blur-sm py-2 -mt-2 -mx-2 px-3 z-10"
            style={{ color: 'var(--text-primary)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' }}
          >
            {isGerente ? 'Todos os Clientes' : 'Meus Clientes'}
          </h3>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {clientes.map((cliente, idx) => (
                <motion.div
                  key={cliente.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  onClick={() => { setSelectedCliente(cliente); setExpandedOS(null); }}
                  className="p-3.5 rounded-xl cursor-pointer transition-all duration-200"
                  style={
                    selectedCliente?.id === cliente.id
                      ? { background: 'linear-gradient(to right, rgba(6,182,212,0.15), rgba(59,130,246,0.15))', border: '1px solid rgba(6,182,212,0.4)', boxShadow: '0 4px 15px rgba(6,182,212,0.1)' }
                      : { background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cliente.nome}</h4>
                      </div>
                      <p className="text-xs mt-1 ml-8" style={{ color: 'var(--text-secondary)' }}>{cliente.documento || 'Sem documento'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-cyan-400 font-semibold text-sm">{formatCurrency(getValorCliente(cliente))}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{cliente.totalOS} OS</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 ml-8">
                    <div className="flex items-center gap-1.5">
                      {cliente.tiposOS.map(tipo => (
                        <span key={tipo} className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CI_FILTER_COLORS[tipo] || 'text-slate-400 bg-slate-500/20 border-slate-500/30'}`}>
                          {tipo}
                        </span>
                      ))}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        cliente.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      }`}>
                        {cliente.status}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${selectedCliente?.id === cliente.id ? 'rotate-90' : ''}`}
                      style={{ color: selectedCliente?.id === cliente.id ? '#06B6D4' : 'var(--text-secondary)' }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {clientes.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhum cliente encontrado</p>
                <p className="text-xs mt-1 opacity-60">Altere os filtros para ver resultados</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedCliente ? (
              <motion.div
                key={selectedCliente.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className={`${GLASS} p-5`}>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedCliente.nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedCliente.documento}</span>
                        <div className="flex gap-1">
                          {selectedCliente.tiposOS.map(tipo => (
                            <span key={tipo} className={`px-2 py-0.5 rounded text-xs font-medium border ${CI_FILTER_COLORS[tipo] || 'text-slate-400 bg-slate-500/20 border-slate-500/30'}`}>
                              {tipo}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCliente(null)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    {selectedCliente.telefone && (
                      <div className={`${GLASS_INNER} p-3 flex items-center gap-3`}>
                        <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedCliente.telefone}</span>
                      </div>
                    )}
                    {selectedCliente.email && (
                      <div className={`${GLASS_INNER} p-3 flex items-center gap-3`}>
                        <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{selectedCliente.email}</span>
                      </div>
                    )}
                    {selectedCliente.endereco && (
                      <div className={`${GLASS_INNER} p-3 flex items-start gap-3 sm:col-span-2`}>
                        <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {selectedCliente.endereco}
                          {selectedCliente.cidade && ` - ${selectedCliente.cidade}/${selectedCliente.estado}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBlock label="Faturado" value={formatCurrency(getValorCliente(selectedCliente))} color="text-cyan-400" />
                    <StatBlock label="Ticket Medio" value={formatCurrency(selectedCliente.ticketMedio)} color="text-blue-400" />
                    <StatBlock label="Total OS" value={String(selectedCliente.totalOS)} />
                    <StatBlock
                      label="Status"
                      value={selectedCliente.status === 'ativo' ? 'Concluido' : 'Em Andamento'}
                      color={selectedCliente.status === 'ativo' ? 'text-emerald-400' : 'text-amber-400'}
                      icon={selectedCliente.status === 'ativo' ? CheckCircle : Clock}
                    />
                  </div>

                  {selectedCliente.vendedorId && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs text-emerald-400/70">Vendedor Responsavel</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedCliente.vendedorNome}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${GLASS} p-5`}>
                  <h4 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Ordens de Servico ({selectedCliente.osRecords.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedCliente.osRecords
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map(os => (
                        <div key={os.id} className="rounded-xl overflow-hidden transition-all duration-200" style={{ border: '1px solid var(--border-primary)' }}>
                          <button
                            onClick={() => setExpandedOS(expandedOS === os.id ? null : os.id)}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors"
                            style={{ background: 'var(--bg-secondary)' }}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="font-mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{os.numero_os_interna}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${CI_FILTER_COLORS[os.categoria] || 'text-slate-400 bg-slate-500/20 border-slate-500/30'}`}>
                                {os.categoria}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${KANBAN_COLORS[os.coluna_kanban] || 'text-slate-400 bg-slate-500/20 border-slate-500/30'}`}>
                                {KANBAN_LABELS[os.coluna_kanban] || os.coluna_kanban}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className="text-sm font-medium text-cyan-400">{formatCurrency(os.valor_pago > 0 ? os.valor_pago : os.valor_total)}</span>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(os.created_at)}</span>
                              <ChevronDown className={`w-4 h-4 transition-transform ${expandedOS === os.id ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                          </button>

                          <AnimatePresence>
                            {expandedOS === os.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 space-y-4" style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <MiniStat label="Valor Total" value={formatCurrency(os.valor_total)} />
                                    <MiniStat label="Valor Pago" value={formatCurrency(os.valor_pago)} highlight />
                                    <MiniStat label="Servicos" value={formatCurrency(os.valor_servicos)} />
                                    <MiniStat label="Pecas" value={formatCurrency(os.valor_pecas)} />
                                    <MiniStat label="Aprovado em" value={formatDate(os.orcamento_aprovado_em)} />
                                    <MiniStat label="Fechada em" value={formatDate(os.fechada_em)} />
                                  </div>

                                  {os.aparelho_modelo && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Wrench className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                                      <span style={{ color: 'var(--text-secondary)' }}>Modelo:</span>
                                      <span style={{ color: 'var(--text-primary)' }}>{os.aparelho_modelo}</span>
                                    </div>
                                  )}

                                  {os.defeito_relatado && (
                                    <div className="text-sm">
                                      <span style={{ color: 'var(--text-secondary)' }}>Defeito: </span>
                                      <span style={{ color: 'var(--text-primary)' }}>{os.defeito_relatado}</span>
                                    </div>
                                  )}

                                  {os.numero_os_samsung && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span style={{ color: 'var(--text-secondary)' }}>OS Samsung:</span>
                                      <span className="text-amber-400 font-mono">{os.numero_os_samsung}</span>
                                    </div>
                                  )}

                                  {os.pecas.length > 0 && (
                                    <div>
                                      <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        <Package className="w-3 h-3" /> Pecas ({os.pecas.length})
                                      </p>
                                      <div className="space-y-1.5">
                                        {os.pecas.map((peca, idx) => (
                                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <span className="truncate" style={{ color: 'var(--text-primary)' }}>{peca.descricao}</span>
                                              {peca.pn && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{peca.pn}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                              <span style={{ color: 'var(--text-secondary)' }}>{peca.quantidade}x</span>
                                              <span className="text-cyan-400 font-medium">{formatCurrency(peca.valor_total)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {os.vendedorId && (
                                    <div className="flex items-center gap-2 text-sm pt-1" style={{ borderTop: '1px solid var(--border-primary)' }}>
                                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                      <span style={{ color: 'var(--text-secondary)' }}>Vendedor:</span>
                                      <span style={{ color: 'var(--text-primary)' }}>{os.vendedorNome}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                  </div>
                </div>

                {selectedCliente.pecas.length > 0 && (
                  <div className={`${GLASS} p-5`}>
                    <h4 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Pecas Mais Utilizadas
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedCliente.pecas.map((peca, idx) => (
                        <div key={idx} className={`${GLASS_INNER} p-3 flex items-center justify-between`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-bold flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{peca.descricao}</p>
                              {peca.pn && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{peca.pn}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-sm text-cyan-400 font-medium">{peca.quantidade}x</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(peca.valorMedio)}/un</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`${GLASS} p-12 flex flex-col items-center justify-center min-h-[500px]`}
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
                  <Users className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Selecione um Cliente</h3>
                <p className="text-center max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Clique em um cliente na lista para ver as ordens de servico aprovadas e detalhes completos.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: any }) {
  return (
    <div className={`${GLASS_INNER} p-3`}>
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color || ''}`} />}
        <p className={`text-sm font-bold ${color || ''}`} style={!color ? { color: 'var(--text-primary)' } : {}}>{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-emerald-400' : ''}`} style={!highlight ? { color: 'var(--text-primary)' } : {}}>{value}</p>
    </div>
  );
}
