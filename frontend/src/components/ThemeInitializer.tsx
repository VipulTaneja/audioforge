'use client';

import { useEffect } from 'react';
import { initTheme } from '@/hooks/useTheme';

export function ThemeInitializer() {
  useEffect(() => {
    initTheme();
  }, []);
  
  return null;
}
