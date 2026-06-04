'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TermTagVariant = 'whitelist' | 'blacklist' | 'exception';

interface TermTagProps {
  term: string;
  variant?: TermTagVariant;
  onRemove?: () => void;
  isPending?: boolean;
  className?: string;
}

const variantStyles: Record<TermTagVariant, string> = {
  whitelist: 'term-tag-whitelist',
  blacklist: 'term-tag-blacklist',
  exception: 'term-tag-exception',
};

export function TermTag({
  term,
  variant = 'whitelist',
  onRemove,
  isPending = false,
  className,
}: TermTagProps) {
  const [confirming, setConfirming] = useState(false);

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      // Auto-cancela a confirmação depois de 3s se não confirmar
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    // Segunda vez: confirma
    setConfirming(false);
    onRemove?.();
  };

  return (
    <span
      className={cn(
        'term-tag',
        variantStyles[variant],
        confirming && 'term-tag-pending-delete',
        isPending && 'opacity-50 pointer-events-none',
        className
      )}
      title={confirming ? 'Clique novamente para confirmar remoção' : term}
    >
      <span className="term-tag-text">{confirming ? `Remover "${term}"?` : term}</span>
      {onRemove && (
        <button
          onClick={handleRemoveClick}
          className="term-tag-remove"
          aria-label={`Remover ${term}`}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
