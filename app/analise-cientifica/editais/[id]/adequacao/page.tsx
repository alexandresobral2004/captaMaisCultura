'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  Lightbulb,
  Search,
  FileText,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface Edital {
  id: string;
  titulo: string;
  orgao: string;
  valor: string;
  dataLimite: string;
  areasTematicas: string[];
  nivel: string[];
  link: string;
}

interface AnaliseAdequacao {
  adequado: boolean;
  scoreAdequacao: number;
  pontosAlinhamento: string[];
  pontosDesencontro: string[];
  recomendacao: string;
}

export default function AnaliseAdequacaoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [edital, setEdital] = useState<Edital | null>(null);
  const [analise, setAnalise] = useState<AnaliseAdequacao | null>(null);

  useEffect(() => {
    // Simular carregamento de dados do edital
    const timer = setTimeout(() => {
      setEdital({
        id: params.id,
        titulo: 'Edital de Produtividade em Pesquisa - PQ 2026',
        orgao: 'CNPq',
        valor: 'R$ 1.200,00 - R$ 9.600,00/mês',
        dataLimite: '2026-07-15',
        areasTematicas: ['Ciências Exatas e da Terra', 'Ciências Biológicas', 'Ciências Humanas'],
        nivel: ['pesquisador'],
        link: 'https://www.gov.br/cnpq/2026/pq',
      });
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [params.id]);

  const handleAnalisar = async () => {
    setAnalisando(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setAnalise({
      adequado: true,
      scoreAdequacao: 75,
      pontosAlinhamento: [
        'Área temática "Ciências Biológicas" está dentro do escopo do edital',
        'Nível "Pesquisador" atende aos requisitos de elegibilidade',
        'Projeto propõe desenvolvimento de sistema com IA, alinhado com área de tecnologia',
        'Metodologia proposta é adequada para pesquisa de produtividade',
      ],
      pontosDesencontro: [
        'Falta detalhamento sobre impacto na produção científica do grupo de pesquisa',
        'Não ficou claro o vínculo institucional do pesquisador',
      ],
      recomendacao: 'O projeto é adequado para submissão a este edital, mas recomenda-se ajustar a descrição do impacto na produção científica e esclarecer o vínculo institucional antes da submissão final.',
    });
    setAnalisando(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/analise-cientifica/editais">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Análise de Adequação
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Verifique se o projeto é adequado para o edital selecionado
              </p>
            </div>
          </div>
          <Button
            onClick={handleAnalisar}
            disabled={analisando}
            className="gap-2"
          >
            {analisando ? (
              <>
                <Search className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Analisar Adequação
              </>
            )}
          </Button>
        </div>

        {/* Edital Selecionado */}
        <Card>
          <CardHeader>
            <CardTitle>Edital Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">{edital?.orgao}</Badge>
                  <Badge variant="default">{edital?.nivel.join(', ')}</Badge>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  {edital?.titulo}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    {edital?.valor}
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Prazo: {new Date(edital?.dataLimite || '').toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {edital?.areasTematicas.map((area) => (
                    <Badge key={area} variant="default" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
              <a
                href={edital?.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Acessar Edital
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Resultado da Análise */}
        {analise ? (
          <>
            {/* Score de Adequação */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${getScoreBgColor(analise.scoreAdequacao)}`}>
                    <span className={`text-2xl font-bold ${getScoreColor(analise.scoreAdequacao)}`}>
                      {analise.scoreAdequacao}%
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {analise.adequado ? (
                        <>
                          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                            Projeto Adequado
                          </h2>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                            Projeto Não Adequado
                          </h2>
                        </>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {analise.recomendacao}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pontos de Alinhamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Pontos de Alinhamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analise.pontosAlinhamento.map((ponto, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300">{ponto}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pontos de Desencontro */}
            {analise.pontosDesencontro.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Pontos de Desencontro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analise.pontosDesencontro.map((ponto, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700 dark:text-slate-300">{ponto}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <div className="flex items-center justify-between">
              <Link href="/analise-cientifica/editais">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para Editais
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/analise-cientifica/projetos/novo">
                  <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Criar Novo Projeto
                  </Button>
                </Link>
                <Button disabled={!analise.adequado} className="gap-2">
                  Selecionar Edital
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 text-center mb-4">
                Clique em "Analisar Adequação" para verificar se o projeto é adequado para este edital.
              </p>
              <p className="text-sm text-slate-400 text-center">
                A análise verificará área temática, nível do projeto, elegibilidade e alinhamento com os critérios do edital.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
