import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { OSModal } from '../components/OSModal';
import { Archive, Search, RotateCcw, Loader2, FileX, ChevronLeft, ChevronRight } from 'lucide-react';

type OS = {
  id: string;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string | null;
  aparelho_modelo: string | null;
  tipo_os: string | null;
  tipo_atendimento: string | null;
  coluna_kanban: string | null;
  created_at: string;
  updated_at: string;
  unidade_id: string | null;
  unidade?: { nome: string } | null;
  tecnico_designado?: { nome: string } | null;
};

const PAGE_SIZE = 50;

export function OSArquivadas() {
  const { usuario, allUserUnits } = useAuth();
  const [os, setOs] = useState<OS[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;

  useEffect(() => {
    supabase.from('unidades').select('id, nome').order('nome').then(({ data }) => {
      setUnidades(data || []);
    });
  }, []);

  const loadArquivadas = useCallback(async (currentPage = 0) => {
    setLoading(true);
    try {
      let query = supabase
        .from('os')
        .select(`
          id,
          numero_os_samsung,
          numero_os_interna,
          cliente_nome,
          aparelho_modelo,
          tipo_os,
          tipo_atendimento,
          coluna_kanban,
          created_at,
          updated_at,
          unidade_id,
          unidade:unidades!os_unidade_id_fkey(nome),
          tecnico_designado:usuarios!os_tecnico_designado_id_fkey(nome)
        `, { count: 'exact' })
        .eq('arquivada', true);

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      } else if (!canSeeAllUnits) {
        if (allUserUnits.length > 1) {
          query = query.in('unidade_id', allUserUnits);
        } else if (usuario?.unidade_id) {
          query = query.eq('unidade_id', usuario.unidade_id);
        }
      }

      if (searchTerm.trim()) {
        query = query.or(
          `numero_os_samsung.ilike.%${searchTerm.trim()}%,numero_os_interna.ilike.%${searchTerm.trim()}%,cliente_nome.ilike.%${searchTerm.trim()}%,aparelho_modelo.ilike.%${searchTerm.trim()}%`
        );
      }

      const from = currentPage * PAGE_SIZE;
      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      setOs((data as OS[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Erro ao carregar OS arquivadas:', e);
    } finally {
      setLoading(false);
    }
  }, [canSeeAllUnits, selectedUnidade, searchTerm, usuario?.unidade_id, allUserUnits]);

  useEffect(() => {
    setPage(0);
    loadArquivadas(0);
  }, [loadArquivadas]);

  useEffect(() => {
    if (page > 0) {
      loadArquivadas(page);
    }
  }, [page, loadArquivadas]);

  async function handleRestaurar(osId: string) {
    setRestaurando(osId);
    try {
      const { error } = await supabase
        .from('os')
        .update({ arquivada: false, updated_at: new Date().toISOString() })
        .eq('id', osId);
      if (!error) {
        setOs(prev => prev.filter(o => o.id !== osId));
        setTotal(prev => prev - 1);
      }
    } finally {
      setRestaurando(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedOS = os.find(o => o.id === selectedOSId) || null;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)' }}
          >
            <Archive className="w-6 h-6 text-[#00D4FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              OS Arquivadas
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {total} ordem{total !== 1 ? 's' : ''} arquivada{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(canSeeAllUnits || allUserUnits.length > 1) && (
            <UnitFilter
              unidades={canSeeAllUnits ? unidades : unidades.filter(u => allUserUnits.includes(u.id))}
              selectedUnidade={selectedUnidade}
              onUnidadeChange={setSelectedUnidade}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="relative flex-1 max-w-md"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12 }}
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Buscar por OS, cliente ou aparelho..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent pl-9 pr-4 py-2.5 text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Carregando OS arquivadas...</span>
          </div>
        ) : os.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="p-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <FileX className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {searchTerm ? 'Nenhuma OS encontrada' : 'Nenhuma OS arquivada'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {searchTerm ? 'Tente outro termo de busca.' : 'As OS arquivadas aparecem aqui após o fechamento.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.02)' }}>
                    {['OS', 'Cliente', 'Aparelho', 'Tipo', 'Atendimento', 'Unidade', 'Técnico', 'Arquivada em', 'Ações'].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {os.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: idx < os.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setSelectedOSId(item.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-black" style={{ color: 'var(--text-accent)' }}>
                          {item.numero_os_samsung || item.numero_os_interna || 'S/N'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.cliente_nome || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {item.aparelho_modelo || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                          {item.tipo_os || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {item.tipo_atendimento || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {(item.unidade as any)?.nome || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {(item.tecnico_designado as any)?.nome || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(item.updated_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleRestaurar(item.id)}
                          disabled={restaurando === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          style={{
                            background: 'rgba(0,212,255,0.1)',
                            border: '1px solid rgba(0,212,255,0.2)',
                            color: '#00D4FF',
                          }}
                          title="Restaurar ao pipeline"
                        >
                          {restaurando === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.02)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Página {page + 1} de {totalPages} &bull; {total} registros
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                    style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                    style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedOSId && (
        <OSModal
          osId={selectedOSId}
          onClose={() => setSelectedOSId(null)}
          onReload={() => loadArquivadas(page)}
        />
      )}
    </div>
  );
}
