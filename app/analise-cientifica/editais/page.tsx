'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ArrowRight,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { formatarDataBr } from '@/lib/utils/formatar-data';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface EditalCientifico {
  id: string;
  titulo: string;
  orgao: string;
  valor: string;
  dataLimite: string;
  areasTematicas: string[];
  link: string;
  destaque?: boolean;
}

// areasTematicas pode vir como array ou como JSON serializado
function lerLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function EditaisCientificosPage() {
  const [editais, setEditais] = useState<EditalCientifico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('todas');

  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [excluindoLote, setExcluindoLote] = useState(false);

  const carregar = useCallback(async (cancelado: () => boolean = () => false) => {
      try {
        const res = await fetch('/api/v1/editais?categoriaArea=Pesquisa&limit=100');
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message || 'Erro ao carregar editais');

        const itens: any[] = json.data ?? [];
        if (cancelado()) return;

        setEditais(
          itens.map((e) => ({
            id: e.id,
            titulo: e.titulo,
            orgao: e.orgao || '',
            valor: e.valor || 'Valor não informado',
            dataLimite: e.dataLimite || '',
            areasTematicas: lerLista(e.areasTematicas),
            link: e.link,
            destaque: e.nivelPontuacao === 'alto',
          }))
        );
      } catch (e: any) {
        if (!cancelado()) setErro(e.message || 'Erro ao carregar editais');
      } finally {
        if (!cancelado()) setLoading(false);
      }
  }, []);

  useEffect(() => {
    let cancelado = false;
    carregar(() => cancelado);
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  const formatDate = (dateString: string) => {
    return formatarDataBr(dateString);
  };

  const getDiasRestantes = (dateString: string) => {
    const hoje = new Date();
    const limite = new Date(dateString);
    if (Number.isNaN(limite.getTime())) return null; // prazo "A consultar" ou data ilegível
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

  // Só conta a seleção do que está visível com os filtros atuais
  const idsVisiveis = filteredEditais.map((e) => e.id);
  const selecionadosVisiveis = idsVisiveis.filter((id) => selecionados.has(id));
  const todosVisiveisSelecionados = idsVisiveis.length > 0 && selecionadosVisiveis.length === idsVisiveis.length;

  const alternarTodos = () => {
    setSelecionados(todosVisiveisSelecionados ? new Set() : new Set(idsVisiveis));
  };

  const alternarSelecao = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  // Exclui todos os selecionados de uma vez
  const confirmarExclusaoLote = async () => {
    const ids = selecionadosVisiveis;
    if (ids.length === 0) return;
    setExcluindoLote(true);
    try {
      const res = await fetch('/api/v1/editais', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error?.message || 'Erro ao excluir os editais selecionados.');
        return;
      }
      const falhas: { id: string }[] = data.data?.falhas ?? [];
      setErro(falhas.length > 0 ? `${falhas.length} edital(is) não puderam ser excluídos.` : null);
      setSelecionados(new Set(falhas.map((f) => f.id)));
      await carregar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao excluir os editais selecionados.');
    } finally {
      setExcluindoLote(false);
      setConfirmarLote(false);
    }
  };

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
        {erro && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={todosVisiveisSelecionados}
                  ref={(el) => { if (el) el.indeterminate = selecionadosVisiveis.length > 0 && !todosVisiveisSelecionados; }}
                  onChange={alternarTodos}
                  aria-label="Selecionar todos os editais da lista"
                />
                {selecionadosVisiveis.length > 0
                  ? `${selecionadosVisiveis.length} de ${idsVisiveis.length} selecionados`
                  : `Selecionar todos (${idsVisiveis.length})`}
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={selecionadosVisiveis.length === 0 || excluindoLote}
                onClick={() => setConfirmarLote(true)}
                className="gap-2 text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Excluir selecionados
              </Button>
            </div>
            {filteredEditais.map((edital) => {
              const diasRestantes = getDiasRestantes(edital.dataLimite);
              return (
                <Card key={edital.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selecionados.has(edital.id)}
                            onChange={() => alternarSelecao(edital.id)}
                            aria-label={`Selecionar "${edital.titulo}"`}
                          />
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
                          <div className={`flex items-center gap-1 ${diasRestantes !== null && diasRestantes <= 30 ? 'text-red-500 font-medium' : ''
                            }`}>
                            <Clock className="h-4 w-4" />
                            {diasRestantes === null
                              ? 'Prazo a confirmar'
                              : diasRestantes > 0
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
      <ConfirmDialog
        aberto={confirmarLote}
        titulo="Excluir editais selecionados"
        mensagem={`Excluir ${selecionadosVisiveis.length} edital(is)? Os PDFs serão removidos. Os já vencidos não voltam mais; os demais podem voltar numa busca futura se reaparecerem num portal.`}
        textoConfirmar={`Excluir ${selecionadosVisiveis.length}`}
        perigoso
        carregando={excluindoLote}
        onConfirmar={confirmarExclusaoLote}
        onCancelar={() => setConfirmarLote(false)}
      />
    </MainLayout>
  );
}
