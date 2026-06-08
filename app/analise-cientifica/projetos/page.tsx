'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  areaTematica: string;
  nivel: string;
  scoreCompliance?: number;
  dataCriacao: string;
  dataAtualizacao: string;
}

export default function ProjetosCientificosPage() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjetos = async () => {
      try {
        const response = await fetch('/api/analise-cientifica/projetos');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setProjetos(result.data);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar projetos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjetos();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="warning">Rascunho</Badge>;
      case 'em_analise':
        return <Badge variant="default">Em Análise</Badge>;
      case 'submetido':
        return <Badge variant="default">Submetido</Badge>;
      case 'aprovado':
        return <Badge variant="success">Aprovado</Badge>;
      case 'reprovado':
        return <Badge variant="danger">Reprovado</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'rascunho':
        return <Clock className="h-4 w-4" />;
      case 'em_analise':
        return <AlertCircle className="h-4 w-4" />;
      case 'submetido':
        return <FileText className="h-4 w-4" />;
      case 'aprovado':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'reprovado':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredProjetos = projetos.filter((projeto) => {
    const matchesSearch = projeto.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      projeto.areaTematica.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || projeto.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este projeto?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/analise-cientifica/projetos/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setProjetos(projetos.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Erro ao deletar projeto:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Carregando projetos...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Meus Projetos Científicos
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Gerencie seus projetos científicos para editais de pesquisa
            </p>
          </div>
          <Link href="/analise-cientifica/projetos/novo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Projeto
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por título ou área temática..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'todos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('todos')}
                >
                  Todos
                </Button>
                <Button
                  variant={statusFilter === 'rascunho' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('rascunho')}
                >
                  Rascunho
                </Button>
                <Button
                  variant={statusFilter === 'em_analise' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('em_analise')}
                >
                  Em Análise
                </Button>
                <Button
                  variant={statusFilter === 'submetido' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('submetido')}
                >
                  Submetido
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projetos List */}
        {filteredProjetos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 text-center">
                {searchTerm || statusFilter !== 'todos'
                  ? 'Nenhum projeto encontrado com os filtros aplicados.'
                  : 'Nenhum projeto científico criado ainda.'}
              </p>
              <Link href="/analise-cientifica/projetos/novo">
                <Button variant="outline" className="mt-4">
                  Criar primeiro projeto
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProjetos.map((projeto) => (
              <Card key={projeto.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(projeto.status)}
                        <Badge variant="default">{projeto.nivel}</Badge>
                      </div>
                      <Link href={`/analise-cientifica/projetos/${projeto.id}`}>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 hover:text-blue-600 dark:hover:text-blue-400 truncate">
                          {projeto.titulo}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span>{projeto.areaTematica}</span>
                        <span>•</span>
                        <span>Criado em {formatDate(projeto.dataCriacao)}</span>
                        <span>•</span>
                        <span>Atualizado em {formatDate(projeto.dataAtualizacao)}</span>
                      </div>
                      {projeto.scoreCompliance !== undefined && (
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-sm text-slate-500">Compliance:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${projeto.scoreCompliance >= 70
                                  ? 'bg-green-500'
                                  : projeto.scoreCompliance >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                  }`}
                                style={{ width: `${projeto.scoreCompliance}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{projeto.scoreCompliance}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/analise-cientifica/projetos/${projeto.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
                        onClick={() => handleDeletar(projeto.id)}
                        disabled={deletingId === projeto.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === projeto.id ? 'Deletando...' : 'Deletar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
