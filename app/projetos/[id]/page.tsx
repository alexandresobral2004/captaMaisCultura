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
  ArrowLeft, Save, Sparkles, Download, FileText, RefreshCw,
  CheckCircle2, AlertCircle, Copy, ArrowUp, ArrowDown, Plus, Trash2,
  Upload, X, Building2, Phone, Mail, MapPin, UserCircle
} from "lucide-react";

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

interface DadosProponente {
  cnpjCpf: string;
  nomeProponente: string;
  tipoPessoa: string;
  logradouro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefones: Array<{ tipo: string; uf: string; ddd: string; numero: string; divulgar: boolean }>;
  emails: Array<{ tipo: string; email: string }>;
  natureza: string;
  esfera: string;
  administracao: string;
  finsLucrativos: string;
  dirigentes: Array<{ cpf: string; nome: string }>;
  historico: string;
  projetosAnteriores: string;
  capacidadeTecnica: string;
}

const defaultDadosProponente: DadosProponente = {
  cnpjCpf: '',
  nomeProponente: '',
  tipoPessoa: 'fisica',
  logradouro: '',
  cidade: '',
  uf: '',
  cep: '',
  telefones: [],
  emails: [],
  natureza: '',
  esfera: '',
  administracao: '',
  finsLucrativos: '',
  dirigentes: [],
  historico: '',
  projetosAnteriores: '',
  capacidadeTecnica: '',
};

