'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme, toggleTheme } = useTheme();

  const icons = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  const labels = {
    light: 'Modo Claro',
    dark: 'Modo Escuro',
    system: 'Sistema',
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-surface rounded-lg">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium
            transition-all duration-200
            ${theme === t
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
            }
          `}
          title={labels[t]}
        >
          {icons[t]}
          <span className="hidden sm:inline">{labels[t]}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleIcon() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      className="touch-target"
      title={`Alternar para ${resolvedTheme === 'light' ? 'escuro' : 'claro'}`}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}