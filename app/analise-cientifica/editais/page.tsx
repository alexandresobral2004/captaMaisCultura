'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Filter,
  ExternalLink,
  Calendar,
  DollarSign,
  Clock,
  Star,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface EditalCientifico {
  id: string;
  titulo: string;
  orgao: string;
  valor: string;
  dataLimite: string;
  areasTematicas: string[];
  nivel: string[];
  link: string;
  destaque?: boolean;
}

export default function EditaisCientificosPage() {
  const [editais, setEditais] = useState<EditalCientifico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('todas');

  useEffect(() => {
    // Simular carregamento de dados
    const timer = setTimeout(() => {
      setEditais([
        {
          id: '1',
          titulo: 'Edital de Produtividade em Pesquisa - PQ',
          orgao: 'CNPq',
          valor: 'R$ 1.200,00 - R$ 9.600,00/mês',
          dataLimite: '2026-07-15',
          areasTematicas: ['Ciências Exatas e da Terra', 'Ciências Biológicas', 'Ciências Humanas'],
          nivel: ['pesquisador'],
          link: 'https://www.gov.br/cnpq/2026/pq',
          destaque: true,
        },
        {
          id: '2',
          titulo: 'Programa de Bolsas de Mestrado e Doutorado',
          orgao: 'CAPES',
          valor: 'R$ 1.850,00 - R$ 3.500,00/mês',
          dataLimite: '2026-08-30',
          areasTematicas: ['Todas as áreas'],
          nivel: ['mestrado', 'doutorado'],
          link: 'https://www.gov.br/capes',
        },
        {
          id: '3',
          titulo: 'Edital de Auxílio à Pesquisa - Regular',
          orgao: 'FAPESP',
          valor: 'Até R$ 500.000,00',
          dataLimite: '2026-09-30',
          areasTematicas: ['Ciências Exatas e da Terra', 'Engenharias', 'Ciências Biológicas'],
          nivel: ['pesquisador', 'pos-doutorado'],
          link: 'https://www.fapesp.br auxilios',
        },
        {
          id: '4',
          titulo: 'Iniciação Científica - PIBIC',
          orgao: 'CNPq',
          valor: 'R$ 700,00/mês',
          dataLimite: '2026-06-30',
          areasTematicas: ['Todas as áreas'],
          nivel: ['iniciacao'],
          link: 'https://www.gov.br/cnpq/pibic',
        },
        {
          id: '5',
          titulo: 'Edital de Subvenção Econômica para Inovação',
          orgao: 'FINEP',
          valor: 'R$ 500.000,00 - R$ 10.000.000,00',
          dataLimite: '2026-10-15',
          areasTematicas: ['Engenharias', 'Ciências Exatas e da Terra', 'Ciências Agrárias'],
          nivel: ['pesquisador'],
          link: 'https://www.finep.gov.br/subvencao',
        },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDiasRestantes = (dateString: string) => {
    const hoje = new Date();
    const limite = new Date(dateString);
    const diffTime = limite.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredEditais = editais.filter((edital) => {
    const matchesSearch = edital.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      edital.orgao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = areaFilter === 'todas' ||
      edital.areasTematicas.includes(areaFilter) ||
      edital.areasTematicas.includes('Todas as áreas');
    return matchesSearch && matchesArea;
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Carregando editais...</p>
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
              Editais Científicos
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Busque editais de pesquisa e financiamento científico
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por título ou órgão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={areaFilter === 'todas' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaFilter('todas')}
                >
                  Todas
                </Button>
                <Button
                  variant={areaFilter === 'Ciências Exatas e da Terra' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaFilter('Ciências Exatas e da Terra')}
                >
                  Exatas
                </Button>
                <Button
                  variant={areaFilter === 'Ciências Biológicas' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaFilter('Ciências Biológicas')}
                >
                  Biológicas
                </Button>
                <Button
                  variant={areaFilter === 'Ciências Humanas' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaFilter('Ciências Humanas')}
                >
                  Humanas
                </Button>
                <Button
                  variant={areaFilter === 'Engenharias' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAreaFilter('Engenharias')}
                >
                  Engenharias
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editais List */}
        {filteredEditais.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 text-center">
                Nenhum edital encontrado com os filtros aplicados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEditais.map((edital) => {
              const diasRestantes = getDiasRestantes(edital.dataLimite);
              return (
                <Card key={edital.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {edital.destaque && (
                            <Badge variant="warning">
                              <Star className="h-3 w-3 mr-1" />
                              Destaque
                            </Badge>
                          )}
                          <Badge variant="default">{edital.orgao}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                          {edital.titulo}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {edital.valor}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Prazo: {formatDate(edital.dataLimite)}
                          </div>
                          <div className={`flex items-center gap-1 ${diasRestantes <= 30 ? 'text-red-500 font-medium' : ''
                            }`}>
                            <Clock className="h-4 w-4" />
                            {diasRestantes > 0
                              ? `${diasRestantes} dias restantes`
                              : 'Prazo encerrado'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {edital.areasTematicas.map((area) => (
                            <Badge key={area} variant="default" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <a
                          href={edital.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Acessar
                          </Button>
                        </a>
                        <Link href={`/analise-cientifica/editais/${edital.id}/adequacao`}>
                          <Button size="sm" className="gap-2">
                            Analisar
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
