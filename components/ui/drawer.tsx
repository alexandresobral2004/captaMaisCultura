'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export function Drawer({ open, onClose, children, side = 'left', className }: DrawerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!isMounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          'fixed top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-xl transition-transform duration-300 ease-out',
          side === 'left' ? 'left-0' : 'right-0',
          side === 'left'
            ? open ? 'translate-x-0' : '-translate-x-full'
            : open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navegação"
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              C+
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Capta+</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-target"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full pb-20">
          {children}
        </div>
      </div>
    </>
  );
}