export default function ProjetoEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);

  const [propostaUsuario, setPropostaUsuario] = useState('');
  const [secoesDinamicas, setSecoesDinamicas] = useState<SecaoDinamica[]>([]);
  const [incluirEquipe, setIncluirEquipe] = useState(false);
  const [equipeData, setEquipeData] = useState<any[]>([]);

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
      alert('Erro ao salvar projeto.');
    } finally {
      setSaving(false);
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
      alert(err.message);
    } finally {
      setGerando(false);
      setSaving(false);
    }
  };

  const handleCopyToClipboard = (htmlContent: string) => {
    // Copiar como texto plano removendo tags html
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
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

  const handleRemoverSecao = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta seção?')) {
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
      alert('Por favor, selecione um arquivo de imagem válido.');
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

  // Dados Proponente handlers
  const handleAddTelefone = () => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: [...prev.telefones, { tipo: 'Fixo', uf: '', ddd: '', numero: '', divulgar: true }]
    }));
  };

  const handleRemoveTelefone = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: prev.telefones.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateTelefone = (index: number, field: string, value: any) => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: prev.telefones.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }));
  };

  const handleAddEmail = () => {
    setDadosProponente(prev => ({
      ...prev,
      emails: [...prev.emails, { tipo: 'Principal', email: '' }]
    }));
  };

  const handleRemoveEmail = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateEmail = (index: number, field: string, value: string) => {
    setDadosProponente(prev => ({
      ...prev,
      emails: prev.emails.map((e, i) => i === index ? { ...e, [field]: value } : e)
    }));
  };

  const handleAddDirigente = () => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: [...prev.dirigentes, { cpf: '', nome: '' }]
    }));
  };

  const handleRemoveDirigente = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: prev.dirigentes.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateDirigente = (index: number, field: string, value: string) => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: prev.dirigentes.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }));
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

  // Dados Proponente Form
  const renderDadosProponenteForm = () => (
    <div className="space-y-6">
      {/* Logo Upload Section */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Logo da Instituição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {logoPreview ? (
              <div className="relative">
                <img src={logoPreview} alt="Logo preview" className="w-32 h-32 object-contain border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-950" />
                <button
                  onClick={handleRemoverLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-400 transition-colors bg-slate-50 dark:bg-slate-900">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs text-slate-500">Upload</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
            )}
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descrição da Logo</label>
              <Input
                value={logoDescricao}
                onChange={(e) => setLogoDescricao(e.target.value)}
                placeholder="Ex: Logo oficial da instituição..."
                className="bg-white dark:bg-slate-950"
              />
              {!logoPreview && (
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Selecionar Imagem</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identificação */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCircle className="w-4 h-4" />
            Identificação do Proponente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">CNPJ/CPF</label>
              <Input
                value={dadosProponente.cnpjCpf}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, cnpjCpf: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Nome do Proponente</label>
              <Input
                value={dadosProponente.nomeProponente}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, nomeProponente: e.target.value }))}
                placeholder="Nome completo ou razão social"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Tipo de Pessoa</label>
              <select
                value={dadosProponente.tipoPessoa}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, tipoPessoa: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-950 text-sm"
              >
                <option value="fisica">Pessoa Física</option>
                <option value="juridica">Pessoa Jurídica</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Logradouro</label>
              <Input
                value={dadosProponente.logradouro}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, logradouro: e.target.value }))}
                placeholder="Rua, número, complemento"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Cidade</label>
              <Input
                value={dadosProponente.cidade}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, cidade: e.target.value }))}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">UF</label>
                <Input
                  value={dadosProponente.uf}
                  onChange={(e) => setDadosProponente(prev => ({ ...prev, uf: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">CEP</label>
                <Input
                  value={dadosProponente.cep}
                  onChange={(e) => setDadosProponente(prev => ({ ...prev, cep: e.target.value }))}
                  placeholder="00000-000"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telefones */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Telefone(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.telefones.map((tel, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-24">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={tel.tipo}
                    onChange={(e) => handleUpdateTelefone(i, 'tipo', e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="Fixo">Fixo</option>
                    <option value="Celular">Celular</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="w-12">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">UF</label>
                  <Input value={tel.uf} onChange={(e) => handleUpdateTelefone(i, 'uf', e.target.value)} maxLength={2} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="w-12">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">DDD</label>
                  <Input value={tel.ddd} onChange={(e) => handleUpdateTelefone(i, 'ddd', e.target.value)} maxLength={2} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Número</label>
                  <Input value={tel.numero} onChange={(e) => handleUpdateTelefone(i, 'numero', e.target.value)} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Divulgar</label>
                  <input
                    type="checkbox"
                    checked={tel.divulgar}
                    onChange={(e) => handleUpdateTelefone(i, 'divulgar', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveTelefone(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddTelefone} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Telefone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* E-mails */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            E-mail(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.emails.map((email, i) => (
              <div key={i} className="flex gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-32">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={email.tipo}
                    onChange={(e) => handleUpdateEmail(i, 'tipo', e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Secundário">Secundário</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">E-mail</label>
                  <Input value={email.email} onChange={(e) => handleUpdateEmail(i, 'email', e.target.value)} type="email" placeholder="email@exemplo.com" className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveEmail(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddEmail} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar E-mail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Natureza */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Natureza do Proponente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Natureza</label>
              <Input
                value={dadosProponente.natureza}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, natureza: e.target.value }))}
                placeholder="Ex: Associação, Fundação"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Esfera</label>
              <Input
                value={dadosProponente.esfera}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, esfera: e.target.value }))}
                placeholder="Ex: Federal, Estadual, Municipal"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Administração</label>
              <Input
                value={dadosProponente.administracao}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, administracao: e.target.value }))}
                placeholder="Ex: Direta, Indireta"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Fins Lucrativos</label>
              <select
                value={dadosProponente.finsLucrativos}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, finsLucrativos: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-950 text-sm"
              >
                <option value="">Selecione</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dirigentes */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCircle className="w-4 h-4" />
            Dirigentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.dirigentes.map((dir, i) => (
              <div key={i} className="flex gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-40">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">CPF</label>
                  <Input value={dir.cpf} onChange={(e) => handleUpdateDirigente(i, 'cpf', e.target.value)} placeholder="000.000.000-00" className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Nome</label>
                  <Input value={dir.nome} onChange={(e) => handleUpdateDirigente(i, 'nome', e.target.value)} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveDirigente(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddDirigente} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Dirigente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contexto de IA */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Contexto para Inteligência Artificial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Histórico do Proponente</label>
              <Textarea
                value={dadosProponente.historico}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, historico: e.target.value }))}
                placeholder="Descreva o histórico de atuação do proponente na área cultural..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Projetos Anteriores</label>
              <Textarea
                value={dadosProponente.projetosAnteriores}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, projetosAnteriores: e.target.value }))}
                placeholder="Liste projetos anteriores relevantes (um por linha)..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Capacidade Técnica</label>
              <Textarea
                value={dadosProponente.capacidadeTecnica}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, capacidadeTecnica: e.target.value }))}
                placeholder="Descreva a capacidade técnica e equipe disponível..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
          </div>
        </CardContent>
      </Card>
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

            {/* Team Section */}
            {projeto.status === 'gerado' && (
              <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <CardHeader className="py-3 px-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">Equipe do Projeto</CardTitle>
                    {equipeData.length > 0 && (
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs w-fit">
                        {equipeData.length} membros
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="space-y-3">
                    {equipeData.map((membro: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Nome</label>
                            <Input
                              value={membro.nome || ''}
                              className="bg-white dark:bg-slate-950"
                              onChange={(e) => {
                                const newEquipe = [...equipeData];
                                newEquipe[i].nome = e.target.value;
                                setEquipeData(newEquipe);
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Função</label>
                            <Input
                              value={membro.funcao || ''}
                              className="bg-white dark:bg-slate-950"
                              onChange={(e) => {
                                const newEquipe = [...equipeData];
                                newEquipe[i].funcao = e.target.value;
                                setEquipeData(newEquipe);
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Qualificação</label>
                            <Input
                              value={membro.qualificacao || ''}
                              className="bg-white dark:bg-slate-950"
                              onChange={(e) => {
                                const newEquipe = [...equipeData];
                                newEquipe[i].qualificacao = e.target.value;
                                setEquipeData(newEquipe);
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Dedicação</label>
                            <Input
                              value={membro.dedicacao || ''}
                              className="bg-white dark:bg-slate-950"
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
                      className="text-xs hover:bg-slate-100"
                    >
                      + Adicionar Membro
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEquipeData(equipeData.slice(0, -1));
                      }}
                      className="text-xs text-slate-500 hover:text-red-500"
                      disabled={equipeData.length === 0}
                    >
                      Remover Último
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Include Team Toggle */}
            <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="incluirEquipe"
                    checked={incluirEquipe}
                    onChange={(e) => setIncluirEquipe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="incluirEquipe" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    Incluir equipe na proposta
                  </label>
                </div>
              </CardContent>
            </Card>

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
        {abaAtiva === 'proponente' && renderDadosProponenteForm()}
        
        <ProcessingOverlay
          isOpen={gerando}
          title="Escrevendo Proposta Completa..."
          message="A inteligência artificial está gerando, estruturando e formatando todas as seções obrigatórias com base no edital. Isso pode levar alguns minutos."
        />
      </div>
    </MainLayout>
  );
}