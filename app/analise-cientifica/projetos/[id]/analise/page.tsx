'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ProcessingOverlay } from '@/components/ui/processing-overlay';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  ExternalLink,
  FileText
} from 'lucide-react';
import Link from 'next/link';

interface CriterioAvaliado {
  criterio: string;
  peso: number;
  pontuacao: number;
  atendido: boolean;
  comentario: string;
  sugestao?: string;
}

interface FeedbackSecao {
  secao: string;
  pontuacao: number;
  comentario: string;
  sugestoes: string[];
}

interface AnaliseConformidade {
  criteriosAvaliados: CriterioAvaliado[];
  scoreGeral: number;
  feedback: FeedbackSecao[];
  recomendacoes: string[];
  dataAnalise: string;
}

export default function AnaliseConformidadePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [projeto, setProjeto] = useState<any>(null);
  const [analise, setAnalise] = useState<AnaliseConformidade | null>(null);

  useEffect(() => {
    const fetchProjetoEAnalise = async () => {
      try {
        const response = await fetch(`/api/analise-cientifica/projetos/${params.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setProjeto(result.data);
            if (result.data.analise) {
              setAnalise(result.data.analise);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar projeto para análise:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjetoEAnalise();
  }, [params.id]);

  const handleReanalisar = async () => {
    if (!projeto) return;
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/analise-cientifica/projetos/${params.id}/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projeto,
          edital: {
            titulo: 'Projeto de Pesquisa Institucional',
            orgao: 'Instituição de Pesquisa',
            criteriosAvaliacao: [
              'Relevância científica e social',
              'Clareza dos objetivos',
              'Metodologia adequada',
              'Viabilidade orçamentária',
              'Qualificação da equipe'
            ]
          }
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAnalise(result.data);
          setProjeto((prev: any) => ({ ...prev, analise: result.data, scoreCompliance: result.data.scoreGeral }));
        }
      }
    } catch (error) {
      console.error('Erro ao realizar análise:', error);
    } finally {
      setAnalyzing(false);
    }
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
            <Link href={`/analise-cientifica/projetos/${params.id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Análise de Conformidade
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Análise do projeto em relação aos critérios do edital
              </p>
            </div>
          </div>
          <Button
            onClick={handleReanalisar}
            disabled={analyzing}
            className="gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Reanalisar Projeto
              </>
            )}
          </Button>
        </div>

        {/* Score Geral */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${getScoreBgColor(analise?.scoreGeral || 0)}`}>
                  <span className={`text-3xl font-bold ${getScoreColor(analise?.scoreGeral || 0)}`}>
                    {analise?.scoreGeral || 0}%
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Score Geral de Conformidade
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {analise?.scoreGeral !== undefined && analise.scoreGeral >= 70
                      ? 'Projeto adequado para submissão'
                      : analise?.scoreGeral !== undefined && analise.scoreGeral >= 50
                        ? 'Projeto precisa de ajustes antes da submissão'
                        : 'Projeto requer revisões significativas'}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Última análise: {new Date(analise?.dataAnalise || '').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {analise?.scoreGeral !== undefined && analise.scoreGeral >= 70 ? (
                  <Badge variant="success" className="px-4 py-2 gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Pronto para Submissão
                  </Badge>
                ) : analise?.scoreGeral !== undefined && analise.scoreGeral >= 50 ? (
                  <Badge variant="warning" className="px-4 py-2 gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Ajustes Necessários
                  </Badge>
                ) : (
                  <Badge variant="danger" className="px-4 py-2 gap-2">
                    <XCircle className="h-4 w-4" />
                    Revisões Necessárias
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critérios Avaliados */}
        <Card>
          <CardHeader>
            <CardTitle>Critérios Avaliados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analise?.criteriosAvaliados.map((criterio, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className={`p-2 rounded-full ${criterio.atendido ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {criterio.atendido ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-slate-900 dark:text-slate-50">
                        {criterio.criterio}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Peso: {criterio.peso * 100}%</span>
                        <span className={`font-bold ${getScoreColor(criterio.pontuacao)}`}>
                          {criterio.pontuacao}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {criterio.comentario}
                    </p>
                    {criterio.sugestao && (
                      <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-blue-700 dark:text-blue-300">{criterio.sugestao}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feedback por Seção */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback por Seção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analise?.feedback.map((fb, index) => (
                <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-50">
                      {fb.secao}
                    </h4>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBgColor(fb.pontuacao)} ${getScoreColor(fb.pontuacao)}`}>
                      {fb.pontuacao}%
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {fb.comentario}
                  </p>
                  {fb.sugestoes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Sugestões:
                      </p>
                      <ul className="space-y-1">
                        {fb.sugestoes.map((sugestao, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            {sugestao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recomendaçções Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Recomendações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {analise?.recomendacoes.map((rec, index) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-medium flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href={`/analise-cientifica/projetos/${params.id}`}>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Voltar para o Editor
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Exportar Relatório
            </Button>
            <Button
              disabled={analise?.scoreGeral !== undefined && analise.scoreGeral < 50}
              className="gap-2"
            >
              Submeter Projeto
            </Button>
          </div>
        </div>
        
        <ProcessingOverlay
          isOpen={analyzing}
          title="Analisando Compliance do Projeto..."
          message="A inteligência artificial está revisando cada seção acadêmica em relação aos critérios do edital e calculando o score de conformidade."
        />
      </div>
    </MainLayout>
  );
}
