import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface GSPNErro {
  id: string;
  processo: string;
  mensagem: string;
  unidade_id: string | null;
  os_id: string | null;
  numero_os_samsung: string | null;
  criado_em: string;
}

interface UseGSPNErrosReturn {
  erros: GSPNErro[];
  loading: boolean;
  novoErro: GSPNErro | null;
  dismissErro: () => void;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
}

const PAGE_SIZE = 30;

export function useGSPNErros(): UseGSPNErrosReturn {
  const [erros, setErros] = useState<GSPNErro[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoErro, setNovoErro] = useState<GSPNErro | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchInitial() {
      const { data, error } = await supabase
        .from('gspn_erros')
        .select('*')
        .order('criado_em', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (mounted && !error && data) {
        setErros(data);
        offsetRef.current = data.length;
        setHasMore(data.length === PAGE_SIZE);
      }
      if (mounted) setLoading(false);
    }

    fetchInitial();

    const channel = supabase
      .channel('gspn_erros_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gspn_erros' },
        (payload) => {
          if (!mounted) return;
          const novo = payload.new as GSPNErro;
          setErros((prev) => [novo, ...prev]);
          offsetRef.current += 1;
          setNovoErro(novo);

          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            if (mounted) setNovoErro(null);
          }, 10000);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissErro = useCallback(() => {
    setNovoErro(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fetchMore = useCallback(async () => {
    const { data, error } = await supabase
      .from('gspn_erros')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

    if (!error && data) {
      setErros((prev) => [...prev, ...data]);
      offsetRef.current += data.length;
      setHasMore(data.length === PAGE_SIZE);
    }
  }, []);

  return { erros, loading, novoErro, dismissErro, fetchMore, hasMore };
}
