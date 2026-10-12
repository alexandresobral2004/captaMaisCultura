import { AlertTriangle, Info, XCircle } from 'lucide-react';

export interface LogEntry {
  id: number;
  nivel: 'error' | 'warning' | 'info';
  mensagem: string;
  contexto: string | null;
  caminho: string | null;
  detalhes: any;
  cenarioFalha: string | null;
  acaoTomada: string | null;
  repeticoes: number | null;
  usuarioId: string | null;
  ip: string | null;
  userAgent: string | null;
  criadoEm: string;
}

export interface LogStats {
  total: number;
  erros: number;
  warnings: number;
  infos: number;
  ultimoErro: string | null;
}

export interface LogsResponse {
  success: boolean;
  data: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const nivelConfig = {
  error: { label: 'Erro', variant: 'danger' as const, icon: XCircle },
  warning: { label: 'Aviso', variant: 'warning' as const, icon: AlertTriangle },
  info: { label: 'Informação', variant: 'default' as const, icon: Info },
};

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getBadgeVariant(nivel: string): 'danger' | 'warning' | 'default' {
  if (nivel === 'error') return 'danger';
  if (nivel === 'warning') return 'warning';
  return 'default';
}
