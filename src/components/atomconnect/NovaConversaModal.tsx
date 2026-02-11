import { useState, useEffect, useRef } from 'react';
import {
  X, Search, Phone, User, FileText, Link2, MessageSquare, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

interface OS {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  defeito_reclamado: string | null;
  status_kanban: string | null;
}

interface Props {
  accentColor: string;
  onClose: () => void;
  onConversaCriada: (conversaId: string) => void;
}

export function NovaConversaModal({ accentColor, onClose, onConversaCriada }: Props) {
  const { usuario, unidadeAtual } = useAuth();
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [osSearch, setOsSearch] = useState('');
  const [osResults, setOsResults] = useState<OS[]>([]);
  const [selectedOS, setSelectedOS] = useState<OS | null>(null);
  const [searchingOS, setSearchingOS] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!osSearch || osSearch.length < 2) {
      setOsResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchOS(osSearch), 300);
  }, [osSearch]);

  const searchOS = async (term: string) => {
    if (!unidadeAtual) return;
    setSearchingOS(true);

    const { data } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban')
      .eq('unidade_id', unidadeAtual)
      .or(`numero_os_interna.ilike.%${term}%,numero_os_samsung.ilike.%${term}%,cliente_nome.ilike.%${term}%,cliente_telefone.ilike.%${term}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    setOsResults(data || []);
    setSearchingOS(false);
  };

  const selectOS = (os: OS) => {
    setSelectedOS(os);
    if (os.cliente_telefone) setTelefone(os.cliente_telefone.replace(/\D/g, ''));
    if (os.cliente_nome) setNome(os.cliente_nome);
    setOsSearch('');
    setOsResults([]);
  };

  const handleCreate = async () => {
    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Informe um telefone valido');
      return;
    }
    if (!unidadeAtual) return;

    setCreating(true);

    const { data: existing } = await supabase
      .from('atom_connect_conversas')
      .select('id')
      .eq('cliente_telefone', cleanPhone)
      .eq('unidade_id', unidadeAtual)
      .maybeSingle();

    if (existing) {
      onConversaCriada(existing.id);
      return;
    }

    const { data: firstColumn } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('id')
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: newConversa, error } = await supabase
      .from('atom_connect_conversas')
      .insert({
        unidade_id: unidadeAtual,
        cliente_telefone: cleanPhone,
        cliente_nome: nome || null,
        os_id: selectedOS?.id || null,
        coluna_pipeline: firstColumn?.id || null,
        atendente_id: usuario?.id,
        is_bot_ativo: false,
        tipo_atendimento: 'whatsapp',
        prioridade: 'normal',
        ultima_mensagem_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !newConversa) {
      alert('Erro ao criar conversa');
      setCreating(false);
      return;
    }

    onConversaCriada(newConversa.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#12122a] rounded-xl w-full max-w-lg border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Nova Conversa</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Telefone *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="5511999999999"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome do Cliente</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Vincular a OS (opcional)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={osSearch}
                onChange={(e) => setOsSearch(e.target.value)}
                placeholder="Buscar por numero OS, cliente, telefone..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/40"
              />
              {searchingOS && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
              )}
            </div>

            {osResults.length > 0 && (
              <div className="mt-1.5 max-h-48 overflow-y-auto bg-[#0d0d1e] rounded-lg border border-white/10">
                {osResults.map(os => (
                  <button
                    key={os.id}
                    onClick={() => selectOS(os)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left"
                  >
                    <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">
                          #{os.numero_os_interna}
                        </span>
                        {os.numero_os_samsung && (
                          <span className="text-xs text-gray-500">Samsung: {os.numero_os_samsung}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{os.cliente_nome} - {os.cliente_telefone}</p>
                      <p className="text-xs text-gray-500 truncate">{os.defeito_reclamado}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedOS && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <Link2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-cyan-400">
                    OS #{selectedOS.numero_os_interna}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{selectedOS.cliente_nome}</span>
                </div>
                <button
                  onClick={() => setSelectedOS(null)}
                  className="p-0.5 hover:bg-white/10 rounded"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !telefone.replace(/\D/g, '')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: accentColor, color: '#000' }}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            Iniciar Conversa
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
