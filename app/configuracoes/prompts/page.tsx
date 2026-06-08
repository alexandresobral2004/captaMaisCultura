'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, Edit, CheckCircle2, FileText, Clock } from 'lucide-react';

interface PromptCompleto {
  id: string;
  modulo: string;
  chave: string;
  conteudo: string;
  descricao?: string;
  ativo: boolean;
  customizado: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPor?: string;
}

interface PromptsPorModulo {
  [modulo: string]: PromptCompleto[];
}

const moduloLabels: Record<string, string> = {
  projetos_cultura: 'Projetos de Cultura',
  projetos_pesquisa: 'Projetos de Pesquisa',
};

const chaveLabels: Record<string, string> = {
  geracao_completa: 'Geração Completa',
  geracao_secao: 'Geração por Seção',
  geracao_dinamica: 'Geração Dinâmica',
  geracao_cientifica: 'Geração de Proposta Científica',
  analise_conformidade: 'Análise de Conformidade',
  polimento: 'Polimento de Texto',
  analise_adequacao: 'Análise de Adequação',
};

export default function ConfiguracoesPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptsPorModulo>({});
  const [loading, setLoading] = useState(true);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/prompts');
      if (!res.ok) throw new Error('Falha ao buscar prompts');
      const data = await res.json();
      setPrompts(data.data || {});
    } catch (err: any) {
      console.error('Erro ao buscar prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const formatarData = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h2 className="dashboard-title">Prompts de IA</h2>
          <p className="dashboard-subtitle">
            Gerencie os prompts de geração de projetos de cultura e pesquisa
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <p className="text-gray-500">Carregando prompts...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          Object.entries(prompts).map(([modulo, promptsLista]) => (
            <div key={modulo}>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                {moduloLabels[modulo] || modulo}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {promptsLista.map((prompt) => (
                  <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {chaveLabels[prompt.chave] || prompt.chave}
                          </CardTitle>
                          {prompt.descricao && (
                            <p className="text-sm text-gray-500 mt-1">
                              {prompt.descricao}
                            </p>
                          )}
                        </div>
                        {prompt.customizado ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Customizado
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <FileText className="h-3 w-3 mr-1" />
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {prompt.customizado ? 'Atualizado em: ' : 'Criado em: '}
                            {formatarData(prompt.customizado ? prompt.atualizadoEm : prompt.criadoEm)}
                          </span>
                        </div>
                        {prompt.criadoPor && (
                          <div>
                            Por: {prompt.criadoPor}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(`/configuracoes/prompts/${prompt.modulo}/${prompt.chave}/edit`)
                          }
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        {Object.keys(prompts).length === 0 && !loading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Settings2 className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Nenhum prompt cadastrado no sistema.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
