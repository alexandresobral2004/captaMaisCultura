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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import {
  ArrowLeft, Save, Sparkles, ClipboardCheck, Download, FileText, RefreshCw,
  CheckCircle2, AlertCircle, Copy, ArrowUp, ArrowDown, Plus, Trash2,
  Building2
} from "lucide-react";
import { EquipeProjeto } from '@/components/projetos/EquipeProjeto';
import { DadosProponenteForm } from '@/components/projetos/DadosProponenteForm';
import { defaultDadosProponente, type DadosProponente } from '@/components/projetos/dados-proponente';
import { AprimorarSecaoPopover } from '@/components/projetos/AprimorarSecaoPopover';
import { ConferenciaProjeto, type ResultadoConferencia } from '@/components/projetos/ConferenciaProjeto';
import { useConfirm } from '@/contexts/confirm-context';
import { useToast } from '@/contexts/toast-context';

interface SecaoDinamica {
  id: string;
  chave: string;
  titulo: string;
  conteudo: string;
  ordem: number;
  editavel: boolean;
}

// Função para formatar resultados esperados JSON em HTML
function formatarResultadosEsperadosHTML(jsonStr: string): string {
  try {
    let obj: any;
    if (typeof jsonStr === 'string') {
      // Tenta parsear, lidando com escapes
      try {
        obj = JSON.parse(jsonStr);
      } catch {
        // Se falhar, tenta limpar escapes extras
        const cleaned = jsonStr.replace(/\\\"/g, '"').replace(/\\\\/g, '\\');
        obj = JSON.parse(cleaned);
      }
    } else {
      obj = jsonStr;
    }

    if (!obj || typeof obj !== 'object') {
      return jsonStr ? `<p>${jsonStr}</p>` : '';
    }

    let html = '';
    const horizontes = [
      { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)' },
      { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)' },
      { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)' },
    ];

    horizontes.forEach(h => {
      if (obj[h.key] && obj[h.key].descricao) {
        html += `<h3>${h.label}</h3><p>${obj[h.key].descricao}</p>`;
        if (obj[h.key].indicadores && Array.isArray(obj[h.key].indicadores)) {
          html += `<ul>`;
          obj[h.key].indicadores.forEach((ind: any) => {
            html += `<li><strong>Indicador:</strong> ${ind.indicador || ''} — <strong>Meta:</strong> ${ind.meta || ''}</li>`;
          });
          html += `</ul>`;
        }
      }
    });

    return html || (jsonStr ? `<p>${jsonStr}</p>` : '');
  } catch {
    return jsonStr ? `<p>${jsonStr}</p>` : '';
  }
}

// Função para detectar se o conteúdo é JSON bruto
function isJsonBruto(conteudo: string): boolean {
  if (!conteudo) return false;
  const trimmed = conteudo.trim();
  return (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.includes('"curtoPrazo"') ||
    trimmed.includes('curtoPrazo') ||
    trimmed.includes('"medioPrazo"') ||
    trimmed.includes('medioPrazo') ||
    trimmed.includes('"longoPrazo"') ||
    trimmed.includes('longoPrazo')
  );
}

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  propostaUsuario: string;
  secoesDinamicas: SecaoDinamica[];
  valorSolicitado: number;
  prazoMeses: number;
  equipe: any[];
  criteriosAtendidos: string[];
  criteriosPendentes: string[];
  scoreCompliance: number;
  versao: number;
  logoUrl?: string;
  logoDescricao?: string;
  dadosProponente?: any;
}

