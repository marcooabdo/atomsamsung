import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type OtimizadorTab =
  | 'dashboard'
  | 'agenda'
  | 'mapa'
  | 'motor'
  | 'equipe'
  | 'checklists'
  | 'pecas'
  | 'analytics'
  | 'config';

interface Unidade {
  id: string;
  nome: string;
}

interface OtimizadorContextData {
  activeTab: OtimizadorTab;
  setActiveTab: (tab: OtimizadorTab) => void;
  selectedUnidade: string | null;
  setSelectedUnidade: (unidade: string | null) => void;
  refreshKey: number;
  refresh: () => void;
  loading: boolean;
  osData: any[];
  agendamentosData: any[];
  tecnicosData: any[];
  unidades: Unidade[];
  loadOSData: () => Promise<void>;
  loadAgendamentosData: () => Promise<void>;
  loadTecnicosData: () => Promise<void>;
}

const OtimizadorContext = createContext<OtimizadorContextData>({} as OtimizadorContextData);

export function OtimizadorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<OtimizadorTab>('dashboard');
  const [selectedUnidade, setSelectedUnidade] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [osData, setOsData] = useState<any[]>([]);
  const [agendamentosData, setAgendamentosData] = useState<any[]>([]);
  const [tecnicosData, setTecnicosData] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (user?.unidade_id) {
      setSelectedUnidade(user.unidade_id);
    }
  }, [user]);

  const loadUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('id, nome')
        .order('nome');

      if (!error && data) {
        setUnidades(data);
      }
    } catch (error) {
      console.error('Error loading unidades:', error);
    }
  };

  useEffect(() => {
    if (selectedUnidade) {
      loadOSData();
      loadAgendamentosData();
      loadTecnicosData();
    }
  }, [selectedUnidade, refreshKey]);

  const loadOSData = async () => {
    if (!selectedUnidade) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('os')
        .select(`
          *,
          cliente:clientes(nome, telefone, email),
          tecnico:usuarios!os_tecnico_id_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOsData(data);
      }
    } catch (error) {
      console.error('Error loading OS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentosData = async () => {
    if (!selectedUnidade) return;

    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          os:os!agendamentos_os_id_fkey(
            numero_os,
            cliente:clientes(nome, telefone),
            aparelho_marca,
            aparelho_modelo
          ),
          tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .order('data_agendamento', { ascending: true });

      if (!error && data) {
        setAgendamentosData(data);
      }
    } catch (error) {
      console.error('Error loading agendamentos:', error);
    }
  };

  const loadTecnicosData = async () => {
    if (!selectedUnidade) return;

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .eq('ativo', true)
        .order('nome');

      if (!error && data) {
        setTecnicosData(data);
      }
    } catch (error) {
      console.error('Error loading tecnicos:', error);
    }
  };

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <OtimizadorContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedUnidade,
        setSelectedUnidade,
        refreshKey,
        refresh,
        loading,
        osData,
        agendamentosData,
        tecnicosData,
        unidades,
        loadOSData,
        loadAgendamentosData,
        loadTecnicosData
      }}
    >
      {children}
    </OtimizadorContext.Provider>
  );
}

export function useOtimizador() {
  const context = useContext(OtimizadorContext);
  if (!context) {
    throw new Error('useOtimizador must be used within OtimizadorProvider');
  }
  return context;
}
