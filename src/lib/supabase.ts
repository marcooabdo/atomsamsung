import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export function formatTipoAtendimento(tipo: string | null | undefined): string {
  if (!tipo || tipo === '') return 'N/A';

  const tipoUpper = tipo.toUpperCase().trim();

  const mapeamento: Record<string, string> = {
    'IH': 'IH - In Home',
    'CI': 'CI - Carry In',
    'II': 'II - In/In',
    'RH': 'RH - Return Home',
    'PS': 'PS - Pickup Service',
    'SH': 'SH - Service Home',
    'OO': 'OO - Out/Out',
    'IO': 'IO - In/Out',
    'OI': 'OI - Out/In'
  };

  return mapeamento[tipoUpper] || tipoUpper;
}

export function formatTipoAtendimentoShort(tipo: string | null | undefined): string {
  if (!tipo || tipo === '') return 'N/A';
  return tipo.toUpperCase().trim();
}
