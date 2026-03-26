'use client';

import { useThemeStore } from '@/hooks/useTheme';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  
  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];
  
  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.value === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].value);
  };
  
  const currentTheme = themes.find(t => t.value === theme);
  
  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 text-slate-700 shadow-sm shadow-slate-900/5 backdrop-blur transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
      title={`Theme: ${currentTheme?.label}`}
      aria-label={`Theme: ${currentTheme?.label}`}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
        {currentTheme?.icon}
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.18em]">
        {currentTheme?.label}
      </span>
    </button>
  );
}
