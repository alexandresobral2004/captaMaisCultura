'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  carregando: boolean;
  onAprimorar: (pedido: string) => void;
}

/** Botão "Aprimorar" que abre um campo opcional "O que melhorar?". */
export function AprimorarSecaoPopover({ carregando, onAprimorar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState('');

  const enviar = () => {
    onAprimorar(pedido.trim());
    setAberto(false);
    setPedido('');
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAberto(a => !a)}
        disabled={carregando}
        className="h-7 text-xs px-2 rounded-lg text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/30"
        title="Reescrever a seção com base no edital"
      >
        {carregando ? (
          <>
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            <span>Reescrevendo...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3 mr-1" />
            <span>Aprimorar</span>
          </>
        )}
      </Button>
      {aberto && !carregando && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border bg-white p-3 shadow-lg dark:bg-slate-900">
          <label className="mb-1 block text-xs font-medium">O que melhorar? (opcional)</label>
          <Input
            value={pedido}
            onChange={e => setPedido(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviar()}
            placeholder="Ex.: mais curto, enfatizar inovação"
            maxLength={500}
            autoFocus
          />
          <p className="mt-1 text-xs text-slate-500">Em branco, o sistema reforça os critérios do edital que o projeto atende mal.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button size="sm" onClick={enviar}>Aprimorar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
