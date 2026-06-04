'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft, Save, Sparkles, Download, FileText, RefreshCw,
  CheckCircle2, AlertCircle, Copy
} from "lucide-react";

interface Secao {
  nome: string;
  rotulo: string;
  conteudo: string;
  editavel: boolean;
}

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  propostaUsuario: string;
  resumoExecutivo: string;
  justificativa: string;
  objetivos: string;
  metodologia: string;
  resultadosEsperados: string;
  cronograma: string;
  orcamentoDetalhado: string;
  valorSolicitado: number;
  prazoMeses: number;
  equipe: any[];
  criteriosAtendidos: string[];
  criteriosPendentes: string[];
  scoreCompliance: number;
  versao: number;
  editable?: {
    titulo?: string;
    orgao?: string;
    valor?: number;
  };
}

const secoes: Secao[] = [
  { nome: 'resumoExecutivo', rotulo: 'Resumo Executivo', conteudo: '', editavel: true },
  { nome: 'justificativa', rotulo: 'Justificativa', conteudo: '', editavel: true },
  { nome: 'objetivos', rotulo: 'Objetivos', conteudo: '', editavel: true },
  { nome: 'metodologia', rotulo: 'Metodologia', conteudo: '', editavel: true },
  { nome: 'resultadosEsperados', rotulo: 'Resultados Esperados', conteudo: '', editavel: true },
  { nome: 'cronograma', rotulo: 'Cronograma', conteudo: '', editavel: true },
  { nome: 'orcamentoDetalhado', rotulo: 'Orcamento Detalhado', conteudo: '', editavel: true },
];

function safeParse(val: any): any {
  if (typeof val !== 'string') return val;
  try {
    let parsed = JSON.parse(val);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return val;
  }
}

function OrcamentoVisualizacao({ data }: { data: any }) {
  if (!data) return <p className="text-muted-foreground">Nenhum orçamento definido</p>;

  const categorias = ['administracao', 'divulgacao', 'equipe', 'materiais', 'outros'];

  return (
    <div className="space-y-2">
      <div className="hidden md:block">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-2 border">Categoria</th>
              <th className="text-right p-2 border">Valor</th>
              <th className="text-left p-2 border">Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat) => (
              <tr key={cat} className="border-b">
                <td className="p-2 capitalize font-medium">{cat}</td>
                <td className="p-2 text-right">
                  {data[cat]?.valor ? `R$ ${Number(data[cat].valor).toLocaleString('pt-BR')}` : '-'}
                </td>
                <td className="p-2 text-muted-foreground text-xs">{data[cat]?.justificativa || '-'}</td>
              </tr>
            ))}
            <tr className="bg-primary/10 font-bold">
              <td className="p-2">TOTAL</td>
              <td className="p-2 text-right">
                {data.total ? `R$ ${Number(data.total).toLocaleString('pt-BR')}` : '-'}
              </td>
              <td className="p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {categorias.map((cat) => (
          <div key={cat} className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="capitalize font-medium text-sm">{cat}</span>
              <span className="font-bold text-sm">
                {data[cat]?.valor ? `R$ ${Number(data[cat].valor).toLocaleString('pt-BR')}` : '-'}
              </span>
            </div>
            {data[cat]?.justificativa && (
              <p className="text-xs text-muted-foreground">{data[cat].justificativa}</p>
            )}
          </div>
        ))}
        <div className="p-3 bg-primary/10 rounded-lg font-bold text-center">
          TOTAL: R$ {data?.total?.toLocaleString('pt-BR') || '0'}
        </div>
      </div>
    </div>
  );
}

