'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Erro na página:', error);
  }, [error]);

  return (
    <main role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="max-w-md text-sm text-slate-500">
        Não foi possível carregar esta página. Tente novamente; se o problema continuar, avise a equipe.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
