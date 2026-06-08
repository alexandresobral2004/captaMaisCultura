'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Trash2, Eye, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  editalId: string;
  scoreCompliance?: number;
  versao?: number;
  criadoEm?: string;
  atualizadoEm?: string;
  editable?: {
    titulo?: string;
    orgao?: string;
    valor?: number;
  };
}

export default function ProjetosPage() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoEditalId, setNovoEditalId] = useState('');
  const [editaisDisponiveis, setEditaisDisponiveis] = useState<any[]>([]);
  const [criando, setCriando] = useState(false);

  const fetchProjetos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/projetos');
      if (!res.ok) throw new Error('Falha ao buscar projetos');
      const data = await res.json();
      setProjetos(data.data || []);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditais = async () => {
    try {
      const res = await fetch('/api/v1/editais?status=Aberto&limit=100&categoriaArea=Cultura');
      if (res.ok) {
        const data = await res.json();
        setEditaisDisponiveis(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar editais:', err);
    }
  };

  useEffect(() => {
    fetchProjetos();
  }, []);

  const handleCriar = async () => {
    if (!novoTitulo.trim() || !novoEditalId) return;

    setCriando(true);
    try {
      const res = await fetch('/api/v1/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novoTitulo,
          editalId: novoEditalId,
          status: 'rascunho',
        }),
      });

      if (!res.ok) throw new Error('Falha ao criar projeto');

      const data = await res.json();
      router.push(`/projetos/${data.data.id}`);
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
    } finally {
      setCriando(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este projeto?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/projetos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar projeto');

      setProjetos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Erro ao deletar projeto:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjetos = projetos.filter(p =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    rascunho: 'bg-gray-100 text-gray-700',
    gerado: 'bg-blue-100 text-blue-700',
    pendente: 'bg-yellow-100 text-yellow-700',
    aprovado: 'bg-green-100 text-green-700',
    rejeitado: 'bg-red-100 text-red-700',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Projetos</h1>
            <p className="text-sm text-gray-500 mt-1">
              Crie e gerencie suas propostas para editais
            </p>
          </div>
          <Button onClick={() => { fetchEditais(); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando projetos...</div>
        ) : filteredProjetos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum projeto encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? 'Tente buscar com outros termos'
                  : 'Comece criando seu primeiro projeto'}
              </p>
              {!searchTerm && (
                <Button onClick={() => { fetchEditais(); setShowModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Projeto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjetos.map((projeto) => (
              <Card key={projeto.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{projeto.titulo}</h3>
                        <Badge className={statusColors[projeto.status] || 'bg-gray-100'}>
                          {projeto.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {projeto.editable?.orgao && (
                          <span>{projeto.editable.orgao}</span>
                        )}
                        {projeto.scoreCompliance && (
                          <span className="flex items-center gap-1">
                            {projeto.scoreCompliance >= 70 ? (
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-yellow-600" />
                            )}
                            Compliance: {projeto.scoreCompliance}%
                          </span>
                        )}
                        {projeto.versao && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            v{projeto.versao}
                          </span>
                        )}
                        {projeto.atualizadoEm && (
                          <span>
                            Atualizado {new Date(projeto.atualizadoEm).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/projetos/${projeto.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletar(projeto.id)}
                        disabled={deletingId === projeto.id}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Novo Projeto</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titulo do Projeto
                </label>
                <Input
                  placeholder="Descreva sua ideia de projeto..."
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecione o Edital
                </label>
                {editaisDisponiveis.length === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                    Nenhum edital aberto encontrado. <a href="/editais" className="underline">Cadastre ou analise editais primeiro.</a>
                  </div>
                ) : (
                  <select
                    value={novoEditalId}
                    onChange={(e) => setNovoEditalId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Selecione um edital...</option>
{editaisDisponiveis.map((edital) => {
                      const valor = edital.valor ? `R$ ${Number(edital.valor).toLocaleString('pt-BR')}` : '';
                      const prazo = edital.dataLimite ? `${new Date(edital.dataLimite).toLocaleDateString('pt-BR')}` : '';
                      const codigo = edital.codigo ? `[${edital.codigo}]` : '';
                      const partes = [codigo, edital.titulo, edital.orgao, valor, prazo].filter(Boolean);
                      return (
                        <option key={edital.id} value={edital.id}>
                          {partes.join(' | ')}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCriar}
                disabled={!novoTitulo.trim() || !novoEditalId || criando}
              >
                {criando ? 'Criando...' : 'Criar Projeto'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}