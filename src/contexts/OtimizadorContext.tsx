import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type OtimizadorTab =
  | 'dashboard'
  | 'agenda'
  | 'mapa'
  | 'rotas'
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
  isMaster: boolean;
  loadOSData: () => Promise<void>;
  loadAgendamentosData: () => Promise<void>;
  loadTecnicosData: () => Promise<void>;
}

const OtimizadorContext = createContext<OtimizadorContextData>({} as OtimizadorContextData);

export function OtimizadorProvider({ children }: { children: ReactNode }) {
  const { user, usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<OtimizadorTab>('dashboard');
  const [selectedUnidade, setSelectedUnidade] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [osData, setOsData] = useState<any[]>([]);
  const [agendamentosData, setAgendamentosData] = useState<any[]>([]);
  const [tecnicosData, setTecnicosData] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const isMaster = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (usuario) {
      if (isMaster) {
        setSelectedUnidade(null);
      } else if (usuario.unidade_id) {
        setSelectedUnidade(usuario.unidade_id);
      }
    }
  }, [usuario, isMaster]);

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
    }
  };

  useEffect(() => {
    if (isMaster || selectedUnidade) {
      loadOSData();
      loadAgendamentosData();
      loadTecnicosData();
    }
  }, [selectedUnidade, refreshKey, isMaster]);

  const loadOSData = async () => {
    if (!isMaster && !selectedUnidade) return;

    setLoading(true);
    try {
      let query = supabase
        .from('os')
        .select(`
          *,
          tecnico:usuarios!os_tecnico_id_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      const { data, error } = await query;

      if (!error && data) {
        setOsData(data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadAgendamentosData = async () => {
    if (!isMaster && !selectedUnidade) return;

    try {
      let query = supabase
        .from('agendamentos')
        .select(`
          *,
          os:os!agendamentos_os_id_fkey(
            numero_os_interna,
            numero_os_samsung,
            cliente_nome,
            cliente_telefone,
            aparelho_marca,
            aparelho_modelo
          ),
          tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)
        `)
        .order('data_agendamento', { ascending: true });

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      const { data, error } = await query;

      if (!error && data) {
        setAgendamentosData(data);
      }
    } catch (error) {
    }
  };

  const loadTecnicosData = async () => {
    if (!isMaster && !selectedUnidade) return;

    try {
      let query = supabase
        .from('usuarios')
        .select('*')
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .eq('ativo', true)
        .order('nome');

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      const { data, error } = await query;

      if (!error && data) {
        setTecnicosData(data);
      }
    } catch (error) {
    }
  };

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSetSelectedUnidade = (unidade: string | null) => {
    setSelectedUnidade(unidade === '' ? null : unidade);
  };

  return (
    <OtimizadorContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedUnidade,
        setSelectedUnidade: handleSetSelectedUnidade,
        refreshKey,
        refresh,
        loading,
        osData,
        agendamentosData,
        tecnicosData,
        unidades,
        isMaster,
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
