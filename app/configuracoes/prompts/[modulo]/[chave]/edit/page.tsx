'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, RotateCcw, CheckCircle2, FileText } from 'lucide-react';

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

export default function EditarPromptPage() {
  const router = useRouter();
  const params = useParams();
  const modulo = params.modulo as string;
  const chave = params.chave as string;

  const [prompt, setPrompt] = useState<PromptCompleto | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [showJustificativa, setShowJustificativa] = useState(false);

  const fetchPrompt = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/prompts?modulo=${modulo}&chave=${chave}`);
      if (!res.ok) throw new Error('Falha ao buscar prompt');
      const data = await res.json();
      setPrompt(data.data);
      setConteudo(data.data.conteudo);
    } catch (err: any) {
      console.error('Erro ao buscar prompt:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompt();
  }, [modulo, chave]);

  const handleSalvar = async () => {
    if (!conteudo.trim()) {
      alert('O conteúdo do prompt não pode estar vazio');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo,
          chave,
          conteudo,
          justificativa: justificativa || undefined,
          criadoPor: 'admin',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao salvar prompt');
      }

      alert('Prompt salvo com sucesso!');
      setJustificativa('');
      setShowJustificativa(false);
      fetchPrompt();
    } catch (err: any) {
      console.error('Erro ao salvar prompt:', err);
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurarPadrao = async () => {
    if (!prompt) return;

    if (!confirm('Tem certeza que deseja restaurar o prompt padrão? Isso irá desativar a versão customizada atual.')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo,
          chave,
          conteudo: prompt.conteudo,
          justificativa: 'Restaurado para padrão do sistema',
          criadoPor: 'admin',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao restaurar prompt');
      }

      alert('Prompt restaurado para o padrão do sistema!');
      fetchPrompt();
    } catch (err: any) {
      console.error('Erro ao restaurar prompt:', err);
      alert(`Erro ao restaurar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Carregando prompt...</p>
        </div>
      </MainLayout>
    );
  }

  if (!prompt) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Prompt não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/configuracoes/prompts')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h2 className="dashboard-title">
            Editar Prompt: {chaveLabels[chave] || chave}
          </h2>
          <p className="dashboard-subtitle">
            Módulo: {moduloLabels[modulo] || modulo}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <CardTitle>Conteúdo do Prompt</CardTitle>
              </div>
              {prompt.customizado && (
                <Badge variant="default" className="bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Customizado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Justificativa da Alteração (opcional)
              </label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo desta alteração..."
                className="h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Conteúdo do Prompt
              </label>
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                className="h-[600px] font-mono text-sm"
                placeholder="Conteúdo do prompt..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSalvar}
                disabled={saving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              {prompt.customizado && (
                <Button
                  variant="outline"
                  onClick={handleRestaurarPadrao}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrão
                </Button>
              )}
            </div>

            <div className="text-sm text-gray-500 pt-4 border-t">
              <p>
                <strong>Status atual:</strong>{' '}
                {prompt.customizado ? 'Customizado' : 'Padrão do sistema'}
              </p>
              {prompt.atualizadoEm && (
                <p>
                  <strong>Última atualização:</strong>{' '}
                  {new Date(prompt.atualizadoEm).toLocaleString('pt-BR')}
                </p>
              )}
              {prompt.criadoPor && (
                <p>
                  <strong>Por:</strong> {prompt.criadoPor}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
