'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Link2, 
  Edit2, 
  Trash2, 
  Power, 
  PowerOff,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PortalCardProps {
  portal: {
    id: string;
    nome: string;
    urlBusca: string;
    urlsFallback: string[];
    tipo: 'rss' | 'html' | 'api' | 'session';
    categoria: string;
    ativo: boolean;
    scraperModule?: string;
    intervaloMinutos: number;
    ultimoScan?: string;
  };
  onEdit: (portal: any) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TIPO_LABELS: Record<string, string> = {
  html: 'HTML',
  rss: 'RSS',
  api: 'API',
  session: 'Session',
};

const TIPO_COLORS: Record<string, string> = {
  html: 'bg-green-900/50 text-green-400 border-green-700',
  rss: 'bg-blue-900/50 text-blue-400 border-blue-700',
  api: 'bg-purple-900/50 text-purple-400 border-purple-700',
  session: 'bg-orange-900/50 text-orange-400 border-orange-700',
};

export function PortalCard({ portal, onEdit, onToggle, onDelete }: PortalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date?: string) => {
    if (!date) return 'Nunca';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-slate-800/50 border rounded-lg overflow-hidden transition-all ${portal.ativo ? 'border-slate-600' : 'border-slate-700 opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <h3 className="font-medium text-slate-100 truncate">{portal.nome}</h3>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={TIPO_COLORS[portal.tipo]}>
                {TIPO_LABELS[portal.tipo]}
              </Badge>
              <Badge variant="default" className="text-slate-400 border-slate-600">
                {portal.categoria}
              </Badge>
              {portal.scraperModule && (
                <Badge variant="default" className="text-slate-500 border-slate-700">
                  {portal.scraperModule}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggle(portal.id)}
              className={`p-2 rounded-lg transition-colors ${portal.ativo ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}
              title={portal.ativo ? 'Desativar' : 'Ativar'}
            >
              {portal.ativo ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(portal)}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(portal.id)}
              className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1 truncate max-w-[200px]" title={portal.urlBusca}>
            <Link2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{portal.urlBusca}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Scan: {formatDate(portal.ultimoScan)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Intervalo: {portal.intervaloMinutos}min</span>
          </div>
        </div>

        {portal.urlsFallback && portal.urlsFallback.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {portal.urlsFallback.length} URL(s) alternativa(s)
          </button>
        )}

        {expanded && portal.urlsFallback && portal.urlsFallback.length > 0 && (
          <div className="mt-2 pl-4 space-y-1">
            {portal.urlsFallback.map((url, idx) => (
              <div key={idx} className="text-xs text-slate-400 truncate" title={url}>
                ↳ {url}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}