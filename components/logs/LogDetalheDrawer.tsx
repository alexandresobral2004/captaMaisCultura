"use client"

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LogEntry, nivelConfig, formatDate, getBadgeVariant } from './tipos';

interface Props {
  log: LogEntry;
  onFechar: () => void;
}

export function LogDetalheDrawer({ log, onFechar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={() => onFechar()}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Detalhes do Log</h3>
          <button
            onClick={() => onFechar()}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={getBadgeVariant(log.nivel)}>
              {nivelConfig[log.nivel as keyof typeof nivelConfig]?.label || log.nivel}
            </Badge>
            <span className="text-sm text-slate-500">{formatDate(log.criadoEm)}</span>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-1">Mensagem</h4>
            <p className="text-slate-900 dark:text-slate-100">{log.mensagem}</p>
          </div>

          {log.contexto && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Contexto</h4>
              <p className="text-slate-700 dark:text-slate-300">{log.contexto}</p>
            </div>
          )}

          {log.caminho && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Caminho</h4>
              <p className="text-slate-700 dark:text-slate-300 text-sm font-mono">{log.caminho}</p>
            </div>
          )}

          {log.cenarioFalha && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Cenário de Falha</h4>
              <p className="text-slate-700 dark:text-slate-300">{log.cenarioFalha}</p>
            </div>
          )}

          {log.acaoTomada && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Ação Tomada</h4>
              <p className="text-slate-700 dark:text-slate-300">{log.acaoTomada}</p>
            </div>
          )}

          {log.repeticoes !== null && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Repetições</h4>
              <p className="text-slate-700 dark:text-slate-300">{log.repeticoes}</p>
            </div>
          )}

          {log.detalhes && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Detalhes</h4>
              <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs overflow-x-auto">
                {typeof log.detalhes === 'string'
                  ? log.detalhes
                  : JSON.stringify(log.detalhes, null, 2)}
              </pre>
            </div>
          )}

          {log.ip && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">IP</h4>
              <p className="text-slate-700 dark:text-slate-300 text-sm font-mono">{log.ip}</p>
            </div>
          )}

          {log.userAgent && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">User Agent</h4>
              <p className="text-slate-700 dark:text-slate-300 text-xs">{log.userAgent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
