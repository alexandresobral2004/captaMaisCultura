'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ProcessingOverlay } from '@/components/ui/processing-overlay';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Users,
  UserPlus,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface ObjetivoEspecifico {
  cod: string;
  descricao: string;
  indicador: string;
  meta: string;
}

interface Pesquisador {
  nome: string;
  cpf: string;
  titulacao: string;
  vinculo: string;
  funcao: string;
  lattes: string;
}

interface SecaoDinamica {
  id: string;
  chave: string;
  titulo: string;
  conteudo: string;
  completa: boolean;
  editavel: boolean;
  ordem: number;
}

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  areaTematica: string;
  nivel: string;
  resumoExecutivo: string;
  justificativa: string;
  objetivos: {
    geral: string;
    especificos: ObjetivoEspecifico[];
  };
  metodologia: string;
  resultadosEsperados: string;
  referencias: string;
  secoesDinamicas: SecaoDinamica[];
  titulosPersonalizados: Record<string, string>;
  pesquisadoresProponentes: Pesquisador[];
  scoreCompliance?: number;
}

export default function EditorProjetoCientificoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['resumo', 'justificativa']));
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conteudo' | 'proponentes'>('conteudo');

  // Novo pesquisador para o formulário
  const [novoProponente, setNovoProponente] = useState<Pesquisador>({
    nome: '',
    cpf: '',
    titulacao: 'Doutorado',
    vinculo: '',
    funcao: 'Coordenador',
    lattes: ''
  });

  const parseProjeto = (proj: any): Projeto => {
    let objetivos = proj.objetivos;
    if (typeof objetivos === 'string') {
      try {
        objetivos = JSON.parse(objetivos);
      } catch {
        objetivos = { geral: objetivos, especificos: [] };
      }
    }

    let proponentesList: Pesquisador[] = [];
    if (proj.pesquisadoresProponentes) {
      try {
        proponentesList = typeof proj.pesquisadoresProponentes === 'string'
          ? JSON.parse(proj.pesquisadoresProponentes)
          : proj.pesquisadoresProponentes;
      } catch {
        proponentesList = [];
      }
    }

    let titulosMap: Record<string, string> = {};
    if (proj.titulosPersonalizados) {
      try {
        titulosMap = typeof proj.titulosPersonalizados === 'string'
          ? JSON.parse(proj.titulosPersonalizados)
          : proj.titulosPersonalizados;
      } catch {
        titulosMap = {};
      }
    }

    let secoesList: SecaoDinamica[] = [];
    if (proj.secoesDinamicas) {
      try {
        secoesList = typeof proj.secoesDinamicas === 'string'
          ? JSON.parse(proj.secoesDinamicas)
          : proj.secoesDinamicas;
      } catch {
        secoesList = [];
      }
    }

    // Se a lista estiver vazia, carrega a lista padrão ordenada
    if (secoesList.length === 0) {
      secoesList = [
        { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: proj.resumoExecutivo || '', completa: !!proj.resumoExecutivo, editavel: true, ordem: 0 },
        { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: proj.justificativa || '', completa: !!proj.justificativa, editavel: true, ordem: 1 },
        { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: true, editavel: true, ordem: 2 },
        { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: proj.metodologia || '', completa: !!proj.metodologia, editavel: true, ordem: 3 },
        { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: proj.resultadosEsperados || '', completa: !!proj.resultadosEsperados, editavel: true, ordem: 4 },
        { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: proj.referencias || '', completa: !!proj.referencias, editavel: true, ordem: 5 }
      ];
    }

    // Garante ordenação por ordem
    secoesList.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    return {
      ...proj,
      objetivos: objetivos || { geral: '', especificos: [] },
      pesquisadoresProponentes: proponentesList || [],
      titulosPersonalizados: titulosMap || {},
      secoesDinamicas: secoesList,
      referencias: proj.referencias || ''
    };
  };

  useEffect(() => {
    const fetchProjeto = async () => {
      try {
        const response = await fetch(`/api/analise-cientifica/projetos/${params.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setProjeto(parseProjeto(result.data));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar projeto:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjeto();
  }, [params.id]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!projeto) return;
    setSaving(true);
    try {
      // Sincroniza seções dinamicas de volta para os campos originais do banco para retrocompatibilidade
      let resumo = '';
      let justificativa = '';
      let metodologia = '';
      let resultados = '';
      let referencias = '';

      projeto.secoesDinamicas.forEach(s => {
        if (s.chave === 'resumo') resumo = s.conteudo;
        if (s.chave === 'justificativa') justificativa = s.conteudo;
        if (s.chave === 'metodologia') metodologia = s.conteudo;
        if (s.chave === 'resultados') resultados = s.conteudo;
        if (s.chave === 'referencias') referencias = s.conteudo;
      });

      const payload = {
        ...projeto,
        resumoExecutivo: resumo,
        justificativa: justificativa,
        metodologia: metodologia,
        resultadosEsperados: resultados,
        referencias: referencias,
        objetivos: JSON.stringify(projeto.objetivos),
        pesquisadoresProponentes: JSON.stringify(projeto.pesquisadoresProponentes),
        secoesDinamicas: JSON.stringify(projeto.secoesDinamicas),
        titulosPersonalizados: JSON.stringify(projeto.titulosPersonalizados)
      };

      const response = await fetch(`/api/analise-cientifica/projetos/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProjeto(parseProjeto(result.data));
        }
      }
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (sectionId: string) => {
    if (!projeto) return;

    setGenerating(true);
    setActiveSection(sectionId);

    try {
      const resumoSecao = projeto.secoesDinamicas.find(s => s.chave === 'resumo')?.conteudo || '';
      const justificativaSecao = projeto.secoesDinamicas.find(s => s.chave === 'justificativa')?.conteudo || '';
      const cleanText = (html: string) => html.replace(/<[^>]*>/g, '').trim();
      const propostaParaIA = cleanText(resumoSecao) || cleanText(justificativaSecao) || '';

      const response = await fetch(`/api/analise-cientifica/projetos/${params.id}/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secao: sectionId,
          titulo: projeto.titulo,
          areaTematica: projeto.areaTematica,
          nivel: projeto.nivel,
          propostaUsuario: propostaParaIA
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.conteudo) {
          const updatedProjeto = { ...projeto };
          
          // Atualiza conteúdo na respectiva seção da lista
          updatedProjeto.secoesDinamicas = updatedProjeto.secoesDinamicas.map(s => {
            if (s.chave === sectionId) {
              return { ...s, conteudo: result.data.conteudo };
            }
            return s;
          });

          // Também atualiza o campo raiz
          switch (sectionId) {
            case 'resumo':
              updatedProjeto.resumoExecutivo = result.data.conteudo;
              break;
            case 'justificativa':
              updatedProjeto.justificativa = result.data.conteudo;
              break;
            case 'metodologia':
              updatedProjeto.metodologia = result.data.conteudo;
              break;
            case 'resultados':
              updatedProjeto.resultadosEsperados = result.data.conteudo;
              break;
            case 'referencias':
              updatedProjeto.referencias = result.data.conteudo;
              break;
          }
          setProjeto(updatedProjeto);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error);
    } finally {
      setGenerating(false);
      setActiveSection(null);
    }
  };

  const handleGenerateProposta = async () => {
    if (!projeto) return;

    setGenerating(true);
    try {
      const resumoSecao = projeto.secoesDinamicas.find(s => s.chave === 'resumo')?.conteudo || '';
      const justificativaSecao = projeto.secoesDinamicas.find(s => s.chave === 'justificativa')?.conteudo || '';
      const cleanText = (html: string) => html.replace(/<[^>]*>/g, '').trim();
      const propostaParaIA = cleanText(resumoSecao) || cleanText(justificativaSecao) || '';

      const response = await fetch(`/api/analise-cientifica/projetos/${params.id}/gerar-completo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: projeto.titulo,
          areaTematica: projeto.areaTematica,
          nivel: projeto.nivel,
          propostaUsuario: propostaParaIA
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const parsedData = parseProjeto(result.data);
          setProjeto({
            ...projeto,
            resumoExecutivo: parsedData.resumoExecutivo || projeto.resumoExecutivo,
            justificativa: parsedData.justificativa || projeto.justificativa,
            objetivos: parsedData.objetivos || projeto.objetivos,
            metodologia: parsedData.metodologia || projeto.metodologia,
            resultadosEsperados: parsedData.resultadosEsperados || projeto.resultadosEsperados,
            referencias: parsedData.referencias || projeto.referencias,
            secoesDinamicas: parsedData.secoesDinamicas || projeto.secoesDinamicas
          });
        }
      }
    } catch (error) {
      console.error('Erro ao gerar proposta completa:', error);
    } finally {
      setGenerating(false);
      setActiveSection(null);
    }
  };

  const handleAddProponente = () => {
    if (!projeto || !novoProponente.nome || !novoProponente.cpf) return;
    setProjeto({
      ...projeto,
      pesquisadoresProponentes: [...projeto.pesquisadoresProponentes, novoProponente]
    });
    setNovoProponente({
      nome: '',
      cpf: '',
      titulacao: 'Doutorado',
      vinculo: '',
      funcao: 'Pesquisador',
      lattes: ''
    });
  };

  const handleRemoveProponente = (index: number) => {
    if (!projeto) return;
    const list = [...projeto.pesquisadoresProponentes];
    list.splice(index, 1);
    setProjeto({
      ...projeto,
      pesquisadoresProponentes: list
    });
  };

  // Seções Dinâmicas Handlers
  const handleAddSecaoDinamica = () => {
    if (!projeto) return;
    const newId = `secao_${Date.now()}`;
    const newSecao: SecaoDinamica = {
      id: newId,
      chave: newId,
      titulo: 'Nova Seção Personalizada',
      conteudo: '',
      completa: false,
      editavel: true,
      ordem: projeto.secoesDinamicas.length
    };
    
    setProjeto({
      ...projeto,
      secoesDinamicas: [...projeto.secoesDinamicas, newSecao]
    });

    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(newId);
      return next;
    });
  };

  const handleRemoveSecaoDinamica = (id: string) => {
    if (!projeto) return;
    const list = projeto.secoesDinamicas.filter(s => s.id !== id);
    const reordered = list.map((item, idx) => ({ ...item, ordem: idx }));
    setProjeto({
      ...projeto,
      secoesDinamicas: reordered
    });
  };

  const handleMoveUp = (index: number) => {
    if (!projeto || index === 0) return;
    const list = [...projeto.secoesDinamicas];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    
    const reordered = list.map((item, idx) => ({ ...item, ordem: idx }));
    setProjeto({
      ...projeto,
      secoesDinamicas: reordered
    });
  };

  const handleMoveDown = (index: number) => {
    if (!projeto || index === projeto.secoesDinamicas.length - 1) return;
    const list = [...projeto.secoesDinamicas];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;

    const reordered = list.map((item, idx) => ({ ...item, ordem: idx }));
    setProjeto({
      ...projeto,
      secoesDinamicas: reordered
    });
  };

  const handleRenameSecao = (id: string, newTitle: string) => {
    if (!projeto) return;
    const updated = projeto.secoesDinamicas.map(s => {
      if (s.id === id) return { ...s, titulo: newTitle };
      return s;
    });
    setProjeto({
      ...projeto,
      secoesDinamicas: updated
    });
  };

  const handleUpdateSecaoConteudo = (id: string, newContent: string) => {
    if (!projeto) return;
    const updated = projeto.secoesDinamicas.map(s => {
      if (s.id === id) return { ...s, conteudo: newContent };
      return s;
    });
    setProjeto({
      ...projeto,
      secoesDinamicas: updated
    });
  };

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

  const calcularCompletude = () => {
    if (!projeto) return 0;
    let total = 0;
    let preenchido = 0;

    projeto.secoesDinamicas.forEach(s => {
      total++;
      if (s.chave === 'objetivos') {
        if (projeto.objetivos.geral) preenchido++;
      } else {
        if (s.conteudo) preenchido++;
      }
    });

    return total > 0 ? Math.round((preenchido / total) * 100) : 0;
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
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Projeto não encontrado.</p>
          <Link href="/analise-cientifica/projetos">
            <Button variant="outline" className="mt-4">Voltar para projetos</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const isDefaultSectionKey = (key: string) => {
    return ['resumo', 'justificativa', 'objetivos', 'metodologia', 'resultados', 'referencias'].includes(key);
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/analise-cientifica/projetos">
              <Button variant="ghost" size="sm" className="rounded-xl border border-slate-200 dark:border-slate-800">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  Editar Projeto Científico
                </h1>
                {getStatusBadge(projeto.status)}
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-1 truncate max-w-lg font-medium">
                {projeto.titulo}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/analise-cientifica/projetos/${params.id}/analise`}>
              <Button variant="outline" className="gap-2 rounded-xl bg-white dark:bg-slate-900">
                <Eye className="h-4 w-4 text-violet-500" />
                Analisar Compliance
              </Button>
            </Link>
            <a href={`/api/analise-cientifica/projetos/${params.id}/exportar`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 rounded-xl bg-white dark:bg-slate-900">
                <Download className="h-4 w-4 text-emerald-500" />
                Exportar PDF
              </Button>
            </a>
            <a href={`/api/analise-cientifica/projetos/${params.id}/exportar-docx`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 rounded-xl bg-white dark:bg-slate-900">
                <FileText className="h-4 w-4 text-blue-500" />
                Exportar Word (DOCX)
              </Button>
            </a>
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              onClick={handleGenerateProposta}
              disabled={generating}
              className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white rounded-xl shadow-md shadow-violet-500/10 border-0"
            >
              {generating ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  <span>Gerando Proposta Completa...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>Gerar Proposta Completa</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Bar & Tabs Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm rounded-2xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Completude do Projeto
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  {calcularCompletude()}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    calcularCompletude() >= 70
                      ? 'bg-green-500'
                      : calcularCompletude() >= 50
                        ? 'bg-amber-500'
                        : 'bg-violet-500'
                  }`}
                  style={{ width: `${calcularCompletude()}%` }}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm rounded-2xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <CardContent className="p-5 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 block">
                    Nível de Pesquisa
                  </span>
                  <span className="text-base font-bold capitalize text-slate-900 dark:text-slate-100">
                    {projeto.nivel === 'iniciacao' ? 'Iniciação Científica' : projeto.nivel}
                  </span>
                </div>
                <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-0 rounded-lg">
                  {projeto.areaTematica}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl max-w-md">
          <button
            onClick={() => setActiveTab('conteudo')}
            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'conteudo'
                ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4.5 h-4.5 text-violet-500" />
            Conteúdo Acadêmico
          </button>
          <button
            onClick={() => setActiveTab('proponentes')}
            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'proponentes'
                ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4.5 h-4.5 text-emerald-500" />
            Proponentes
          </button>
        </div>

        {activeTab === 'conteudo' ? (
          /* Editor Sections with 3cm margins */
          <div className="flex flex-col">
            {projeto.secoesDinamicas.map((secao, index) => {
              const isExpanded = expandedSections.has(secao.id);
              const isDefault = isDefaultSectionKey(secao.chave);

              return (
                <Card 
                  key={secao.id}
                  style={{ marginBottom: '3cm' }} 
                  className="shadow-sm rounded-2xl border-slate-200 dark:border-slate-800"
                >
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection(secao.id)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-500 shrink-0" />
                        )}
                        <div className="w-full flex items-center gap-2">
                          <input
                            type="text"
                            value={secao.titulo}
                            onChange={(e) => handleRenameSecao(secao.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-lg text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-violet-500 focus:outline-none py-0.5 transition-all w-full max-w-md"
                            placeholder="Título da Seção"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Move Up/Down controls */}
                        <div className="flex items-center gap-0.5 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveUp(index);
                            }}
                            disabled={index === 0}
                            className="p-1 h-7 w-7 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-md"
                            title="Subir seção"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveDown(index);
                            }}
                            disabled={index === projeto.secoesDinamicas.length - 1}
                            className="p-1 h-7 w-7 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-md"
                            title="Descer seção"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* AI Generate Button (for non-object sections) */}
                        {secao.chave !== 'objetivos' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerate(secao.chave);
                            }}
                            disabled={generating}
                            className="gap-1.5 rounded-xl text-violet-600 hover:text-violet-700 bg-violet-50/50 hover:bg-violet-50 dark:bg-violet-950/20 dark:hover:bg-violet-950/30 border-0"
                          >
                            <Sparkles className="h-4 w-4" />
                            {generating && activeSection === secao.chave ? 'Gerando...' : 'IA Aprimorar'}
                          </Button>
                        )}

                        {/* Custom Section Delete button */}
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSecaoDinamica(secao.id);
                            }}
                            className="p-2 text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                            title="Excluir Seção"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </Button>
                        )}

                        {/* Complete badge */}
                        {(secao.chave === 'objetivos' ? (projeto.objetivos.geral) : secao.conteudo) ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                    </div>
                    <hr className="border-slate-200 dark:border-slate-800 mt-3" />
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-2 pb-6">
                      {secao.chave === 'objetivos' ? (
                        /* Special Objectives editor view */
                        <div className="space-y-6 pt-2 pb-6">
                          <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                              Objetivo Geral
                            </label>
                            <RichTextEditor
                              value={projeto.objetivos.geral}
                              onChange={(val) => setProjeto({
                                ...projeto,
                                objetivos: { ...projeto.objetivos, geral: val }
                              })}
                              placeholder="Descreva o objetivo geral do projeto científico..."
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Objetivos Específicos
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newObj = {
                                    cod: `OE${projeto.objetivos.especificos.length + 1}`,
                                    descricao: '',
                                    indicador: '',
                                    meta: '',
                                  };
                                  setProjeto({
                                    ...projeto,
                                    objetivos: {
                                      ...projeto.objetivos,
                                      especificos: [...projeto.objetivos.especificos, newObj],
                                    },
                                  });
                                }}
                                className="gap-1.5 rounded-xl"
                              >
                                <Plus className="h-4 w-4" />
                                Adicionar Objetivo
                              </Button>
                            </div>
                            {projeto.objetivos.especificos.length === 0 ? (
                              <p className="text-sm text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-center">
                                Nenhum objetivo específico cadastrado.
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {projeto.objetivos.especificos.map((obj, idx) => (
                                  <div key={idx} className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-900/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                                        Objetivo {obj.cod}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newList = [...projeto.objetivos.especificos];
                                          newList.splice(idx, 1);
                                          setProjeto({
                                            ...projeto,
                                            objetivos: { ...projeto.objetivos, especificos: newList }
                                          });
                                        }}
                                        className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <label className="text-xs font-semibold text-slate-500">Descrição do Objetivo</label>
                                      <RichTextEditor
                                        value={obj.descricao}
                                        onChange={(val) => {
                                          const newList = [...projeto.objetivos.especificos];
                                          newList[idx] = { ...obj, descricao: val };
                                          setProjeto({
                                            ...projeto,
                                            objetivos: { ...projeto.objetivos, especificos: newList },
                                          });
                                        }}
                                        placeholder="Ações específicas para cumprir o objetivo geral..."
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Indicador de Sucesso</label>
                                        <Input
                                          placeholder="Ex: Número de artigos publicados..."
                                          value={obj.indicador}
                                          onChange={(e) => {
                                            const newList = [...projeto.objetivos.especificos];
                                            newList[idx] = { ...obj, indicador: e.target.value };
                                            setProjeto({
                                              ...projeto,
                                              objetivos: { ...projeto.objetivos, especificos: newList },
                                            });
                                          }}
                                          className="rounded-xl"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Meta Esperada</label>
                                        <Input
                                          placeholder="Ex: 2 artigos em revista científica..."
                                          value={obj.meta}
                                          onChange={(e) => {
                                            const newList = [...projeto.objetivos.especificos];
                                            newList[idx] = { ...obj, meta: e.target.value };
                                            setProjeto({
                                              ...projeto,
                                              objetivos: { ...projeto.objetivos, especificos: newList },
                                            });
                                          }}
                                          className="rounded-xl"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Standard Rich Text Editor */
                        <RichTextEditor
                          value={secao.conteudo}
                          onChange={(val) => handleUpdateSecaoConteudo(secao.id, val)}
                          placeholder={`Escreva o conteúdo para a seção ${secao.titulo}...`}
                        />
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Add Custom Section Button */}
            <div className="flex justify-center py-6" style={{ marginBottom: '3cm' }}>
              <Button
                onClick={handleAddSecaoDinamica}
                className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white rounded-xl shadow-md border-0 px-6 py-5 font-bold"
              >
                <Plus className="w-5 h-5" />
                <span>Adicionar Seção Personalizada</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Pesquisadores Proponentes Form & Table */
          <div className="space-y-6">
            
            {/* Form de Cadastro */}
            <Card className="shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-500" />
                  <CardTitle className="text-base font-bold">Cadastrar Novo Pesquisador Proponente</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Nome Completo</label>
                    <Input
                      placeholder="Nome do pesquisador..."
                      value={novoProponente.nome}
                      onChange={(e) => setNovoProponente({ ...novoProponente, nome: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">CPF</label>
                    <Input
                      placeholder="000.000.000-00"
                      value={novoProponente.cpf}
                      onChange={(e) => setNovoProponente({ ...novoProponente, cpf: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Titulação Máxima</label>
                    <select
                      value={novoProponente.titulacao}
                      onChange={(e) => setNovoProponente({ ...novoProponente, titulacao: e.target.value })}
                      className="w-full flex h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="Graduação">Graduação</option>
                      <option value="Especialização">Especialização</option>
                      <option value="Mestrado">Mestrado</option>
                      <option value="Doutorado">Doutorado</option>
                      <option value="Pós-Doutorado">Pós-Doutorado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Vínculo Institucional</label>
                    <Input
                      placeholder="Ex: USP, UNICAMP, UFMG..."
                      value={novoProponente.vinculo}
                      onChange={(e) => setNovoProponente({ ...novoProponente, vinculo: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Função no Projeto</label>
                    <select
                      value={novoProponente.funcao}
                      onChange={(e) => setNovoProponente({ ...novoProponente, funcao: e.target.value })}
                      className="w-full flex h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="Coordenador">Coordenador Geral</option>
                      <option value="Pesquisador Principal">Pesquisador Principal</option>
                      <option value="Pesquisador Associado">Pesquisador Associado</option>
                      <option value="Bolsista">Bolsista</option>
                      <option value="Técnico de Apoio">Técnico de Apoio</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Link Currículo Lattes</label>
                    <Input
                      placeholder="http://lattes.cnpq.br/..."
                      value={novoProponente.lattes}
                      onChange={(e) => setNovoProponente({ ...novoProponente, lattes: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleAddProponente} className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    <Plus className="w-4 h-4" />
                    Adicionar Pesquisador
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Proponentes Cadastrados */}
            <Card className="shadow-sm rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Pesquisadores Proponentes Cadastrados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projeto.pesquisadoresProponentes.length === 0 ? (
                  <p className="text-sm text-slate-500 italic p-8 text-center bg-slate-50 dark:bg-slate-900/10 rounded-b-2xl">
                    Nenhum proponente cadastrado para a capa do PDF.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                      <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="px-6 py-3">Nome</th>
                          <th className="px-6 py-3">CPF</th>
                          <th className="px-6 py-3">Titulação</th>
                          <th className="px-6 py-3">Vínculo</th>
                          <th className="px-6 py-3">Função</th>
                          <th className="px-6 py-3">Lattes</th>
                          <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projeto.pesquisadoresProponentes.map((p, idx) => (
                          <tr key={idx} className="border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{p.nome}</td>
                            <td className="px-6 py-4">{p.cpf}</td>
                            <td className="px-6 py-4">{p.titulacao}</td>
                            <td className="px-6 py-4">{p.vinculo}</td>
                            <td className="px-6 py-4">
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-350 border-0 rounded-lg">
                                {p.funcao}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              {p.lattes ? (
                                <a href={p.lattes} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline">
                                  Lattes <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveProponente(idx)}
                                className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 shadow-lg rounded-full">
          <Button
            size="lg"
            className="rounded-full shadow-lg gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white px-6 border-0"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-5 w-5" />
            {saving ? 'Salvando...' : 'Salvar Projeto'}
          </Button>
        </div>
        
        <ProcessingOverlay
          isOpen={generating}
          title={activeSection ? `Gerando ${projeto?.secoesDinamicas.find(s => s.chave === activeSection)?.titulo || activeSection}...` : "Gerando Proposta Acadêmica..."}
          message="A inteligência artificial está gerando, estruturando e revisando as seções científicas com base nas informações fornecidas. Aguarde alguns instantes."
        />
      </div>
    </MainLayout>
  );
}
