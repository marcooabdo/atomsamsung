import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type ThemeVariant = 'original' | 'dark-blue' | 'dark-pink' | 'white-blue' | 'white-pink';

export interface ThemeInfo {
  id: ThemeVariant;
  label: string;
  accent: string;
  bg: string;
  isDark: boolean;
}

export const THEMES: ThemeInfo[] = [
  { id: 'original', label: 'Padrao', accent: '#00D4FF', bg: '#0A0A0D', isDark: true },
  { id: 'dark-blue', label: 'Dark Blue', accent: '#00D4FF', bg: '#0b111a', isDark: true },
  { id: 'dark-pink', label: 'Dark Pink', accent: '#ff007f', bg: '#1a0b16', isDark: true },
  { id: 'white-blue', label: 'White Blue', accent: '#0077B6', bg: '#f8fafc', isDark: false },
  { id: 'white-pink', label: 'White Pink', accent: '#d6336c', bg: '#fcf8fa', isDark: false },
];

interface ThemeContextType {
  theme: ThemeVariant;
  themeInfo: ThemeInfo;
  isDark: boolean;
  customBackground: string | null;
  setTheme: (t: ThemeVariant) => void;
  toggleTheme: () => void;
  setCustomBackground: (url: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeVariant>(() => {
    const saved = localStorage.getItem('theme-variant');
    if (saved && THEMES.some(t => t.id === saved)) return saved as ThemeVariant;
    const legacy = localStorage.getItem('theme');
    if (legacy === 'light') return 'white-blue';
    return 'original';
  });

  const [customBackground, setCustomBackgroundState] = useState<string | null>(() => {
    return localStorage.getItem('custom-background') || null;
  });

  const themeInfo = THEMES.find(t => t.id === theme) || THEMES[0];

  useEffect(() => {
    const root = document.documentElement;
    root.className = '';
    root.classList.add(`theme-${theme}`);
    if (!themeInfo.isDark) root.classList.add('light');
    localStorage.setItem('theme-variant', theme);
    localStorage.setItem('theme', themeInfo.isDark ? 'dark' : 'light');
  }, [theme, themeInfo]);

  useEffect(() => {
    const body = document.body;
    if (customBackground) {
      body.style.backgroundImage = `url("${customBackground}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      localStorage.setItem('custom-background', customBackground);
    } else {
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.backgroundAttachment = '';
      localStorage.removeItem('custom-background');
    }
  }, [customBackground]);

  const setTheme = (t: ThemeVariant) => setThemeState(t);

  const toggleTheme = () => {
    const idx = THEMES.findIndex(t => t.id === theme);
    setThemeState(THEMES[(idx + 1) % THEMES.length].id);
  };

  const setCustomBackground = (url: string | null) => {
    setCustomBackgroundState(url);
  };

  useEffect(() => {
    const loadUserBackground = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('background_url')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data?.background_url) {
          setCustomBackgroundState(data.background_url);
        }
      }
    };

    loadUserBackground();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeInfo, isDark: themeInfo.isDark, customBackground, setTheme, toggleTheme, setCustomBackground }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
