'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { PortalCard } from './components/PortalCard';
import { PortalForm } from './components/PortalForm';
import { Plus, Search, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Portal {
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
  credEmail?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export default function PortaisPage() {
  const [portais, setPortais] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message, duration: 4000 }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadPortais = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/portais');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro desconhecido');
      setPortais(data.data || []);
    } catch (err: any) {
      addToast('error', 'Erro ao carregar', err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadPortais();
  }, [loadPortais]);

  const handleAdd = () => {
    setEditingPortal(null);
    setShowForm(true);
  };

  const handleEdit = (portal: Portal) => {
    setEditingPortal(portal);
    setShowForm(true);
  };

  const handleSubmit = async (formData: any) => {
    try {
      const isEdit = !!formData.id;
      const url = isEdit ? `/api/v1/portais/${formData.id}` : '/api/v1/portais';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao salvar');

      addToast('success', isEdit ? 'Portal atualizado' : 'Portal adicionado', formData.nome);
      setShowForm(false);
      setEditingPortal(null);
      loadPortais();
    } catch (err: any) {
      addToast('error', 'Erro ao salvar', err.message);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/portais/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao togglar');

      setPortais((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ativo: !p.ativo } : p
        )
      );
      addToast('success', 'Status atualizado');
    } catch (err: any) {
      addToast('error', 'Erro ao atualizar status', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este portal?')) return;

    try {
      const res = await fetch(`/api/v1/portais/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao remover');

      setPortais((prev) => prev.filter((p) => p.id !== id));
      addToast('success', 'Portal removido');
    } catch (err: any) {
      addToast('error', 'Erro ao remover', err.message);
    }
  };

  const filteredPortais = portais.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.urlBusca.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const ativosCount = portais.filter((p) => p.ativo).length;
  const inativosCount = portais.length - ativosCount;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              Portais de Editais
            </h1>
            <p className="text-slate-400 mt-1">
              Gerencie os sites onde o sistema busca editais automaticamente
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Portal
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar portais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="success" className="border-green-700 text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {ativosCount} ativo(s)
            </Badge>
            <Badge variant="default" className="border-slate-600 text-slate-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              {inativosCount} inativo(s)
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : filteredPortais.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {search ? 'Nenhum portal encontrado para a busca' : 'Nenhum portal cadastrado ainda'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPortais.map((portal) => (
              <PortalCard
                key={portal.id}
                portal={portal}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <PortalForm
          portal={editingPortal}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingPortal(null);
          }}
        />
      )}

      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
              toast.type === 'success' ? 'bg-green-900/90 border border-green-700' :
              toast.type === 'error' ? 'bg-red-900/90 border border-red-700' :
              'bg-slate-800/90 border border-slate-700'
            }`}
          >
            <span className="text-slate-100 font-medium">{toast.title}</span>
            {toast.message && <span className="text-slate-400 text-sm">{toast.message}</span>}
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-slate-400 hover:text-slate-200"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </MainLayout>
  );
}