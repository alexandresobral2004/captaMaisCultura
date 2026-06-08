'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface ProjetoStats {
  total: number;
  rascunho: number;
  emAnalise: number;
  submetido: number;
  aprovado: number;
  reprovado: number;
}

interface ProjetoRecente {
  id: string;
  titulo: string;
  status: string;
  areaTematica: string;
  dataAtualizacao: string;
}

export default function AnaliseCientificaDashboard() {
  const [stats, setStats] = useState<ProjetoStats>({
    total: 0,
    rascunho: 0,
    emAnalise: 0,
    submetido: 0,
    aprovado: 0,
    reprovado: 0,
  });
  const [projetosRecentes, setProjetosRecentes] = useState<ProjetoRecente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento de dados
    // Em produção, isso viria de uma API real
    const timer = setTimeout(() => {
      setStats({
        total: 12,
        rascunho: 5,
        emAnalise: 3,
        submetido: 2,
        aprovado: 1,
        reprovado: 1,
      });
      setProjetosRecentes([
        {
          id: '1',
          titulo: 'Desenvolvimento de Sistema de Monitoramento Ambiental com IA',
          status: 'rascunho',
          areaTematica: 'Ciências Biológicas',
          dataAtualizacao: '2026-06-07T10:30:00Z',
        },
        {
          id: '2',
          titulo: 'Análise de Impacto Socioeconômico de Políticas Públicas',
          status: 'em_analise',
          areaTematica: 'Ciências Humanas',
          dataAtualizacao: '2026-06-06T14:20:00Z',
        },
        {
          id: '3',
          titulo: 'Modelagem Computacional de Materiais Nanocompósitos',
          status: 'submetido',
          areaTematica: 'Ciências Exatas e da Terra',
          dataAtualizacao: '2026-06-05T09:15:00Z',
        },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | undefined }> = {
      rascunho: { label: 'Rascunho', variant: 'warning' },
      em_analise: { label: 'Em Análise', variant: 'default' },
      submetido: { label: 'Submetido', variant: 'default' },
      aprovado: { label: 'Aprovado', variant: 'success' },
      reprovado: { label: 'Reprovado', variant: 'danger' },
    };
    const config = statusMap[status] || { label: status, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Carregando...</p>
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
              Análise Científica
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Elaboração e análise de projetos científicos para editais de pesquisa
            </p>
          </div>
          <Link href="/analise-cientifica/projetos/novo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Projeto
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total de Projetos
              </CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-slate-500 mt-1">Projetos criados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Em Elaboração
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.rascunho + stats.emAnalise}</div>
              <p className="text-xs text-slate-500 mt-1">Rascunho e análise</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Submetidos
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.submetido}</div>
              <p className="text-xs text-slate-500 mt-1">Aguardando resultado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Aprovados
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.aprovado}</div>
              <p className="text-xs text-slate-500 mt-1">Financiamento aprovado</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/analise-cientifica/projetos">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                    Meus Projetos
                  </h3>
                  <p className="text-sm text-slate-500">
                    Gerenciar projetos científicos
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/analise-cientifica/editais">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Search className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                    Buscar Editais
                  </h3>
                  <p className="text-sm text-slate-500">
                    Encontrar editais científicos
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                  Prazos Próximos
                </h3>
                <p className="text-sm text-slate-500">
                  2 editais com prazo em 30 dias
                </p>
              </div>
              <Badge variant="danger">2</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Projetos Recentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Projetos Recentes</CardTitle>
              <Link href="/analise-cientifica/projetos">
                <Button variant="ghost" size="sm" className="gap-2">
                  Ver todos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {projetosRecentes.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nenhum projeto criado ainda.</p>
                <Link href="/analise-cientifica/projetos/novo">
                  <Button variant="outline" className="mt-4">
                    Criar primeiro projeto
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {projetosRecentes.map((projeto) => (
                  <Link
                    key={projeto.id}
                    href={`/analise-cientifica/projetos/${projeto.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-slate-50 truncate">
                          {projeto.titulo}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500">
                            {projeto.areaTematica}
                          </span>
                          <span className="text-sm text-slate-400">
                            • Atualizado em {formatDate(projeto.dataAtualizacao)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(projeto.status)}
                        <ArrowRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
