'use client';

import { Button } from '@/components/ui/button';

interface Props {
  onEscolher: (modo: 'vazias' | 'todas') => void;
  onCancelar: () => void;
}

/** Pergunta o que fazer com as seções que o usuário já escreveu antes de gerar. */
export function EscolhaModoGeracao({ onEscolher, onCancelar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-modo-geracao">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 id="titulo-modo-geracao" className="text-lg font-semibold">Algumas seções já têm texto</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          O que você quer que o sistema faça?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => onEscolher('vazias')}>Preencher só as vazias</Button>
          <Button variant="outline" onClick={() => onEscolher('todas')}>
            Reescrever todas (meu texto vira rascunho)
          </Button>
          <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
