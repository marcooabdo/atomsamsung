import { useState, useEffect } from 'react';
import { X, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useModal } from '../contexts/ModalContext';

interface IniciarReparoModalProps {
  osId: string;
  osNumero: string;
  unidadeId: string;
  currentTecnicoId: string | null;
  currentTecnicoNome: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function IniciarReparoModal({
  osId,
  osNumero,
  unidadeId,
  currentTecnicoId,
  currentTecnicoNome,
  onClose,
  onSuccess
}: IniciarReparoModalProps) {
  const { showAlert } = useModal();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState<string>('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    setCurrentUser(userData);

    const { data: usuariosData } = await supabase
      .from('usuarios')
      .select('id, nome, numero_tecnico')
      .eq('tipo', 'tecnico')
      .eq('ativo', true)
      .eq('unidade_id', unidadeId)
      .order('nome');

    setUsuarios(usuariosData || []);
  };

  const handleIniciarReparo = async () => {
    if (!selectedTecnicoId) {
      showAlert({ message: 'Por favor, selecione um técnico', type: 'warning' });
      return;
    }

    if (!currentUser) return;

    setLoading(true);
    try {
      const tecnicoSelecionado = usuarios.find(u => u.id === selectedTecnicoId);

      // Buscar o tipo de atendimento da OS para saber se move para diagnóstico
      const { data: osData } = await supabase
        .from('os')
        .select('tipo_atendimento')
        .eq('id', osId)
        .maybeSingle();

      const tipoAtendimento = osData?.tipo_atendimento;
      const shouldMoveTodiagnostico = tipoAtendimento === 'CI' || tipoAtendimento === 'IH';

      // Atualiza a OS com o técnico designado e move para diagnóstico se aplicável
      const updateData: any = {
        tecnico_designado_id: selectedTecnicoId,
        tecnico_designado_em: new Date().toISOString()
      };

      if (shouldMoveTodiagnostico) {
        updateData.coluna_kanban = 'diagnostico';
      }

      const { error: updateError } = await supabase
        .from('os')
        .update(updateData)
        .eq('id', osId);

      if (updateError) throw updateError;

      // Registra no log de comentários
      const { error: commentError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: currentUser.id,
          comentario: `🔧 **REPARO INICIADO**\n\nTécnico **${tecnicoSelecionado?.nome}** foi designado para esta ordem de serviço.${shouldMoveTodiagnostico ? '\n\n📋 **Status:** Movido para DIAGNÓSTICO' : ''}\n\n*Iniciado por ${currentUser.nome}*`,
          is_system: true
        });

      if (commentError) throw commentError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao iniciar reparo:', error);
      showAlert({ message: 'Erro ao iniciar reparo. Tente novamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarTecnico = async () => {
    if (!selectedTecnicoId || !motivo.trim()) {
      showAlert({ message: 'Selecione um técnico e informe o motivo da alteração', type: 'warning' });
      return;
    }

    if (!currentUser) return;

    setLoading(true);
    try {
      const novoTecnico = usuarios.find(u => u.id === selectedTecnicoId);

      // Atualiza a OS com o novo técnico (não move para diagnóstico na alteração)
      const { error: updateError } = await supabase
        .from('os')
        .update({
          tecnico_designado_id: selectedTecnicoId,
          tecnico_designado_em: new Date().toISOString()
        })
        .eq('id', osId);

      if (updateError) throw updateError;

      // Registra no log de comentários
      const { error: commentError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: currentUser.id,
          comentario: `🔄 **TÉCNICO ALTERADO**\n\n**De:** ${currentTecnicoNome}\n**Para:** ${novoTecnico?.nome}\n\n**Motivo:** ${motivo}\n\n*Alterado por ${currentUser.nome}*`,
          is_system: true
        });

      if (commentError) throw commentError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao alterar técnico:', error);
      showAlert({ message: 'Erro ao alterar técnico. Tente novamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isAlteracao = currentTecnicoId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.3)', boxShadow: 'var(--card-shadow)' }}>
        <div className="sticky top-0 p-4 flex items-center justify-between z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' }}>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <User className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
              {isAlteracao ? 'Alterar Técnico' : 'Iniciar Reparo'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>OS: {osNumero}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!isAlteracao ? (
            <>
              <div className="rounded-lg p-4 space-y-3" style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.1) 0%, rgba(var(--accent-rgb),0.03) 100%)',
                border: '1px solid rgba(var(--accent-rgb),0.3)'
              }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Iniciar Reparo</p>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Selecione o técnico que será responsável por esta ordem de serviço.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Técnico Responsável *
                </label>
                <select
                  value={selectedTecnicoId}
                  onChange={(e) => setSelectedTecnicoId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selecione um técnico...</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}{usuario.numero_tecnico ? ` (Nº ${usuario.numero_tecnico})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleIniciarReparo}
                disabled={loading || !selectedTecnicoId}
                className="w-full py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                  border: '1px solid var(--text-accent)',
                  color: 'var(--text-accent)',
                  boxShadow: '0 0 20px rgba(var(--accent-rgb),0.3)'
                }}
              >
                <CheckCircle className="w-5 h-5" />
                {loading ? 'INICIANDO...' : 'INICIAR REPARO'}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg p-4 space-y-2" style={{
                background: 'linear-gradient(135deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.03) 100%)',
                border: '1px solid rgba(255,191,0,0.3)'
              }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Técnico Atual:</p>
                <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>{currentTecnicoNome}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Novo Técnico *
                </label>
                <select
                  value={selectedTecnicoId}
                  onChange={(e) => setSelectedTecnicoId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selecione um técnico...</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}{usuario.numero_tecnico ? ` (Nº ${usuario.numero_tecnico})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Motivo da Alteração *
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explique o motivo da alteração do técnico..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors resize-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
                />
              </div>

              <button
                onClick={handleAlterarTecnico}
                disabled={loading || !selectedTecnicoId || !motivo.trim()}
                className="w-full py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,191,0,0.2) 0%, rgba(255,191,0,0.05) 100%)',
                  border: '1px solid #FFBF00',
                  color: '#FFBF00',
                  boxShadow: '0 0 20px rgba(255,191,0,0.3)'
                }}
              >
                <CheckCircle className="w-5 h-5" />
                {loading ? 'ALTERANDO...' : 'CONFIRMAR ALTERAÇÃO'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
