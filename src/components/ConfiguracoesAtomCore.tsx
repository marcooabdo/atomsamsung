import { useState, useEffect } from 'react';
import { Globe, Key, MessageSquare, Webhook, Save, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AtomCoreSetting {
  id: string;
  chave: string;
  valor: string | null;
  descricao: string | null;
  categoria: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CategoryConfig {
  title: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgGradient: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  evolution: {
    title: 'Evolution API',
    icon: <Globe className="w-5 h-5" />,
    color: '#00D4FF',
    borderColor: 'border-[#00D4FF]/30',
    bgGradient: 'from-[#00D4FF]/10 to-transparent',
  },
  whatsapp: {
    title: 'WhatsApp',
    icon: <MessageSquare className="w-5 h-5" />,
    color: '#39FF14',
    borderColor: 'border-[#39FF14]/30',
    bgGradient: 'from-[#39FF14]/10 to-transparent',
  },
  webhook: {
    title: 'Webhooks',
    icon: <Webhook className="w-5 h-5" />,
    color: '#FFBF00',
    borderColor: 'border-[#FFBF00]/30',
    bgGradient: 'from-[#FFBF00]/10 to-transparent',
  },
};

const FIELD_ICONS: Record<string, React.ReactNode> = {
  evolution_api_url: <Globe className="w-4 h-4 text-[#00D4FF]" />,
  evolution_api_key: <Key className="w-4 h-4 text-[#00D4FF]" />,
  evolution_instance_name: <Globe className="w-4 h-4 text-[#00D4FF]" />,
  evolution_webhook_url: <Webhook className="w-4 h-4 text-[#00D4FF]" />,
  whatsapp_group_jid: <MessageSquare className="w-4 h-4 text-[#39FF14]" />,
  webhook_relay_url: <Webhook className="w-4 h-4 text-[#FFBF00]" />,
  erp_webhook_url: <Webhook className="w-4 h-4 text-[#FFBF00]" />,
  advisor_webhook_url: <Webhook className="w-4 h-4 text-[#FFBF00]" />,
  atom_samsung_webhook_url: <Webhook className="w-4 h-4 text-[#FFBF00]" />,
};

export function ConfiguracoesAtomCore() {
  const [settings, setSettings] = useState<AtomCoreSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('atom_core_settings')
        .select('*')
        .order('categoria')
        .order('chave');

      if (error) throw error;

      setSettings(data || []);
      // Initialize edited values with current values
      const values: Record<string, string> = {};
      (data || []).forEach((s) => {
        values[s.chave] = s.valor || '';
      });
      setEditedValues(values);
    } catch (err: any) {
      console.error('Erro ao carregar configurações:', err);
      setToast({ message: 'Erro ao carregar configurações', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(chave: string, value: string) {
    setEditedValues((prev) => ({ ...prev, [chave]: value }));
  }

  function hasChangesInCategory(categoria: string): boolean {
    return settings
      .filter((s) => s.categoria === categoria)
      .some((s) => (editedValues[s.chave] ?? '') !== (s.valor || ''));
  }

  async function saveCategory(categoria: string) {
    setSaving(categoria);
    try {
      const categorySettings = settings.filter((s) => s.categoria === categoria);
      const updates = categorySettings
        .filter((s) => (editedValues[s.chave] ?? '') !== (s.valor || ''))
        .map((s) => ({
          chave: s.chave,
          valor: editedValues[s.chave] || '',
        }));

      if (updates.length === 0) {
        setToast({ message: 'Nenhuma alteração para salvar', type: 'success' });
        setSaving(null);
        return;
      }

      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('atom_core_settings')
          .update({ valor: update.valor, updated_at: new Date().toISOString() })
          .eq('chave', update.chave);

        if (error) throw error;
      }

      // Refresh settings after save
      const { data } = await (supabase as any)
        .from('atom_core_settings')
        .select('*')
        .order('categoria')
        .order('chave');

      if (data) {
        setSettings(data);
        const values: Record<string, string> = {};
        data.forEach((s) => {
          values[s.chave] = s.valor || '';
        });
        setEditedValues(values);
      }

      setToast({ message: `Configurações de ${CATEGORY_CONFIG[categoria]?.title || categoria} salvas com sucesso!`, type: 'success' });
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
    } finally {
      setSaving(null);
    }
  }

  // Group settings by category
  const grouped = settings.reduce<Record<string, AtomCoreSetting[]>>((acc, setting) => {
    const cat = setting.categoria || 'outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(setting);
    return acc;
  }, {});

  // Order categories
  const categoryOrder = ['evolution', 'whatsapp', 'webhook'];
  const sortedCategories = categoryOrder.filter((cat) => grouped[cat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#00D4FF]" />
          <p className="text-gray-400 text-sm">Carregando configurações Atom Core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="tech-heading text-2xl text-[#00D4FF] flex items-center gap-3">
            <Globe className="w-7 h-7" />
            Configurações Atom Core
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie URLs, chaves de API e configurações de integração
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-[#00D4FF]/50 text-gray-300 hover:text-[#00D4FF] transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Recarregar
        </button>
      </div>

      {/* Settings Sections */}
      {sortedCategories.map((categoria) => {
        const config = CATEGORY_CONFIG[categoria] || {
          title: categoria,
          icon: <Globe className="w-5 h-5" />,
          color: '#00D4FF',
          borderColor: 'border-gray-700',
          bgGradient: 'from-gray-800/50 to-transparent',
        };
        const categorySettings = grouped[categoria];
        const hasChanges = hasChangesInCategory(categoria);
        const isSaving = saving === categoria;

        return (
          <div
            key={categoria}
            className={`premium-card p-6 bg-gradient-to-br ${config.bgGradient} border-2 ${config.borderColor} transition-all`}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <span style={{ color: config.color }}>{config.icon}</span>
                </div>
                <h3
                  className="tech-heading text-lg"
                  style={{ color: config.color }}
                >
                  {config.title}
                </h3>
              </div>
              <button
                onClick={() => saveCategory(categoria)}
                disabled={!hasChanges || isSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  hasChanges
                    ? 'bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] hover:bg-[#00D4FF]/30 hover:shadow-lg hover:shadow-[#00D4FF]/20'
                    : 'bg-gray-800/30 border border-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              {categorySettings.map((setting) => (
                <div key={setting.chave} className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    {FIELD_ICONS[setting.chave] || <Globe className="w-4 h-4 text-gray-500" />}
                    <span className="font-mono text-xs bg-gray-800/80 px-2 py-0.5 rounded">
                      {setting.chave}
                    </span>
                  </label>
                  {setting.descricao && (
                    <p className="text-xs text-gray-500 ml-6">{setting.descricao}</p>
                  )}
                  <div className="relative ml-6">
                    <input
                      type={setting.chave.includes('key') || setting.chave.includes('token') ? 'password' : 'text'}
                      value={editedValues[setting.chave] ?? ''}
                      onChange={(e) => handleChange(setting.chave, e.target.value)}
                      placeholder={`Insira ${setting.descricao || setting.chave}`}
                      className="neon-input w-full font-mono text-sm"
                    />
                    {(editedValues[setting.chave] ?? '') !== (setting.valor || '') && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <span className="text-xs text-[#FFBF00] bg-[#FFBF00]/10 px-2 py-0.5 rounded-full">
                          modificado
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-sm transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
              : 'bg-[#FF0064]/10 border-[#FF0064]/40 text-[#FF0064]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