function OrcamentoEditavel({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const categorias = ['administracao', 'divulgacao', 'equipe', 'materiais', 'outros'];

  const handleChange = (cat: string, field: string, value: string | number) => {
    const newData = { ...data };
    if (!newData[cat]) {
      newData[cat] = { valor: 0, justificativa: '' };
    }
    newData[cat][field] = value;

    let total = 0;
    categorias.forEach(c => {
      if (newData[c]?.valor) {
        total += Number(newData[c].valor);
      }
    });
    newData.total = total;

    onChange(newData);
  };

  return (
    <div className="space-y-3">
      {categorias.map((cat) => (
        <div key={cat} className="p-3 bg-muted rounded-lg space-y-2">
          <div className="font-medium capitalize text-sm">{cat}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Valor R$"
              value={data?.[cat]?.valor || ''}
              onChange={(e) => handleChange(cat, 'valor', parseFloat(e.target.value) || 0)}
              className="text-right"
            />
            <Input
              placeholder="Justificativa do gasto..."
              value={data?.[cat]?.justificativa || ''}
              onChange={(e) => handleChange(cat, 'justificativa', e.target.value)}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-end p-3 bg-primary/10 rounded-lg font-bold">
        TOTAL: R$ {data?.total?.toLocaleString('pt-BR') || '0'}
      </div>
    </div>
  );
}

function ResultadosVisualizacao({ data }: { data: any }) {
  if (!data) return <p className="text-muted-foreground">Nenhum resultado definido</p>;

  const horizontes = [
    { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)', cor: 'bg-success/10 border-success/20', corTexto: 'text-success' },
    { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)', cor: 'bg-warning/10 border-warning/20', corTexto: 'text-warning' },
    { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)', cor: 'bg-primary/10 border-primary/20', corTexto: 'text-primary' },
  ];

  return (
    <div className="space-y-4">
      {horizontes.map((h) => (
        <div key={h.key} className={`p-4 border rounded-lg ${h.cor}`}>
          <h4 className={`font-semibold ${h.corTexto} mb-2`}>{h.label}</h4>
          <p className={`${h.corTexto} mb-3 text-sm`}>{data[h.key]?.descricao || '-'}</p>
          {data[h.key]?.indicadores && Array.isArray(data[h.key].indicadores) && data[h.key].indicadores.length > 0 && (
            <div className="space-y-2 mt-2">
              {data[h.key].indicadores.map((ind: any, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row sm:gap-4 text-sm gap-1">
                  <span className="font-medium text-muted-foreground">Indicador:</span>
                  <span className="flex-1">{ind.indicador}</span>
                  <span className="font-medium text-muted-foreground">Meta:</span>
                  <span>{ind.meta}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResultadosEditavel({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const horizontes = [
    { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)' },
    { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)' },
    { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)' },
  ];

  const handleDescricaoChange = (key: string, value: string) => {
    const newData = { ...data };
    if (!newData[key]) {
      newData[key] = { descricao: '', indicadores: [] };
    }
    newData[key].descricao = value;
    onChange(newData);
  };

  const handleIndicadorChange = (key: string, index: number, field: string, value: string) => {
    const newData = { ...data };
    if (!newData[key] || !newData[key].indicadores) {
      newData[key] = { descricao: newData[key]?.descricao || '', indicadores: [] };
    }
    if (!newData[key].indicadores[index]) {
      newData[key].indicadores[index] = { indicador: '', meta: '' };
    }
    newData[key].indicadores[index][field] = value;
    onChange(newData);
  };

  const addIndicador = (key: string) => {
    const newData = { ...data };
    if (!newData[key]) {
      newData[key] = { descricao: '', indicadores: [] };
    }
    if (!newData[key].indicadores) {
      newData[key].indicadores = [];
    }
    newData[key].indicadores.push({ indicador: '', meta: '' });
    onChange(newData);
  };

  const removeIndicador = (key: string, index: number) => {
    const newData = { ...data };
    if (newData[key]?.indicadores) {
      newData[key].indicadores = newData[key].indicadores.filter((_: any, i: number) => i !== index);
    }
    onChange(newData);
  };

  return (
    <div className="space-y-4">
      {horizontes.map((h) => (
        <div key={h.key} className="p-4 border rounded-lg bg-muted">
          <h4 className="font-semibold text-foreground mb-3">{h.label}</h4>
          <Textarea
            placeholder="Descreva os resultados esperados..."
            value={data?.[h.key]?.descricao || ''}
            onChange={(e) => handleDescricaoChange(h.key, e.target.value)}
            className="mb-3 min-h-[80px]"
          />
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Indicadores e Metas:</label>
            {(data?.[h.key]?.indicadores || []).map((ind: any, i: number) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input
                  placeholder="Indicador"
                  value={ind.indicador || ''}
                  onChange={(e) => handleIndicadorChange(h.key, i, 'indicador', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Meta"
                  value={ind.meta || ''}
                  onChange={(e) => handleIndicadorChange(h.key, i, 'meta', e.target.value)}
                  className="sm:w-40"
                />
                <Button variant="ghost" size="sm" onClick={() => removeIndicador(h.key, i)} className="touch-target">
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addIndicador(h.key)}>
              + Adicionar Indicador
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjetoEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [gerandoSecao, setGerandoSecao] = useState<string | null>(null);

  const [propostaUsuario, setPropostaUsuario] = useState('');
  const [secoesData, setSecoesData] = useState<Record<string, string>>({});
  const [editandoObjetivos, setEditandoObjetivos] = useState(false);
  const [incluirEquipe, setIncluirEquipe] = useState(false);
  const [editandoOrcamento, setEditandoOrcamento] = useState(false);
  const [editandoResultados, setEditandoResultados] = useState(false);

  const [equipeData, setEquipeData] = useState<any[]>([]);
  const [orcamentoData, setOrcamentoData] = useState<any>(null);
  const [resultadosData, setResultadosData] = useState<any>(null);

  useEffect(() => {
    setProjetoId(params.id);
  }, [params.id]);

  const fetchProjeto = useCallback(async () => {
    if (!projetoId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/projetos/${projetoId}`);
      if (!res.ok) throw new Error('Falha ao buscar projeto');
      const data = await res.json();

      const proj = data.data;
      setProjeto(proj);

      setPropostaUsuario(proj.propostaUsuario || '');

      const secoesMap: Record<string, string> = {};
      secoes.forEach(s => {
        secoesMap[s.nome] = (proj as any)[s.nome] || '';
      });
      setSecoesData(secoesMap);

      if (proj.equipe) {
        try {
          const equipe = typeof proj.equipe === 'string' ? JSON.parse(proj.equipe) : proj.equipe;
          setEquipeData(Array.isArray(equipe) ? equipe : []);
          setIncluirEquipe(equipe.length > 0);
        } catch {
          setEquipeData([]);
        }
      }

      if (proj.orcamentoDetalhado) {
        try {
          const orcamento = safeParse(proj.orcamentoDetalhado);
          setOrcamentoData(orcamento);
        } catch {
          setOrcamentoData(null);
        }
      }

      if (proj.resultadosEsperados) {
        try {
          const resultados = safeParse(proj.resultadosEsperados);
          setResultadosData(resultados);
        } catch {
          setResultadosData(null);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar projeto:', err);
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    fetchProjeto();
  }, [fetchProjeto]);

  const handleSalvar = async () => {
    if (!projetoId) return;

    setSaving(true);
    try {
      const updateData: any = { propostaUsuario };

      secoes.forEach(s => {
        if (s.nome === 'orcamentoDetalhado' && orcamentoData) {
          updateData[s.nome] = JSON.stringify(orcamentoData);
        } else if (s.nome === 'resultadosEsperados' && resultadosData) {
          updateData[s.nome] = JSON.stringify(resultadosData);
        } else {
          updateData[s.nome] = secoesData[s.nome] || '';
        }
      });

      if (incluirEquipe) {
        updateData.equipe = JSON.stringify(equipeData);
      }

      await fetch(`/api/v1/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      await fetchProjeto();
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGerarCompleto = async () => {
    if (!projetoId) return;

    setGerando(true);
    try {
      const res = await fetch(`/api/v1/projetos/${projetoId}/gerar`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao gerar proposta');
      }

      await fetchProjeto();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleRegerarSecao = async (nome: string) => {
    alert('Regeneracao de secao especifica sera implementada proxima fase');
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  if (!projeto) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Projeto nao encontrado</p>
          <Button variant="outline" onClick={() => router.push('/projetos')} className="mt-4">
            Voltar para projetos
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/projetos')} className="touch-target -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{projeto.titulo}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={
                  projeto.status === 'gerado' ? 'bg-primary/10 text-primary' :
                  projeto.status === 'rascunho' ? 'bg-muted text-muted-foreground' :
                  'bg-success/10 text-success'
                }>
                  {projeto.status}
                </Badge>
                {projeto.scoreCompliance > 0 && (
                  <span className={`text-sm flex items-center gap-1 ${
                    projeto.scoreCompliance >= 70 ? 'text-success' : 'text-warning'
                  }`}>
                    {projeto.scoreCompliance >= 70 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {projeto.scoreCompliance}%
                  </span>
                )}
                {projeto.versao && <span className="text-sm text-muted-foreground">v{projeto.versao}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" onClick={handleSalvar} disabled={saving} className="touch-target">
              <Save className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{saving ? 'Salvando...' : 'Salvar'}</span>
              <span className="sm:hidden">{saving ? '...' : 'Salvar'}</span>
            </Button>
            <Button onClick={handleGerarCompleto} disabled={gerando} className="touch-target">
              {gerando ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Gerando...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Gerar Proposta</span>
                  <span className="sm:hidden">Gerar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Proposta Textarea */}
        <Card>
          <CardHeader>
            <CardTitle>Descreva sua Proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva sua ideia de projeto aqui... Quanto mais detalhes você fornecer, melhor será a geração da proposta. Inclua informações sobre o problema que deseja resolver, a abordagem proposta, o público-alvo, e qualquer outra informação relevante."
              value={propostaUsuario}
              onChange={(e) => setPropostaUsuario(e.target.value)}
              className="min-h-[250px] sm:min-h-[350px] text-base resize-y"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Dica: Inclua detalhes sobre o problema, objetivos, metodologia esperada, e qualquer restrição ou requisito especial.
            </p>
          </CardContent>
        </Card>

        {/* Criteria Cards */}
        {projeto.status === 'gerado' && (
          <div className="space-y-4">
            {projeto.criteriosAtendidos && projeto.criteriosAtendidos.length > 0 && (
              <Card className="border-success/20 bg-success/5">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-success mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Critérios Atendidos ({projeto.criteriosAtendidos.length})
                  </h3>
                  <ul className="text-sm text-success/80 space-y-1">
                    {projeto.criteriosAtendidos.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {projeto.criteriosPendentes && projeto.criteriosPendentes.length > 0 && (
              <Card className="border-warning/20 bg-warning/5">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Critérios Pendentes ({projeto.criteriosPendentes.length})
                  </h3>
                  <ul className="text-sm text-warning/80 space-y-1">
                    {projeto.criteriosPendentes.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Seções da Proposta</h2>

          {secoes.map((secao) => {
            const conteudo = secoesData[secao.nome] || '';

            return (
              <Card key={secao.nome}>
                <CardHeader className="py-3 px-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{secao.rotulo}</CardTitle>
                      {conteudo && (
                        <Badge variant="default" className="text-xs">
                          {conteudo.length} chars
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
                      {conteudo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyToClipboard(conteudo)}
                          className="touch-target"
                        >
                          <Copy className="w-4 h-4" />
                          <span className="ml-1 hidden sm:inline">Copiar</span>
                        </Button>
                      )}
                      {secao.nome === 'objetivos' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditandoObjetivos(!editandoObjetivos)}
                          className="touch-target"
                        >
                          {editandoObjetivos ? 'Visualizar' : 'Editar JSON'}
                        </Button>
                      )}
                      {secao.nome === 'orcamentoDetalhado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditandoOrcamento(!editandoOrcamento)}
                          className="touch-target"
                        >
                          {editandoOrcamento ? 'Visualizar' : 'Editar'}
                        </Button>
                      )}
                      {secao.nome === 'resultadosEsperados' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditandoResultados(!editandoResultados)}
                          className="touch-target"
                        >
                          {editandoResultados ? 'Visualizar' : 'Editar'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegerarSecao(secao.nome)}
                        disabled={gerandoSecao === secao.nome}
                        className="touch-target"
                      >
                        <RefreshCw className={`w-4 h-4 ${gerandoSecao === secao.nome ? 'animate-spin' : ''}`} />
                        <span className="ml-1 hidden sm:inline">Regenerar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/projetos/${projetoId}/export?secao=${secao.nome}`, '_blank')}
                        className="touch-target"
                      >
                        <Download className="w-4 h-4" />
                        <span className="ml-1 hidden sm:inline">Exportar</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 px-4 pb-4">
                  {secao.nome === 'objetivos' && conteudo && !editandoObjetivos ? (
                    <div className="space-y-4">
                      {(() => {
                        try {
                          const obj = typeof conteudo === 'string' ? JSON.parse(conteudo) : conteudo;
                          return (
                            <>
                              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                <h4 className="font-semibold text-primary mb-2">Objetivo Geral</h4>
                                <p className="text-primary/80">{obj.geral}</p>
                              </div>
                              {obj.especificos && Array.isArray(obj.especificos) && (
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-foreground">Objetivos Específicos</h4>
                                  {obj.especificos.map((oe: any, i: number) => (
                                    <div key={i} className="p-3 bg-muted border border-border rounded-lg">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="default" className="text-xs">{oe.cod}</Badge>
                                      </div>
                                      <p className="text-foreground mb-2">{oe.descricao}</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <span className="font-medium text-muted-foreground">Indicador:</span> {oe.indicador}
                                        </div>
                                        <div>
                                          <span className="font-medium text-muted-foreground">Meta:</span> {oe.meta}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        } catch {
                          return <Textarea value={conteudo} readOnly className="min-h-[200px] font-mono text-sm" />;
                        }
                      })()}
                    </div>
                  ) : secao.nome === 'orcamentoDetalhado' && conteudo && !editandoOrcamento ? (
                    <OrcamentoVisualizacao data={orcamentoData} />
                  ) : secao.nome === 'orcamentoDetalhado' && editandoOrcamento ? (
                    <OrcamentoEditavel
                      data={orcamentoData}
                      onChange={setOrcamentoData}
                    />
                  ) : secao.nome === 'resultadosEsperados' && conteudo && !editandoResultados ? (
                    <div className="space-y-4">
                      {(() => {
                        try {
                          const obj = safeParse(conteudo);
                          const horizontes = [
                            { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)', cor: 'bg-success/10 border-success/20', corTexto: 'text-success' },
                            { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)', cor: 'bg-warning/10 border-warning/20', corTexto: 'text-warning' },
                            { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)', cor: 'bg-primary/10 border-primary/20', corTexto: 'text-primary' },
                          ];
                          return (
                            <>
                              {horizontes.map((h) => (
                                <div key={h.key} className={`p-4 border rounded-lg ${h.cor}`}>
                                  <h4 className={`font-semibold ${h.corTexto} mb-2`}>{h.label}</h4>
                                  <p className={`${h.corTexto} mb-3 text-sm`}>{obj[h.key]?.descricao || '-'}</p>
                                  {obj[h.key]?.indicadores && Array.isArray(obj[h.key].indicadores) && obj[h.key].indicadores.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                      {obj[h.key].indicadores.map((ind: any, i: number) => (
                                        <div key={i} className="flex flex-col sm:flex-row sm:gap-4 text-sm gap-1">
                                          <span className="font-medium text-muted-foreground">Indicador:</span>
                                          <span className="flex-1">{ind.indicador}</span>
                                          <span className="font-medium text-muted-foreground">Meta:</span>
                                          <span>{ind.meta}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </>
                          );
                        } catch {
                          return <Textarea value={conteudo} readOnly className="min-h-[200px] font-mono text-sm" />;
                        }
                      })()}
                    </div>
                  ) : secao.nome === 'resultadosEsperados' && editandoResultados ? (
                    <ResultadosEditavel
                      data={safeParse(conteudo)}
                      onChange={(val) => {
                        setResultadosData(val);
                        setSecoesData(prev => ({ ...prev, resultadosEsperados: JSON.stringify(val) }));
                      }}
                    />
                  ) : (
                    <Textarea
                      value={conteudo}
                      onChange={(e) => setSecoesData(prev => ({ ...prev, [secao.nome]: e.target.value }))}
                      placeholder={`Conteúdo da seção ${secao.rotulo}...`}
                      className="min-h-[150px] sm:min-h-[200px] font-mono text-sm resize-y"
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Team Section */}
        {projeto.status === 'gerado' && (
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <CardTitle className="text-base">Equipe do Projeto</CardTitle>
                {equipeData.length > 0 && (
                  <Badge variant="default" className="text-xs w-fit">
                    {equipeData.length} membros
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="space-y-3">
                {equipeData.map((membro: any, i: number) => (
                  <div key={i} className="p-3 bg-muted border border-border rounded-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                        <Input
                          value={membro.nome || ''}
                          onChange={(e) => {
                            const newEquipe = [...equipeData];
                            newEquipe[i].nome = e.target.value;
                            setEquipeData(newEquipe);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Função</label>
                        <Input
                          value={membro.funcao || ''}
                          onChange={(e) => {
                            const newEquipe = [...equipeData];
                            newEquipe[i].funcao = e.target.value;
                            setEquipeData(newEquipe);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Qualificação</label>
                        <Input
                          value={membro.qualificacao || ''}
                          onChange={(e) => {
                            const newEquipe = [...equipeData];
                            newEquipe[i].qualificacao = e.target.value;
                            setEquipeData(newEquipe);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Dedicação</label>
                        <Input
                          value={membro.dedicacao || ''}
                          onChange={(e) => {
                            const newEquipe = [...equipeData];
                            newEquipe[i].dedicacao = e.target.value;
                            setEquipeData(newEquipe);
                          }}
                          placeholder="ex: 20h/semana"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEquipeData([...equipeData, { nome: '', funcao: '', qualificacao: '', dedicacao: '' }]);
                  }}
                >
                  + Adicionar Membro
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEquipeData(equipeData.slice(0, -1));
                  }}
                  disabled={equipeData.length === 0}
                >
                  Remover Último
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Include Team Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="incluirEquipe"
                checked={incluirEquipe}
                onChange={(e) => setIncluirEquipe(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="incluirEquipe" className="text-sm font-medium cursor-pointer">
                Incluir equipe na proposta
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        {projeto.status === 'gerado' && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4" />
                Exportar Proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/projetos/${projetoId}/export?formato=markdown`, '_blank')}
                  className="touch-target"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Markdown
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/projetos/${projetoId}/export?formato=pdf`, '_blank')}
                  className="touch-target"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}