'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface OpcoesConfirmacao {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  perigoso?: boolean;
}

type Confirmar = (opcoes: OpcoesConfirmacao | string) => Promise<boolean>;

const ConfirmContext = createContext<Confirmar | null>(null);

/** Provê `useConfirm()`: `if (!(await confirmar('Tem certeza?'))) return;` no lugar de window.confirm. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmacao | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>((entrada) => {
    const o = typeof entrada === 'string' ? { mensagem: entrada } : entrada;
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOpcoes(o);
    });
  }, []);

  const responder = useCallback((valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setOpcoes(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <ConfirmDialog
        aberto={opcoes !== null}
        titulo={opcoes?.titulo ?? 'Confirmar ação'}
        mensagem={opcoes?.mensagem ?? ''}
        textoConfirmar={opcoes?.textoConfirmar ?? 'Confirmar'}
        perigoso={opcoes?.perigoso ?? true}
        onConfirmar={() => responder(true)}
        onCancelar={() => responder(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirmar {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  return ctx;
}
