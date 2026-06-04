'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Globe, Link2 } from 'lucide-react';

interface PortalFormData {
  id?: string;
  nome?: string;
  urlBusca?: string;
  urlsFallback?: string | string[];
  tipo?: 'rss' | 'html' | 'api' | 'session';
  categoria?: string;
  ativo?: boolean;
  scraperModule?: string;
  intervaloMinutos?: number;
}

interface PortalSubmitData {
  id?: string;
  nome: string;
  urlBusca: string;
  urlsFallback: string[];
  tipo: 'rss' | 'html' | 'api' | 'session';
  categoria: string;
  ativo: boolean;
  scraperModule?: string;
  intervaloMinutos: number;
}

interface PortalFormProps {
  portal?: PortalFormData | null;
  onSubmit: (data: PortalSubmitData) => void;
  onCancel: () => void;
}

const CATEGORIAS = [
  'Inovação e Tecnologia',
  'Pesquisa e Acadêmico',
  'Pesquisa e Ciência',
  'Social e Infraestrutura',
  'Terceiro Setor e Social',
  'Educação e Capacitação',
  'Geral',
];

const TIPOS = [
  { value: 'html', label: 'HTML (Scraping)' },
  { value: 'rss', label: 'RSS (Feed)' },
  { value: 'api', label: 'API (JSON/REST)' },
  { value: 'session', label: 'Session (requer login)' },
];

export function PortalForm({ portal, onSubmit, onCancel }: PortalFormProps) {
  const [formData, setFormData] = useState<PortalFormData>({
    id: portal?.id || '',
    nome: portal?.nome || '',
    urlBusca: portal?.urlBusca || '',
    urlsFallback: Array.isArray(portal?.urlsFallback) 
      ? portal.urlsFallback.join('\n') 
      : (portal?.urlsFallback as string) || '',
    tipo: portal?.tipo || 'html',
    categoria: portal?.categoria || 'Geral',
    ativo: portal?.ativo ?? true,
    scraperModule: portal?.scraperModule || '',
    intervaloMinutos: portal?.intervaloMinutos || 60,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome?.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.urlBusca?.trim()) {
      newErrors.urlBusca = 'URL é obrigatória';
    } else {
      try {
        new URL(formData.urlBusca);
      } catch {
        newErrors.urlBusca = 'URL inválida';
      }
    }

    if (formData.urlsFallback && typeof formData.urlsFallback === 'string') {
      const urls = formData.urlsFallback.split('\n').filter(u => u.trim());
      for (const url of urls) {
        try {
          new URL(url.trim());
        } catch {
          newErrors.urlsFallback = `URL inválida: ${url}`;
          break;
        }
      }
    }

    if (!formData.categoria) {
      newErrors.categoria = 'Categoria é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const urlsFallbackArray = formData.urlsFallback
      ? (typeof formData.urlsFallback === 'string' 
          ? formData.urlsFallback.split('\n').map(u => u.trim()).filter(u => u)
          : formData.urlsFallback)
      : [];

    onSubmit({
      id: formData.id,
      nome: formData.nome || '',
      urlBusca: formData.urlBusca || '',
      urlsFallback: urlsFallbackArray,
      tipo: formData.tipo || 'html',
      categoria: formData.categoria || 'Geral',
      ativo: formData.ativo ?? true,
      scraperModule: formData.scraperModule,
      intervaloMinutos: formData.intervaloMinutos || 60,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            {portal ? 'Editar Portal' : 'Novo Portal'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nome do Portal *
            </label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: FINEP - Chamadas Públicas"
              className={errors.nome ? 'border-red-500' : ''}
            />
            {errors.nome && <p className="text-xs text-red-400 mt-1">{errors.nome}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Globe className="w-4 h-4 inline mr-1" />
              URL Principal *
            </label>
            <Input
              value={formData.urlBusca}
              onChange={(e) => setFormData({ ...formData, urlBusca: e.target.value })}
              placeholder="https://example.com/editais"
              className={errors.urlBusca ? 'border-red-500' : ''}
            />
            {errors.urlBusca && <p className="text-xs text-red-400 mt-1">{errors.urlBusca}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Link2 className="w-4 h-4 inline mr-1" />
              URLs Alternativas (fallback)
              <span className="text-slate-500 text-xs ml-1">(uma por linha)</span>
            </label>
            <textarea
              value={formData.urlsFallback}
              onChange={(e) => setFormData({ ...formData, urlsFallback: e.target.value })}
              placeholder="https://backup.example.com/editais"
              rows={3}
              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.urlsFallback ? 'border-red-500' : 'border-slate-600'}`}
            />
            {errors.urlsFallback && <p className="text-xs text-red-400 mt-1">{errors.urlsFallback}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Tipo de Scraper *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Categoria *
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIAS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.categoria && <p className="text-xs text-red-400 mt-1">{errors.categoria}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Módulo Scraper
                <span className="text-slate-500 text-xs ml-1">(opcional)</span>
              </label>
              <Input
                value={formData.scraperModule}
                onChange={(e) => setFormData({ ...formData, scraperModule: e.target.value })}
                placeholder="finep, cnpq, prosas..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Intervalo (minutos)
              </label>
              <Input
                type="number"
                min={15}
                value={formData.intervaloMinutos}
                onChange={(e) => setFormData({ ...formData, intervaloMinutos: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="ativo" className="text-sm text-slate-300">
              Portal ativo (incluído nas buscas)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {portal ? 'Salvar Alterações' : 'Adicionar Portal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}