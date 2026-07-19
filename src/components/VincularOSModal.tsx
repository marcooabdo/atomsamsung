import { useState, useEffect } from 'react';
import { X, Search, Link2, Unlink, Layers, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VincularOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOS: any;
  onVinculado: () => void;
}

export function VincularOSModal({ isOpen, onClose, currentOS, onVinculado }: VincularOSModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedOS, setLinkedOS] = useState<any[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentOS) {
      loadLinkedOS();
    }
    return () => {
      setSearchTerm('');
      setResults([]);
    };
  }, [isOpen, currentOS?.id]);

  const loadLinkedOS = async () => {
    if (!currentOS) return;
    setLoadingLinked(true);
    try {
      if (currentOS.grupo_os_id) {
        const { data } = await supabase
          .from('os')
          .select('id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, created_at, aparelho_modelo')
          .eq('grupo_os_id', currentOS.grupo_os_id)
          .neq('id', currentOS.id)
          .order('created_at', { ascending: false });
        setLinkedOS(data || []);
      } else {
        setLinkedOS([]);
      }
    } finally {
      setLoadingLinked(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) return;
    setLoading(true);
    try {
      const term = searchTerm.trim();
      let query = supabase
        .from('os')
        .select('id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, created_at, aparelho_modelo, grupo_os_id, unidade_id')
        .neq('id', currentOS.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (currentOS.unidade_id) {
        query = query.eq('unidade_id', currentOS.unidade_id);
      }

      const { data } = await query.or(
        `numero_os_samsung.ilike.%${term}%,numero_os_interna.ilike.%${term}%,cliente_nome.ilike.%${term}%,aparelho_imei.ilike.%${term}%,aparelho_numero_serie.ilike.%${term}%`
      );

      const filtered = (data || []).filter(os => {
        if (currentOS.grupo_os_id && os.grupo_os_id === currentOS.grupo_os_id) return false;
        return true;
      });
      setResults(filtered);
    } finally {
      setLoading(false);
    }
  };

  const vincularOS = async (targetOS: any) => {
    setActionLoading(targetOS.id);
    try {
      let grupoId = currentOS.grupo_os_id;

      if (!grupoId && !targetOS.grupo_os_id) {
        const { data: novoGrupo, error: errGrupo } = await supabase
          .from('os_grupos')
          .insert({ unidade_id: currentOS.unidade_id })
          .select('id')
          .single();
        if (errGrupo || !novoGrupo) throw errGrupo;
        grupoId = novoGrupo.id;

        await supabase.from('os').update({ grupo_os_id: grupoId }).eq('id', currentOS.id);
      } else if (!grupoId && targetOS.grupo_os_id) {
        grupoId = targetOS.grupo_os_id;
        await supabase.from('os').update({ grupo_os_id: grupoId }).eq('id', currentOS.id);
      } else if (grupoId && targetOS.grupo_os_id && targetOS.grupo_os_id !== grupoId) {
        await supabase.from('os').update({ grupo_os_id: grupoId }).eq('grupo_os_id', targetOS.grupo_os_id);
        await supabase.from('os_grupos').delete().eq('id', targetOS.grupo_os_id);
      }

      if (grupoId && !targetOS.grupo_os_id) {
        await supabase.from('os').update({ grupo_os_id: grupoId }).eq('id', targetOS.id);
      }

      setResults(prev => prev.filter(os => os.id !== targetOS.id));
      await loadLinkedOS();
      onVinculado();
    } finally {
      setActionLoading(null);
    }
  };

  const desvincularOS = async (targetOS: any) => {
    setActionLoading(targetOS.id);
    try {
      await supabase.from('os').update({ grupo_os_id: null }).eq('id', targetOS.id);

      if (currentOS.grupo_os_id) {
        const { data: remaining } = await supabase
          .from('os')
          .select('id')
          .eq('grupo_os_id', currentOS.grupo_os_id);

        if (remaining && remaining.length <= 1) {
          await supabase.from('os').update({ grupo_os_id: null }).eq('grupo_os_id', currentOS.grupo_os_id);
          await supabase.from('os_grupos').delete().eq('id', currentOS.grupo_os_id);
        }
      }

      await loadLinkedOS();
      onVinculado();
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1a1a2e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">Vincular OS</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Current OS info */}
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-xs text-gray-400 mb-0.5">OS Atual</p>
            <p className="text-sm font-bold text-white">
              {currentOS.numero_os_samsung || currentOS.numero_os_interna || 'S/N'}
              <span className="text-gray-400 font-normal ml-2">{currentOS.cliente_nome}</span>
            </p>
          </div>

          {/* Linked OS list */}
          {loadingLinked ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : linkedOS.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">OS Vinculadas ({linkedOS.length})</p>
              {linkedOS.map(os => (
                <div key={os.id} className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">
                      {os.numero_os_samsung || os.numero_os_interna || 'S/N'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {os.cliente_nome} {os.aparelho_modelo ? `- ${os.aparelho_modelo}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => desvincularOS(os)}
                    disabled={actionLoading === os.id}
                    className="ml-2 p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    title="Desvincular"
                  >
                    {actionLoading === os.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Buscar OS para vincular</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="N.OS Samsung, interna, cliente, IMEI..."
                  className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || searchTerm.trim().length < 2}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">{results.length} resultado(s)</p>
              {results.map(os => (
                <div key={os.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/70 border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">
                      {os.numero_os_samsung || os.numero_os_interna || 'S/N'}
                      {os.grupo_os_id && (
                        <span className="ml-1.5 text-[9px] text-blue-400 font-normal">(em grupo)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {os.cliente_nome} {os.aparelho_modelo ? `- ${os.aparelho_modelo}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => vincularOS(os)}
                    disabled={actionLoading === os.id}
                    className="ml-2 p-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                    title="Vincular"
                  >
                    {actionLoading === os.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && searchTerm && !loading && (
            <p className="text-center text-xs text-gray-500 py-3">Nenhuma OS encontrada</p>
          )}
        </div>
      </div>
    </div>
  );
}
