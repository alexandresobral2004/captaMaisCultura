'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigoso?: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Segunda ação opcional, exibida entre Cancelar e Confirmar */
  textoAlternativo?: string;
  onAlternativo?: () => void;
}

/** Substitui window.confirm: acessível (role=alertdialog), fecha com Esc e foca o botão seguro. */
export function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  perigoso = false,
  carregando = false,
  onConfirmar,
  onCancelar,
  textoAlternativo,
  onAlternativo,
}: ConfirmDialogProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    cancelarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !carregando) onCancelar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, carregando, onCancelar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        aria-describedby="confirm-mensagem"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h3 id="confirm-titulo" className="text-lg font-semibold text-slate-100">{titulo}</h3>
        <p id="confirm-mensagem" className="mt-2 text-sm text-slate-300">{mensagem}</p>
        <div className="mt-5 flex gap-3">
          <Button
            ref={cancelarRef}
            type="button"
            variant="outline"
            onClick={onCancelar}
            disabled={carregando}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {textoCancelar}
          </Button>
          {textoAlternativo && onAlternativo && (
            <Button
              type="button"
              variant="outline"
              onClick={onAlternativo}
              disabled={carregando}
              className="flex-1 border-red-700 text-red-300 hover:bg-red-950"
            >
              {textoAlternativo}
            </Button>
          )}
          <Button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className={`flex-1 text-white border-none ${perigoso ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {carregando ? 'Aguarde...' : textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