export default function ProjetoEditorPage({ params }: { params: { id: string } }) {
  const confirmar = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [conferencia, setConferencia] = useState<ResultadoConferencia | null>(null);

  const [propostaUsuario, setPropostaUsuario] = useState('');
  const [secoesDinamicas, setSecoesDinamicas] = useState<SecaoDinamica[]>([]);
  const [incluirEquipe, setIncluirEquipe] = useState(false);
  const [equipeData, setEquipeData] = useState<any[]>([]);
  const [aprimorando, setAprimorando] = useState<string | null>(null);
  const [desfazer, setDesfazer] = useState<{ secaoId: string; titulo: string; conteudoAnterior: string } | null>(null);

  // States for tabs
  const [abaAtiva, setAbaAtiva] = useState<'proposta' | 'proponente'>('proposta');

  // States for logo
  const [logoUrl, setLogoUrl] = useState('');
  const [logoDescricao, setLogoDescricao] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // States for dados do proponente
  const [dadosProponente, setDadosProponente] = useState<DadosProponente>(defaultDadosProponente);

  // States for adding dynamic section
  const [mostrarAddForm, setMostrarAddForm] = useState(false);
  const [novaSecaoTitulo, setNovaSecaoTitulo] = useState('');

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

      // Logo
      setLogoUrl(proj.logoUrl || '');
      setLogoDescricao(proj.logoDescricao || '');
      if (proj.logoUrl) {
        setLogoPreview(proj.logoUrl);
      }

      // Dados do Proponente
      if (proj.dadosProponente) {
        setDadosProponente({ ...defaultDadosProponente, ...proj.dadosProponente });
      }

      // Processar seções dinâmicas para formatar JSON bruto
      let secoesList = proj.secoesDinamicas || [];
      if (Array.isArray(secoesList)) {
        secoesList = secoesList.map(secao => {
          // Verifica se é a seção de resultados esperados com JSON bruto
          if (secao.chave === 'resultadosEsperados' && isJsonBruto(secao.conteudo)) {
            return { ...secao, conteudo: formatarResultadosEsperadosHTML(secao.conteudo) };
          }
          return secao;
        });
      }
      setSecoesDinamicas(secoesList);

      if (proj.equipe) {
        try {
          const equipe = typeof proj.equipe === 'string' ? JSON.parse(proj.equipe) : proj.equipe;
          setEquipeData(Array.isArray(equipe) ? equipe : []);
          setIncluirEquipe(equipe.length > 0);
        } catch {
          setEquipeData([]);
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
      const updateData: any = {
        propostaUsuario,
        secoesDinamicas: secoesDinamicas,
        equipe: incluirEquipe ? equipeData : [],
        logoUrl,
        logoDescricao,
        dadosProponente,
      };

      const res = await fetch(`/api/v1/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error('Erro ao salvar no servidor');

      await fetchProjeto();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.showError('Erro ao salvar projeto.');
    } finally {
      setSaving(false);
    }
  };

  const handleConferir = async () => {
    if (!projetoId) return;
    setConferindo(true);
    try {
      const saveRes = await fetch(`/api/v1/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propostaUsuario, secoesDinamicas, equipe: incluirEquipe ? equipeData : [] }),
      });
      if (!saveRes.ok) throw new Error('Não foi possível salvar o rascunho antes de conferir.');
      const res = await fetch(`/api/v1/projetos/${projetoId}/conferir`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Não foi possível conferir o projeto.');
      setConferencia(json.data);
    } catch (e: any) {
      toast.showError(e.message || 'Não foi possível conferir o projeto.');
    } finally {
      setConferindo(false);
    }
  };

  const handleGerarCompleto = async () => {
    if (!projetoId) return;

    setGerando(true);
    setSaving(true);
    try {
      // 1. Salvar o estado atual do projeto
      const updateData: any = {
        propostaUsuario,
        secoesDinamicas: secoesDinamicas,
        equipe: incluirEquipe ? equipeData : []
      };

      const saveRes = await fetch(`/api/v1/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!saveRes.ok) {
        throw new Error('Falha ao salvar rascunhos antes de iniciar a geração.');
      }

      // 2. Executar a geração da proposta
      const res = await fetch(`/api/v1/projetos/${projetoId}/gerar`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao gerar proposta');
      }

      await fetchProjeto();
    } catch (err: any) {
      toast.showError(err.message);
    } finally {
      setGerando(false);
      setSaving(false);
    }
  };

  const salvarSecoes = async (lista: SecaoDinamica[]) => {
    const res = await fetch(`/api/v1/projetos/${projetoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secoesDinamicas: lista }),
    });
    if (!res.ok) throw new Error('Não foi possível salvar a seção.');
  };

  const handleAprimorarSecao = async (secaoId: string, secaoChave: string, secaoTitulo: string, conteudoAtual: string, pedido: string) => {
    if (!projetoId) return;

    setAprimorando(secaoId);
    try {
      const pendencias = (conferencia?.criterios || [])
        .filter(c => c.situacao !== 'atendido')
        .map(c => c.criterio);
      const res = await fetch(`/api/v1/projetos/${projetoId}/aprimorar-secao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secaoChave, secaoTitulo, conteudoAtual, pedido, pendencias }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao aprimorar seção');

      const nova = secoesDinamicas.map(s => (s.id === secaoId ? { ...s, conteudo: data.conteudoNovo } : s));
      setSecoesDinamicas(nova);
      setDesfazer({ secaoId, titulo: secaoTitulo, conteudoAnterior: conteudoAtual });
      await salvarSecoes(nova);
      if (data.avisos?.length) toast.showError(data.avisos.join(' '));
    } catch (err: any) {
      console.error(err);
      toast.showError(err.message || 'Erro ao aprimorar seção.');
    } finally {
      setAprimorando(null);
    }
  };

  const handleDesfazerAprimorar = async () => {
    if (!desfazer) return;
    const anterior = secoesDinamicas.map(s => (s.id === desfazer.secaoId ? { ...s, conteudo: desfazer.conteudoAnterior } : s));
    setSecoesDinamicas(anterior);
    setDesfazer(null);
    try {
      await salvarSecoes(anterior);
    } catch (err: any) {
      toast.showError(err.message || 'Não foi possível desfazer.');
    }
  };

  const handleCopyToClipboard = (htmlContent: string) => {
    // Copiar como texto plano removendo tags html
    // DOMParser não executa scripts nem carrega imagens (ao contrário de innerHTML em um div)
    const plainText = new DOMParser().parseFromString(htmlContent, "text/html").body.textContent || "";
    navigator.clipboard.writeText(plainText);
  };

  // Função para reformatar resultados esperados JSON em HTML
  const handleFormatarResultadosEsperados = async () => {
    const secaoResultados = secoesDinamicas.find(s => s.chave === 'resultadosEsperados');
    if (!secaoResultados) return;

    const novoConteudo = formatarResultadosEsperadosHTML(secaoResultados.conteudo);
    setSecoesDinamicas(prev => prev.map(s =>
      s.id === secaoResultados.id ? { ...s, conteudo: novoConteudo } : s
    ));

    // Salvar automaticamente
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projetos/${projetoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secoesDinamicas: secoesDinamicas.map(s =>
            s.id === secaoResultados.id ? { ...s, conteudo: novoConteudo } : s
          )
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      await fetchProjeto();
    } catch (err) {
      console.error('Erro ao formatar resultados:', err);
    } finally {
      setSaving(false);
    }
  };

  // Dynamic sections actions
  const handleAdicionarSecao = () => {
    if (!novaSecaoTitulo.trim()) return;

    const chave = 'secao_' + Date.now();
    const novaSecao: SecaoDinamica = {
      id: chave,
      chave,
      titulo: novaSecaoTitulo.trim(),
      conteudo: '<p><br></p>',
      ordem: secoesDinamicas.length,
      editavel: true
    };

    setSecoesDinamicas([...secoesDinamicas, novaSecao]);
    setNovaSecaoTitulo('');
    setMostrarAddForm(false);
  };

  const handleRemoverSecao = async (id: string) => {
    if (await confirmar('Tem certeza que deseja remover esta seção?')) {
      const filtradas = secoesDinamicas.filter(s => s.id !== id);
      const reordenadas = filtradas.map((s, idx) => ({ ...s, ordem: idx }));
      setSecoesDinamicas(reordenadas);
    }
  };

  const handleMoverSecao = (index: number, direcao: 'subir' | 'descer') => {
    const novas = [...secoesDinamicas];
    const targetIndex = direcao === 'subir' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= novas.length) return;

    const temp = novas[index];
    novas[index] = novas[targetIndex];
    novas[targetIndex] = temp;

    const reordenadas = novas.map((s, idx) => ({ ...s, ordem: idx }));
    setSecoesDinamicas(reordenadas);
  };

  const handleUpdateSecaoConteudo = (id: string, conteudo: string) => {
    setSecoesDinamicas(prev => prev.map(s => s.id === id ? { ...s, conteudo } : s));
  };

  const handleUpdateSecaoTitulo = (id: string, titulo: string) => {
    setSecoesDinamicas(prev => prev.map(s => s.id === id ? { ...s, titulo } : s));
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
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button variant="outline" onClick={() => router.push('/projetos')} className="mt-4">
            Voltar para projetos
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.showWarning('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoUrl(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverLogo = () => {
    setLogoUrl('');
    setLogoDescricao('');
    setLogoPreview(null);
  };

  // Tabs component
  const renderTabs = () => (
    <div className="flex border-b border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setAbaAtiva('proposta')}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'proposta'
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
      >
        <FileText className="w-4 h-4 inline mr-1" />
        Editar Proposta
      </button>
      <button
        onClick={() => setAbaAtiva('proponente')}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'proponente'
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
      >
        <Building2 className="w-4 h-4 inline mr-1" />
        Dados do Proponente & Logo
      </button>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/projetos')} className="touch-target -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">{projeto.titulo}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={
                  projeto.status === 'gerado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' :
                    projeto.status === 'rascunho' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' :
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                }>
                  {projeto.status}
                </Badge>
                {projeto.scoreCompliance > 0 && (
                  <span className={`text-sm flex items-center gap-1 font-medium ${projeto.scoreCompliance >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                    {projeto.scoreCompliance >= 70 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    Compatibilidade: {projeto.scoreCompliance}%
                  </span>
                )}
                {projeto.versao && <span className="text-sm text-slate-500">v{projeto.versao}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" onClick={handleSalvar} disabled={saving} className="touch-target">
              <Save className="w-4 h-4 mr-2" />
              <span>{saving ? 'Salvando...' : 'Salvar'}</span>
            </Button>
            <Button variant="outline" onClick={handleConferir} disabled={conferindo || gerando} className="touch-target">
              {conferindo ? <Spinner className="w-4 h-4 mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
              <span>{conferindo ? 'Conferindo...' : 'Conferir projeto'}</span>
            </Button>
            <Button onClick={handleGerarCompleto} disabled={gerando} className="touch-target">
              {gerando ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>Gerar Proposta</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {desfazer && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-purple-50 p-3 text-sm text-purple-900 dark:bg-purple-950/30 dark:text-purple-200">
            <span>A seção "{desfazer.titulo}" foi reescrita e salva.</span>
            <Button variant="outline" size="sm" onClick={handleDesfazerAprimorar}>Desfazer</Button>
          </div>
        )}

        {conferencia && <ConferenciaProjeto resultado={conferencia} onFechar={() => setConferencia(null)} />}

        {/* Tabs */}
        {renderTabs()}

        {/* Tab Content: Proposta */}
        {abaAtiva === 'proposta' && (
          <>
            {/* Proposta Textarea */}
            <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-slate-200/60 dark:border-slate-800/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Descreva sua Proposta</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Descreva sua ideia de projeto aqui... Quanto mais detalhes você fornecer, melhor será a geração da proposta. Inclua informações sobre o problema que deseja resolver, a abordagem proposta, o público-alvo, e qualquer outra informação relevante."
                  value={propostaUsuario}
                  onChange={(e) => setPropostaUsuario(e.target.value)}
                  className="min-h-[150px] text-sm resize-y bg-white/50 dark:bg-slate-950/50"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Dica: Inclua detalhes sobre o problema, objetivos, metodologia esperada, e qualquer restrição ou requisito especial.
                </p>
              </CardContent>
            </Card>

            {/* Criteria Cards */}
            {projeto.status === 'gerado' && (
              <div className="space-y-4">
                {projeto.criteriosAtendidos && projeto.criteriosAtendidos.length > 0 && (
                  <Card className="border-emerald-200/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Critérios Atendidos ({projeto.criteriosAtendidos.length})
                      </h3>
                      <ul className="text-xs text-emerald-800/80 dark:text-emerald-400/80 space-y-1 pl-4 list-disc">
                        {projeto.criteriosAtendidos.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {projeto.criteriosPendentes && projeto.criteriosPendentes.length > 0 && (
                  <Card className="border-amber-200/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Critérios Pendentes ({projeto.criteriosPendentes.length})
                      </h3>
                      <ul className="text-xs text-amber-800/80 dark:text-amber-400/80 space-y-1 pl-4 list-disc">
                        {projeto.criteriosPendentes.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Campos da Proposta</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarAddForm(!mostrarAddForm)}
                  className="text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Seção
                </Button>
              </div>

              {/* Form to add a new section */}
              {mostrarAddForm && (
                <Card className="border-blue-200 bg-blue-50/20 dark:bg-blue-950/10 animate-in fade-in duration-200">
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome da Nova Seção</label>
                      <Input
                        placeholder="Ex: Público Alvo, Histórico da Instituição"
                        value={novaSecaoTitulo}
                        onChange={e => setNovaSecaoTitulo(e.target.value)}
                        className="bg-white/90 dark:bg-slate-950/90"
                        onKeyDown={e => e.key === 'Enter' && handleAdicionarSecao()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setMostrarAddForm(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleAdicionarSecao}>
                        Adicionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dynamic list of sections */}
              {secoesDinamicas.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500 text-sm">Nenhuma seção cadastrada para este projeto.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {[...secoesDinamicas]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((secao, idx) => (
                      <Card key={secao.id} className="group overflow-hidden border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-all duration-300">
                        <CardHeader className="py-3 px-4 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/60">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            {/* Editable Title */}
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                value={secao.titulo}
                                onChange={e => handleUpdateSecaoTitulo(secao.id, e.target.value)}
                                className="h-8 font-bold text-sm bg-transparent border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 p-1 px-2 rounded -ml-2 w-full max-w-xs transition-all text-slate-800 dark:text-slate-100"
                                placeholder="Título da Seção"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 sm:ml-auto">
                              {/* Botão especial para reformatar Resultados Esperados se for JSON */}
                              {secao.chave === 'resultadosEsperados' && isJsonBruto(secao.conteudo) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleFormatarResultadosEsperados}
                                  className="h-7 text-xs px-2 rounded-lg text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                                  title="Formatar JSON em HTML"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  <span>Formatar</span>
                                </Button>
                              )}

                              <AprimorarSecaoPopover
                                carregando={aprimorando === secao.id}
                                onAprimorar={pedido => handleAprimorarSecao(secao.id, secao.chave, secao.titulo, secao.conteudo, pedido)}
                              />

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyToClipboard(secao.conteudo)}
                                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                title="Copiar texto plano"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>

                              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-1" />

                              {/* Reordering */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoverSecao(idx, 'subir')}
                                disabled={idx === 0}
                                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                                title="Subir seção"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoverSecao(idx, 'descer')}
                                disabled={idx === secoesDinamicas.length - 1}
                                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                                title="Descer seção"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>

                              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-1" />

                              {/* Remove */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoverSecao(secao.id)}
                                className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                title="Remover seção"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4">
                          <RichTextEditor
                            value={secao.conteudo}
                            onChange={conteudo => handleUpdateSecaoConteudo(secao.id, conteudo)}
                            placeholder={`Digite o conteúdo para a seção ${secao.titulo}...`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>

            <EquipeProjeto
              equipe={equipeData}
              onChange={setEquipeData}
              incluir={incluirEquipe}
              onIncluirChange={setIncluirEquipe}
              mostrarLista={projeto.status === 'gerado'}
            />

            {/* Export Section */}
            {projeto.status === 'gerado' && (
              <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
                    <FileText className="w-4 h-4 text-slate-500" />
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
          </>
        )}

        {/* Tab Content: Dados do Proponente */}
        {abaAtiva === 'proponente' && (
          <DadosProponenteForm
            dadosProponente={dadosProponente}
            setDadosProponente={setDadosProponente}
            logoPreview={logoPreview}
            logoDescricao={logoDescricao}
            setLogoDescricao={setLogoDescricao}
            onLogoUpload={handleLogoUpload}
            onRemoverLogo={handleRemoverLogo}
          />
        )}
        
        <ProcessingOverlay
          isOpen={gerando}
          title="Escrevendo Proposta Completa..."
          message="A inteligência artificial está gerando, estruturando e formatando todas as seções obrigatórias com base no edital. Isso pode levar alguns minutos."
        />
      </div>
    </MainLayout>
  );
}