'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ArrowRight, RefreshCw, AlertTriangle, FileSpreadsheet, ListChecks, CheckCircle2, ChevronRight, X, AlertCircle, Trash2, FileUp, CheckCircle, XCircle } from "lucide-react";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { EditalReviewPanel } from "@/components/EditalReviewPanel";

interface Edital {
  id: string;
  titulo: string;
  orgao: string;
  valor: string;
  dataLimite: string;
  status: string;
  descricao: string;
  link: string;
  codigo?: string;
  criadoEm?: string;
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro';
  erroAnalise?: string;
  fonteConteudo?: string;
  analiseIA?: {
    resumo: string;
    objetivo?: string;
    requisitos: string[];
    elegibilidade: string;
    itensFinanciáveis: string[];
    documentosNecessarios?: string[];
    criteriosAvaliacao?: string[];
    pontosFracos?: string[];
    contatoEdital?: string;
    scoreAdequacao?: number;
  };
  areasTematicas?: string[];
  tipoProponente?: string[];
  tipoEdital?: 'chamada_publica' | 'evento_cientifico' | 'outro';
  modalidade?: string;
  abrangencia?: string;
  tecnologiaFoco?: string;
  categoriaArea?: string;
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatarValorBRL(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return 'Não informado';
  if (typeof valor === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }
  const str = String(valor).trim();
  if (!str) return 'Não informado';
  if (str.includes(',') && (str.includes('R$') || str.includes('.'))) {
    return str;
  }
  const apenasNumeros = str.replace(/[R$\s]/g, '');
  let parseable = apenasNumeros;
  if (apenasNumeros.includes(',') && !apenasNumeros.includes('.')) {
    parseable = apenasNumeros.replace(',', '.');
  }
  const num = parseFloat(parseable);
  if (isNaN(num)) {
    return str;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export default function EditaisPage() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'explorar' | 'revisao'>('explorar');
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedTiposEdital, setSelectedTiposEdital] = useState<string[]>([]);
  
  // Estado para ordenação
  const [ordenacao, setOrdenacao] = useState<'recentes' | 'antigos'>('recentes');

  // Estado para Edital Selecionado na IA
  const [editalSelecionado, setEditalSelecionado] = useState<Edital | null>(null);

  // Estado para edição dinâmica de campos do modal
  const [requisitosEditados, setRequisitosEditados] = useState<string[]>([]);
  const [itensFinanciaveisEditados, setItensFinanciaveisEditados] = useState<string[]>([]);

  // Estados para Upload de PDF
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Carrega os editais do banco local
  const fetchEditais = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/editais', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao recuperar dados dos editais.');
      const data = await res.json();
      setEditais(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Busca editais apenas do banco de dados (NÃO faz scraping automático)
  useEffect(() => {
    fetchEditais();
  }, []);

  // Sincroniza campos editáveis quando edital selecionado muda
  useEffect(() => {
    if (editalSelecionado?.analiseIA) {
      setRequisitosEditados(editalSelecionado.analiseIA.requisitos || []);
      setItensFinanciaveisEditados(editalSelecionado.analiseIA.itensFinanciáveis || []);
    } else {
      setRequisitosEditados([]);
      setItensFinanciaveisEditados([]);
    }
  }, [editalSelecionado]);

  // Dispara busca ativa / IA scraper
  const handleBuscarEditais = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/editais/busca', { method: 'POST' });
      if (!res.ok) throw new Error('Erro no processo de busca ativa.');
      const data = await res.json();
      if (data.success) {
        setEditais(data.editais);
        fetchEditais(); // Atualiza para pegar as mudanças de status da IA no backend
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  // Re-analisa um edital manualmente
  const handleAnalisarEdital = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzing(id);
    try {
      const res = await fetch('/api/editais/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await fetchEditais();
      } else {
        const data = await res.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        setError(errorMsg || 'Erro ao analisar edital.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(null);
    }
  };

  // Re-analisa com IA completa (endpoint de re-análise)
  const handleReanalisarEdital = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReanalyzing(id);
    try {
      const res = await fetch(`/api/v1/editais/${id}/reanalyze`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchEditais();
      } else {
        const data = await res.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        setError(errorMsg || 'Erro ao re-analisar edital.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReanalyzing(null);
    }
  };

  // Deleta um edital do banco e remove PDFs
  const handleDeletarEdital = async (id: string, titulo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Tem certeza que deseja deletar "${titulo}"? Isso também removerá o PDF.`)) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/v1/editais/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setError(null);
        await fetchEditais();
      } else {
        const data = await res.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        setError(errorMsg || 'Erro ao deletar edital.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateCategoriaArea = async (id: string, novaCategoria: string) => {
    try {
      const res = await fetch(`/api/v1/editais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaArea: novaCategoria }),
      });
      if (res.ok) {
        setEditais(prev => prev.map(e => e.id === id ? { ...e, categoriaArea: novaCategoria } : e));
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Erro ao atualizar a área do edital.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Lógica de manipulação de filtros de checkbox
  const handleAreaChange = (area: string) => {
    setSelectedAreas(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleTipoChange = (tipo: string) => {
    setSelectedTipos(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const handleTipoEditalChange = (tipo: string) => {
    setSelectedTiposEdital(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  // Handlers para Upload de PDF
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const tituloInput = document.getElementById('upload-titulo') as HTMLInputElement;
      const orgaoInput = document.getElementById('upload-orgao') as HTMLInputElement;
      const categoriaInput = document.getElementById('upload-categoria') as HTMLSelectElement;

      if (tituloInput?.value) {
        formData.append('titulo', tituloInput.value);
      }
      if (orgaoInput?.value) {
        formData.append('orgao', orgaoInput.value);
      }
      if (categoriaInput?.value) {
        formData.append('categoriaArea', categoriaInput.value);
      }

      setUploadProgress(30);

      const res = await fetch('/api/v1/editais/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Erro ao processar upload');
      }

      setUploadProgress(100);
      setUploadResult(data.data);
      fetchEditais(); // Atualizar a lista após upload com sucesso
    } catch (error: any) {
      setUploadResult({
        erros: [error.message || 'Erro desconhecido'],
        titulo: selectedFile.name,
        tecnologiaFoco: 'N/A',
        scoreRelevancia: 0,
        confiancaIA: 0
      });
    } finally {
      setUploading(false);
    }
  };

  // Filtra localmente os editais
  const editaisFiltrados = editais.filter(edital => {
    if (edital.statusAnalise === 'descartado') return false; // Esconde os descartados

    const matchSearch = 
      edital.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      edital.orgao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      edital.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      
    // Áreas do IA se existirem, senão fallback simples
    const matchArea = selectedAreas.length === 0 || selectedAreas.some(area => {
      if (edital.areasTematicas && edital.areasTematicas.length > 0) {
         return edital.areasTematicas.some(a => a.toLowerCase().includes(area.toLowerCase()));
      }
      const t = edital.titulo.toLowerCase() + ' ' + edital.descricao.toLowerCase();
      if (area === "Saúde") return t.includes('saúde') || t.includes('médico') || t.includes('hospital');
      if (area === "Educação") return t.includes('escola') || t.includes('educação') || t.includes('ensino') || t.includes('universidade');
      if (area === "Cultura") return t.includes('cultura') || t.includes('biblioteca') || t.includes('museu') || t.includes('patrimônio');
      if (area === "Infraestrutura") return t.includes('via') || t.includes('pavimentação') || t.includes('infraestrutura') || t.includes('construção');
      if (area === "Esporte") return t.includes('esporte') || t.includes('quadra') || t.includes('poliesportiva');
      return false;
    });

    const matchTipo = selectedTipos.length === 0 || selectedTipos.some(tipo => {
      if (edital.tipoProponente && edital.tipoProponente.length > 0) {
        return edital.tipoProponente.some(t => t.toLowerCase().includes(tipo.toLowerCase()));
      }
      const o = edital.orgao.toLowerCase();
      if (tipo === "Federal") return o.includes('ministério') || o.includes('finep') || o.includes('cnpq');
      if (tipo === "Estadual") return o.includes('secretaria') || o.includes('fapesp') || o.includes('estadual');
      if (tipo === "ONG") return edital.descricao.toLowerCase().includes('ong') || edital.descricao.toLowerCase().includes('terceiro setor');
      return true;
    });

    // Filtro por tipo de edital (Evento, TI, etc)
    const matchTipoEdital = selectedTiposEdital.length === 0 || selectedTiposEdital.some(tipoFiltro => {
      if (tipoFiltro === "Evento") {
        return edital.tipoEdital === 'evento_cientifico' || 
               edital.titulo.toLowerCase().includes('congresso') ||
               edital.titulo.toLowerCase().includes('seminário') ||
               edital.titulo.toLowerCase().includes('conferência') ||
               edital.titulo.toLowerCase().includes('workshop');
      }
      if (tipoFiltro === "TI") {
        return edital.tecnologiaFoco && (
          edital.tecnologiaFoco.includes('Software') ||
          edital.tecnologiaFoco.includes('Cloud') ||
          edital.tecnologiaFoco.includes('Machine Learning') ||
          edital.tecnologiaFoco.includes('Desenvolvimento')
        ) ||
        edital.titulo.toLowerCase().includes('software') ||
        edital.titulo.toLowerCase().includes('tecnologia') ||
        edital.titulo.toLowerCase().includes('programação') ||
        edital.titulo.toLowerCase().includes('sistema');
      }
      if (tipoFiltro === "Pesquisa") {
        return edital.tipoEdital === 'chamada_publica' ||
               edital.titulo.toLowerCase().includes('pesquisa') ||
               edital.titulo.toLowerCase().includes('bolsa') ||
               edital.titulo.toLowerCase().includes('investigação');
      }
      return true;
    });

    return matchSearch && matchArea && matchTipo && matchTipoEdital;
  }).sort((a, b) => {
    // Ordenar por data de lançamento
    const dataA = new Date(a.criadoEm || a.dataLimite || 0).getTime();
    const dataB = new Date(b.criadoEm || b.dataLimite || 0).getTime();
    
    if (ordenacao === 'recentes') {
      return dataB - dataA; // Mais recentes primeiro
    } else {
      return dataA - dataB; // Mais antigos primeiro
    }
  });

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header com Ação Premium de Recarga/Busca IA */}
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }} className="flex justify-between items-center">
          <div>
            <h2 className="dashboard-title">Explorar Editais</h2>
            <p className="dashboard-subtitle">
              Encontre oportunidades reais de captação abertas com análise inteligente por IA
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button 
              variant="outline" 
              onClick={() => setShowUploadModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FileUp style={{ width: '0.875rem', height: '0.875rem' }} />
              Upload PDF
            </Button>
            
            <Button 
              variant="outline" 
              onClick={fetchEditais} 
              disabled={loading || searching}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} style={{ width: '0.875rem', height: '0.875rem' }} />
              Atualizar
            </Button>
            
            {/* Botão de Busca Inteligente desativado */}
            {/* <Button 
              onClick={handleBuscarEditais} 
              disabled={searching}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              <RefreshCw className={searching ? "animate-spin" : ""} style={{ width: '0.875rem', height: '0.875rem' }} />
              {searching ? 'Buscando & Analisando IA...' : 'Disparar Busca Inteligente'}
            </Button> */}
          </div>
        </div>

        {/* Tabs de Navegação */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--color-border)', margin: '0 0.5rem -0.5rem 0.5rem' }}>
          <button
            onClick={() => setActiveTab('explorar')}
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: activeTab === 'explorar' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'explorar' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            <Search style={{ width: '0.875rem', height: '0.875rem' }} />
            Explorar Editais
          </button>
          <button
            onClick={() => setActiveTab('revisao')}
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: activeTab === 'revisao' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'revisao' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            <ListChecks style={{ width: '0.875rem', height: '0.875rem' }} />
            Revisão Humana
          </button>
        </div>

        {activeTab === 'explorar' ? (
          <>
            {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fee2e2', 
            borderRadius: 'var(--radius-md)', 
            padding: '1rem', 
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertTriangle style={{ width: '1.25rem', height: '1.25rem' }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Sidebar de Filtros */}
          <div className="filters-sidebar" style={{ width: '280px', flexShrink: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-sm">
                  <Filter style={{ width: '1rem', height: '1rem' }} />
                  <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Filtros</CardTitle>
                </div>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div className="filters-section">
                  <label className="filters-section-title">Busca Rápida</label>
                  <div style={{ position: 'relative' }}>
                    <Search style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '0.875rem',
                      height: '0.875rem',
                      color: 'var(--color-gray-400)'
                    }} />
                    <Input
                      type="text"
                      placeholder="Palavra-chave..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>
                </div>

                <div className="filters-section">
                  <label className="filters-section-title">Área de Interesse</label>
                  <div className="checkbox-group">
                    {["Saúde", "Educação", "Cultura", "Infraestrutura", "Esporte"].map(
                      (area) => (
                        <label key={area} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedAreas.includes(area)}
                            onChange={() => handleAreaChange(area)}
                          />
                          {area}
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="filters-section">
                   <label className="filters-section-title">Tipo de Instituição</label>
                   <div className="checkbox-group">
                     {["Federal", "Estadual", "ONG", "Universidade"].map((tipo) => (
                       <label key={tipo} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                         <input 
                           type="checkbox" 
                           checked={selectedTipos.includes(tipo)}
                           onChange={() => handleTipoChange(tipo)}
                         />
                         {tipo}
                       </label>
                     ))}
                   </div>
                 </div>

                 <div className="filters-section">
                   <label className="filters-section-title">Tipo de Edital</label>
                   <div className="checkbox-group">
                     {["Evento", "TI", "Pesquisa"].map((tipo) => (
                       <label key={tipo} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                         <input 
                           type="checkbox" 
                           checked={selectedTiposEdital.includes(tipo)}
                           onChange={() => handleTipoEditalChange(tipo)}
                         />
                         {tipo}
                       </label>
                     ))}
                   </div>
                 </div>

                 <div className="filters-section">
                   <label className="filters-section-title">Ordenação</label>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                     <Button 
                       variant={ordenacao === 'recentes' ? 'default' : 'outline'}
                       size="sm"
                       onClick={() => setOrdenacao('recentes')}
                       style={{ flex: 1 }}
                     >
                       Recentes
                     </Button>
                     <Button 
                       variant={ordenacao === 'antigos' ? 'default' : 'outline'}
                       size="sm"
                       onClick={() => setOrdenacao('antigos')}
                       style={{ flex: 1 }}
                     >
                       Antigos
                     </Button>
                   </div>
                 </div>
                 
                 {(searchTerm || selectedAreas.length > 0 || selectedTipos.length > 0 || selectedTiposEdital.length > 0) && (
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     onClick={() => {
                       setSearchTerm('');
                       setSelectedAreas([]);
                       setSelectedTipos([]);
                       setSelectedTiposEdital([]);
                     }}
                     style={{ color: 'var(--color-danger)' }}
                   >
                     Limpar Filtros
                   </Button>
                 )}
              </CardContent>
            </Card>
          </div>

          {/* Grid de Editais Encontrados */}
          <div style={{ flex: 1, minWidth: '320px' }}>
            
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                <RefreshCw className="animate-spin" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--color-primary)' }} />
                <p className="text-gray-600">Carregando editais reais do banco...</p>
              </div>
            ) : searching ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" style={{ width: '3rem', height: '3rem', color: 'var(--color-primary)' }} />
                <h4 style={{ fontWeight: 600, fontSize: '1.25rem' }}>Buscando e Dividindo Editais em Chunks...</h4>
                <p className="text-gray-600" style={{ maxWidth: '450px' }}>
                  A inteligência artificial do Capta+ está baixando os editais abertos, extraindo o conteúdo textual do PDF e analisando requisitos obrigatórios e itens financiáveis.
                </p>
              </div>
            ) : editaisFiltrados.length === 0 ? (
              <Card style={{ padding: '3rem', textAlign: 'center' }}>
                <FileSpreadsheet style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', color: 'var(--color-gray-400)' }} />
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>Nenhum Edital Aberto Encontrado</h3>
                <p className="text-gray-600" style={{ maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                  Nenhum edital com os filtros selecionados ou no momento estão fechados.
                </p>
              </Card>
            ) : (
<div className="editais-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {editaisFiltrados.map((edital) => {
                  const isAnalisado = edital.statusAnalise === 'analisado';
                  const isErro = edital.statusAnalise === 'erro';
                  const isPendente = edital.statusAnalise === 'pendente' || edital.statusAnalise === 'pdf_baixado';
                  const isUpload = edital.fonteConteudo === 'pdf_upload';
                  const score = edital.analiseIA?.scoreAdequacao;
                  
                  return (
                    <Card key={edital.id} style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'all 0.2s', border: isAnalisado ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-gray-200)' }}>
                      <CardHeader>
                        <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Badge variant="success">
                              {edital.status}
                            </Badge>
                            {isUpload && (
                              <Badge variant="default" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.65rem', padding: '0.125rem 0.375rem' }}>
                                📤 Upload
                              </Badge>
                            )}
                          </div>
                          
                          {/* Badges de Análise */}
                          {isAnalisado ? (
                            <Badge variant="default" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                              ✨ IA ({score || 0}%)
                            </Badge>
                          ) : isErro ? (
                            <Badge 
                              variant="danger" 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title={edital.erroAnalise || 'Falha na análise por IA'}
                            >
                              <AlertCircle style={{ width: '0.75rem', height: '0.75rem' }} /> Falha IA
                            </Badge>
                          ) : isPendente ? (
                            <Badge variant="default" style={{ backgroundColor: 'transparent', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' }}>
                              <RefreshCw className="animate-spin" style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.25rem' }} /> Pendente
                            </Badge>
                          ) : (
                            <Badge variant="default" style={{ backgroundColor: 'transparent', color: 'var(--color-gray-600)', border: '1px solid var(--color-gray-300)' }}>Não Analisado</Badge>
                          )}
                        </div>
                        
                        <CardTitle style={{ fontSize: 'var(--font-size-lg)', lineHeight: 1.25, minHeight: '2.5rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {edital.codigo && (
                              <Badge variant="default" style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem', fontWeight: 600, backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-600)', border: '1px solid var(--color-gray-300)' }}>
                                {edital.codigo}
                              </Badge>
                            )}
                            <span style={{ flex: 1 }}>{edital.titulo}</span>
                          </span>
                        </CardTitle>
                        <p className="text-sm text-gray-600" style={{ marginTop: '0.25rem' }}>{edital.orgao}</p>
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="text-xs text-slate-500 font-medium dark:text-slate-400">Área:</span>
                          <select
                            value={edital.categoriaArea || 'Cultura'}
                            onChange={(e) => handleUpdateCategoriaArea(edital.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-200"
                          >
                            <option value="Cultura">🎭 Cultura</option>
                            <option value="Pesquisa">🔬 Pesquisa</option>
                            <option value="Esporte">⚽ Esporte</option>
                            <option value="Infraestrutura">🚧 Infraestrutura</option>
                            <option value="Outros">📁 Outros</option>
                          </select>
                        </div>
                      </CardHeader>
                      
                      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'between' }}>
                        <p className="text-sm text-gray-600 line-clamp-3" style={{ marginBottom: '1.5rem', flexGrow: 1 }}>
                          {stripHtmlTags(edital.analiseIA?.resumo || edital.descricao)}
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', borderTop: '1px dashed var(--color-gray-200)', paddingTop: '1rem' }}>
                          <div className="flex items-center justify-between text-sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="text-gray-600">Valor Estimado:</span>
                            <span className="font-semibold text-gray-900 line-clamp-1 text-right" style={{ maxWidth: '60%' }} title={formatarValorBRL(edital.valor)}>{formatarValorBRL(edital.valor)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="text-gray-600">Data de Fechamento:</span>
                            <span className="font-semibold text-gray-900" style={{ color: 'var(--color-warning)' }}>{edital.dataLimite}</span>
                          </div>
                        </div>

<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {isAnalisado ? (
                            <>
                              <Button 
                                variant="default" 
                                className="w-full"
                                onClick={() => setEditalSelecionado(edital)}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                  fontWeight: 500,
                                  background: 'var(--color-primary)',
                                  color: 'white',
                                  border: 'none'
                                }}
                              >
                                Ver Catálogo IA
                                <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={(e) => handleReanalisarEdital(edital.id, e)}
                                disabled={reanalyzing === edital.id}
                                style={{
                                  flex: 0,
                                  padding: '0.5rem',
                                  color: 'var(--color-primary)',
                                  borderColor: 'var(--color-primary)'
                                }}
                                title="Re-analisar com IA"
                              >
                                {reanalyzing === edital.id ? (
                                  <RefreshCw className="animate-spin" style={{ width: '1rem', height: '1rem' }} />
                                ) : (
                                  <RefreshCw style={{ width: '1rem', height: '1rem' }} />
                                )}
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={(e) => handleDeletarEdital(edital.id, edital.titulo, e)}
                                disabled={deleting === edital.id}
                                style={{ 
                                  flex: 0,
                                  padding: '0.5rem',
                                  color: 'var(--color-danger)',
                                  borderColor: 'var(--color-danger)'
                                }}
                                title="Deletar este edital"
                              >
                                <Trash2 style={{ width: '1rem', height: '1rem' }} />
                              </Button>
                            </>
) : (
                            <>
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => setEditalSelecionado(edital)}
                                style={{ flex: 1, padding: '0 0.5rem' }}
                              >
                                Detalhes
                              </Button>
                              <Button 
                                variant="default"
                                onClick={(e) => handleAnalisarEdital(edital.id, e)}
                                disabled={analyzing === edital.id}
                                style={{ 
                                  flex: 1, 
                                  padding: '0 0.5rem', 
                                  background: 'var(--color-primary)',
                                  color: 'white',
                                  border: 'none'
                                }}
                              >
                                {analyzing === edital.id ? 'Analisando...' : 'Analisar'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={(e) => handleReanalisarEdital(edital.id, e)}
                                disabled={reanalyzing === edital.id}
                                style={{
                                  flex: 0,
                                  padding: '0.5rem',
                                  color: 'var(--color-primary)',
                                  borderColor: 'var(--color-primary)'
                                }}
                                title="Re-analisar com IA completa"
                              >
                                {reanalyzing === edital.id ? (
                                  <RefreshCw className="animate-spin" style={{ width: '1rem', height: '1rem' }} />
                                ) : (
                                  <RefreshCw style={{ width: '1rem', height: '1rem' }} />
                                )}
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={(e) => handleDeletarEdital(edital.id, edital.titulo, e)}
                                disabled={deleting === edital.id}
                                style={{ 
                                  flex: 0,
                                  padding: '0.5rem',
                                  color: 'var(--color-danger)',
                                  borderColor: 'var(--color-danger)'
                                }}
                                title="Deletar este edital"
                              >
                                <Trash2 style={{ width: '1rem', height: '1rem' }} />
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

        </div>
          </>
        ) : (
          <EditalReviewPanel />
        )}

      </div>

      {/* Modal/Drawer Elegante de Análise da IA do Edital */}
      {editalSelecionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--color-gray-200)'
          }}>
            
            {/* Header Modal */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--color-gray-100)',
              display: 'flex',
              justifyContent: 'between',
              alignItems: 'start',
              position: 'relative'
            }}>
              <div style={{ paddingRight: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <Badge variant="success">{editalSelecionado.status}</Badge>
                  <Badge variant="default" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: 'none' }}>
                    Data Limite: {editalSelecionado.dataLimite}
                  </Badge>
                  {editalSelecionado.modalidade && (
                     <Badge variant="default" style={{ backgroundColor: 'transparent', color: 'var(--color-gray-700)', border: '1px solid var(--color-gray-300)' }}>{editalSelecionado.modalidade}</Badge>
                  )}
                  {editalSelecionado.analiseIA?.scoreAdequacao && (
                     <Badge variant="default" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                        Compatibilidade: {editalSelecionado.analiseIA.scoreAdequacao}%
                     </Badge>
                  )}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gray-900)', lineHeight: 1.3 }}>
                  {editalSelecionado.titulo}
                </h3>
                <p className="text-sm text-gray-600" style={{ marginTop: '0.25rem' }}>{editalSelecionado.orgao}</p>
              </div>
              
              <button 
                onClick={() => setEditalSelecionado(null)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-gray-400)',
                  padding: '0.25rem',
                  borderRadius: '50%',
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* Corpo Scrollable */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Seção Resumo do edital */}
              <div>
                <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <ListChecks style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-primary)' }} />
                  Visão Geral do Edital
                </h4>
                <div 
                  className="text-sm text-gray-600" 
                  style={{ lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: editalSelecionado.analiseIA?.resumo || editalSelecionado.descricao }}
                />
                {editalSelecionado.analiseIA?.objetivo && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                    <strong>Objetivo:</strong> {editalSelecionado.analiseIA.objetivo}
                  </div>
                )}
              </div>

              {/* Seção Elegibilidade e Dados Principais */}
              <div style={{ backgroundColor: 'var(--color-gray-50)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-success)' }} />
                  Quem Pode Participar (Elegibilidade)
                </h4>
                <p className="text-sm text-gray-600" style={{ lineHeight: 1.5 }}>
                  {editalSelecionado.analiseIA?.elegibilidade || 'Detalhes pendentes.'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', fontSize: '0.875rem' }}>
                   {editalSelecionado.areasTematicas && editalSelecionado.areasTematicas.length > 0 && (
                     <div><strong>Áreas:</strong> {editalSelecionado.areasTematicas.join(', ')}</div>
                   )}
                   {editalSelecionado.abrangencia && (
                     <div><strong>Abrangência:</strong> {editalSelecionado.abrangencia}</div>
                   )}
                </div>
              </div>

              {/* Grid 2 colunas para Requisitos e Itens Financiáveis */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

                {/* Requisitos Obrigatórios */}
                <div>
                  <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <ChevronRight style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-primary)' }} />
                    Requisitos Obrigatórios
                  </h4>
                  <ul style={{ paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none' }}>
                    {requisitosEditados.length === 0 && (
                      <li className="text-sm text-gray-600" style={{ lineHeight: 1.4, fontStyle: 'italic' }}>
                        Nenhum requisito adicionado.
                      </li>
                    )}
                    {requisitosEditados.map((req, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <button
                          onClick={() => setRequisitosEditados(prev => prev.filter((_, idx) => idx !== i))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            padding: '2px 4px',
                            fontSize: '1rem',
                            lineHeight: 1,
                            minWidth: '20px',
                            minHeight: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Remover"
                        >
                          −
                        </button>
                        <span className="text-sm text-gray-600" style={{ lineHeight: 1.4 }}>{req}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Novo requisito..."
                      id="novo-requisito"
                      style={{
                        flex: 1,
                        padding: '0.375rem 0.625rem',
                        border: '1px solid var(--color-gray-300)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'var(--color-background)'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const val = input.value.trim();
                          if (val) {
                            setRequisitosEditados(prev => [...prev, val]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('novo-requisito') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val) {
                          setRequisitosEditados(prev => [...prev, val]);
                          input.value = '';
                        }
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>

                {/* Itens Financiáveis */}
                <div>
                  <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <ChevronRight style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-success)' }} />
                    Itens Financiáveis
                  </h4>
                  <ul style={{ paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none' }}>
                    {itensFinanciaveisEditados.length === 0 && (
                      <li className="text-sm text-gray-600" style={{ lineHeight: 1.4, fontStyle: 'italic' }}>
                        Nenhum item adicionado.
                      </li>
                    )}
                    {itensFinanciaveisEditados.map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <button
                          onClick={() => setItensFinanciaveisEditados(prev => prev.filter((_, idx) => idx !== i))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            padding: '2px 4px',
                            fontSize: '1rem',
                            lineHeight: 1,
                            minWidth: '20px',
                            minHeight: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Remover"
                        >
                          −
                        </button>
                        <span className="text-sm text-gray-600" style={{ lineHeight: 1.4 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Novo item..."
                      id="novo-item"
                      style={{
                        flex: 1,
                        padding: '0.375rem 0.625rem',
                        border: '1px solid var(--color-gray-300)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'var(--color-background)'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const val = input.value.trim();
                          if (val) {
                            setItensFinanciaveisEditados(prev => [...prev, val]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('novo-item') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val) {
                          setItensFinanciaveisEditados(prev => [...prev, val]);
                          input.value = '';
                        }
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'var(--color-success)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {/* Documentos e Alertas */}
              {editalSelecionado.analiseIA?.pontosFracos && editalSelecionado.analiseIA.pontosFracos.length > 0 && (
                <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2' }}>
                  <h4 style={{ fontWeight: 600, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <AlertTriangle style={{ width: '1.1rem', height: '1.1rem' }} />
                    Pontos de Atenção / Alertas
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {editalSelecionado.analiseIA.pontosFracos.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            {/* Footer Modal */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid var(--color-gray-100)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'var(--color-gray-50)'
            }}>
              <Button 
                variant="outline" 
                onClick={(e) => {
                  if (editalSelecionado) {
                    handleDeletarEdital(editalSelecionado.id, editalSelecionado.titulo, e as any);
                    setEditalSelecionado(null);
                  }
                }}
                disabled={deleting === editalSelecionado?.id}
                style={{ 
                  color: 'var(--color-danger)',
                  borderColor: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Trash2 style={{ width: '1rem', height: '1rem' }} />
                Deletar Edital
              </Button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" onClick={() => setEditalSelecionado(null)}>
                  Fechar
                </Button>
                <a href={editalSelecionado.link} target="_blank" rel="noopener noreferrer">
                  <Button style={{
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none'
                  }}>
                    Ir para o Portal Oficial
                  </Button>
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Upload de PDF */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Upload de Edital</h3>
                  <p className="text-xs text-slate-400">Envie um PDF para análise automática</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadResult(null);
                  setUploadProgress(0);
                }}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {!uploadResult ? (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* Drop zone */}
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${selectedFile ? 'border-green-500/50 bg-green-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'}`}>
                      <FileUp className={`w-12 h-12 mx-auto mb-3 ${selectedFile ? 'text-green-400' : 'text-slate-500'}`} />
                      {selectedFile ? (
                        <>
                          <p className="text-green-400 font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-slate-300 font-medium">Arraste o PDF aqui ou clique</p>
                          <p className="text-xs text-slate-500 mt-1">Máximo 50MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Campos */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Título (opcional)</label>
                      <Input
                        id="upload-titulo"
                        placeholder="Deixe vazio para usar o nome do arquivo"
                        className="bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Órgão (opcional)</label>
                      <Input
                        id="upload-orgao"
                        placeholder="Ex: FINEP, CNPq, CAPES"
                        className="bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Área / Categoria</label>
                      <select
                        id="upload-categoria"
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Cultura">🎭 Cultura</option>
                        <option value="Pesquisa">🔬 Pesquisa</option>
                        <option value="Esporte">⚽ Esporte</option>
                        <option value="Infraestrutura">🚧 Infraestrutura</option>
                        <option value="Outros">📁 Outros</option>
                      </select>
                    </div>
                  </div>

                  {/* Progress */}
                  {uploading && (
                    <div className="space-y-2">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 text-center">
                        Processando PDF... {uploadProgress}%
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadResult(null);
                        setUploadProgress(0);
                      }}
                      disabled={uploading}
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={uploading || !selectedFile}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none"
                    >
                      {uploading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analisando...
                        </span>
                      ) : (
                        'Analisar'
                      )}
                    </Button>
                  </div>
                </form>
              ) : uploadResult.erros && uploadResult.erros.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">Erro no processamento</span>
                    </div>
                    {uploadResult.erros.map((erro: string, i: number) => (
                      <p key={i} className="text-sm text-red-300/80">{erro}</p>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadResult(null);
                        setUploadProgress(0);
                        setSelectedFile(null);
                      }}
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Tentar Novamente
                    </Button>
                    <Button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadResult(null);
                        setUploadProgress(0);
                        fetchEditais();
                      }}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white border-none"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-100">Edital processado!</p>
                        <p className="text-xs text-slate-400">Análise por IA concluída</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">Título</span>
                        <span className="text-slate-200 font-medium truncate max-w-[200px]">{uploadResult.titulo}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">Tecnologia</span>
                        <span className="text-blue-400">{uploadResult.tecnologiaFoco}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">Score IA</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-green-400"
                              style={{ width: `${uploadResult.scoreRelevancia}%` }}
                            />
                          </div>
                          <span className="text-slate-200">{uploadResult.scoreRelevancia}</span>
                        </div>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-400">Confiança</span>
                        <span className="text-green-400">{uploadResult.confiancaIA}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadResult(null);
                        setUploadProgress(0);
                      }}
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Fechar
                    </Button>
                    <Button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadResult(null);
                        setUploadProgress(0);
                        fetchEditais();
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none"
                    >
                      Ver na Lista
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <ProcessingOverlay
        isOpen={analyzing !== null || reanalyzing !== null}
        title={reanalyzing !== null ? "Re-analisando Edital com IA..." : "Analisando Edital com IA..."}
        message="A inteligência artificial está lendo o arquivo PDF, dividindo o conteúdo em partes (chunks) e extraindo resumos, prazos, elegibilidade, valores e requisitos de conformidade. Aguarde, pois isso pode levar até 1 minuto."
      />
    </MainLayout>
  );
}

