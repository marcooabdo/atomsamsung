import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Save, AlertCircle } from 'lucide-react';

interface PDFConfig {
  id: string;
  unidade_id: string | null;
  termo_orcamento: string;
  termo_garantia: string;
  canais_atendimento: string;
  observacoes_gerais: string;
  logo_url: string | null;
  rodape_personalizado: string | null;
}

export function ConfiguracoesPDFOS() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [config, setConfig] = useState<Partial<PDFConfig>>({
    termo_orcamento: '',
    termo_garantia: '',
    canais_atendimento: '',
    observacoes_gerais: '',
    logo_url: '',
    rodape_personalizado: ''
  });

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (selectedUnidade) {
      loadConfig();
    }
  }, [selectedUnidade]);

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');
    setUnidades(data || []);

    if (data && data.length > 0) {
      setSelectedUnidade(data[0].id);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracoes_pdf_os')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
      } else {
        const { data: globalConfig } = await supabase
          .from('configuracoes_pdf_os')
          .select('*')
          .is('unidade_id', null)
          .maybeSingle();

        if (globalConfig) {
          setConfig({ ...globalConfig, unidade_id: selectedUnidade });
        }
      }
    } catch (error) {
      alert('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        unidade_id: selectedUnidade,
        termo_orcamento: config.termo_orcamento,
        termo_garantia: config.termo_garantia,
        canais_atendimento: config.canais_atendimento,
        observacoes_gerais: config.observacoes_gerais,
        logo_url: config.logo_url || null,
        rodape_personalizado: config.rodape_personalizado || null,
        updated_at: new Date().toISOString()
      };

      if (config.id) {
        const { error } = await supabase
          .from('configuracoes_pdf_os')
          .update(dataToSave)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_pdf_os')
          .insert([dataToSave]);

        if (error) throw error;
      }

      alert('Configurações salvas com sucesso!');
      loadConfig();
    } catch (error: any) {
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
            border: '1px solid rgba(59,130,246,0.3)'
          }}>
            <FileText className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Configurações de PDF da OS</h3>
            <p className="text-sm text-gray-400">Configure os termos e textos padrão para o PDF da Ordem de Serviço</p>
          </div>
        </div>
      </div>

      <div className="premium-card p-4">
        <div className="mb-4">
          <label className="block text-sm font-bold text-white mb-2">
            Unidade
          </label>
          <select
            value={selectedUnidade}
            onChange={(e) => setSelectedUnidade(e.target.value)}
            className="neon-input"
          >
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg mb-4" style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.03) 100%)',
          border: '1px solid rgba(59,130,246,0.3)'
        }}>
          <AlertCircle className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300">
            Estas configurações serão usadas na geração do PDF da Ordem de Serviço.
            Os termos e textos podem ser personalizados por unidade.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Termos de Orçamento
            </label>
            <textarea
              value={config.termo_orcamento || ''}
              onChange={(e) => setConfig({ ...config, termo_orcamento: e.target.value })}
              className="neon-input min-h-[200px]"
              placeholder="Digite os termos de orçamento..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Termos de Garantia
            </label>
            <textarea
              value={config.termo_garantia || ''}
              onChange={(e) => setConfig({ ...config, termo_garantia: e.target.value })}
              className="neon-input min-h-[150px]"
              placeholder="Digite os termos de garantia..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Canais de Atendimento
            </label>
            <textarea
              value={config.canais_atendimento || ''}
              onChange={(e) => setConfig({ ...config, canais_atendimento: e.target.value })}
              className="neon-input min-h-[100px]"
              placeholder="Digite os canais de atendimento..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Observações Gerais
            </label>
            <textarea
              value={config.observacoes_gerais || ''}
              onChange={(e) => setConfig({ ...config, observacoes_gerais: e.target.value })}
              className="neon-input min-h-[100px]"
              placeholder="Digite observações gerais..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-2">
              URL do Logo (opcional)
            </label>
            <input
              type="text"
              value={config.logo_url || ''}
              onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
              className="neon-input"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-2">
              Rodapé Personalizado (opcional)
            </label>
            <textarea
              value={config.rodape_personalizado || ''}
              onChange={(e) => setConfig({ ...config, rodape_personalizado: e.target.value })}
              className="neon-input min-h-[80px]"
              placeholder="Digite o texto do rodapé personalizado..."
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)',
              border: '1px solid #3b82f6',
              color: '#3b82f6'
            }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
