'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AREAS_TEMATICAS, NIVEIS_PROJETO } from '@/lib/analise-cientifica/prompts';

export default function NovoProjetoCientificoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editaisDisponiveis, setEditaisDisponiveis] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    titulo: '',
    areaTematica: '',
    nivel: '',
    editalId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchEditais = async () => {
      try {
        const res = await fetch(`/api/v1/editais?statusAnalise=analisado&limit=100&categoriaArea=Pesquisa&t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setEditaisDisponiveis(data.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar editais de Pesquisa:', err);
      }
    };
    fetchEditais();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar
    const newErrors: Record<string, string> = {};
    if (!formData.titulo || formData.titulo.length < 20) {
      newErrors.titulo = 'Título deve ter no mínimo 20 caracteres';
    }
    if (!formData.areaTematica) {
      newErrors.areaTematica = 'Selecione uma área temática';
    }
    if (!formData.nivel) {
      newErrors.nivel = 'Selecione um nível de projeto';
    }
    if (!formData.editalId) {
      newErrors.editalId = 'Selecione um edital';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/analise-cientifica/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          router.push(`/analise-cientifica/projetos/${result.data.id}`);
        }
      }
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/analise-cientifica/projetos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Novo Projeto Científico
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Crie um novo projeto científico para editais de pesquisa
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Título */}
              <div className="space-y-2">
                <label htmlFor="titulo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Título do Projeto <span className="text-red-500">*</span>
                </label>
                <Input
                  id="titulo"
                  placeholder="Digite o título do projeto (mínimo 20 caracteres)"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className={errors.titulo ? 'border-red-500' : ''}
                />
                {errors.titulo && (
                  <p className="text-sm text-red-500">{errors.titulo}</p>
                )}
                <p className="text-sm text-slate-500">
                  {formData.titulo.length}/300 caracteres (mínimo 20)
                </p>
              </div>

              {/* Seleção de Edital */}
              <div className="space-y-2">
                <label htmlFor="editalId" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Edital de Pesquisa <span className="text-red-500">*</span>
                </label>
                {editaisDisponiveis.length === 0 ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
                    Nenhum edital de pesquisa aberto encontrado. <Link href="/editais" className="underline font-semibold text-blue-600 dark:text-blue-400">Cadastre ou analise editais primeiro.</Link>
                  </div>
                ) : (
                  <select
                    id="editalId"
                    value={formData.editalId}
                    onChange={(e) => setFormData({ ...formData, editalId: e.target.value })}
                    className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.editalId ? 'border-red-500' : ''
                    }`}
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
                {errors.editalId && (
                  <p className="text-sm text-red-500">{errors.editalId}</p>
                )}
              </div>

              {/* Área Temática */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Área Temática <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AREAS_TEMATICAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setFormData({ ...formData, areaTematica: area })}
                      className={`p-3 text-left text-sm rounded-lg border transition-colors ${formData.areaTematica === area
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
                {errors.areaTematica && (
                  <p className="text-sm text-red-500">{errors.areaTematica}</p>
                )}
              </div>

              {/* Nível do Projeto */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nível do Projeto <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {NIVEIS_PROJETO.map((nivel) => (
                    <button
                      key={nivel.valor}
                      type="button"
                      onClick={() => setFormData({ ...formData, nivel: nivel.valor })}
                      className={`p-3 text-left text-sm rounded-lg border transition-colors ${formData.nivel === nivel.valor
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                      {nivel.label}
                    </button>
                  ))}
                </div>
                {errors.nivel && (
                  <p className="text-sm text-red-500">{errors.nivel}</p>
                )}
              </div>

              {/* Resumo */}
              <div className="space-y-2">
                <label htmlFor="resumo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Resumo da Proposta
                </label>
                <textarea
                  id="resumo"
                  placeholder="Descreva brevemente a proposta do projeto (opcional)"
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-slate-500">
                  Você poderá editar todas as informações após criar o projeto.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link href="/analise-cientifica/projetos">
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Projeto'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
