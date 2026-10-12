'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, RefreshCw, AlertTriangle, FileSpreadsheet, ListChecks, AlertCircle, Trash2, FileUp } from "lucide-react";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { EditalReviewPanel } from "@/components/EditalReviewPanel";
import { FiltrosEditaisSidebar } from "@/components/editais/FiltrosEditaisSidebar";
import { filtrarEOrdenarEditais, FILTROS_INICIAIS, type FiltrosEditais } from "@/lib/editais/filtros";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnaliseEditalDrawer } from "@/components/editais/AnaliseEditalDrawer";
import type { Edital } from "@/components/editais/tipos";
import { UploadPdfModal } from "@/components/editais/UploadPdfModal";

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
  const [paraExcluir, setParaExcluir] = useState<{ id: string; titulo: string } | null>(null);
  
  const [filtros, setFiltros] = useState<FiltrosEditais>(FILTROS_INICIAIS);

  // Estado para Edital Selecionado na IA
  const [editalSelecionado, setEditalSelecionado] = useState<Edital | null>(null);

  // Estado para edição dinâmica de campos do modal

  // Estados para Upload de PDF
  const [showUploadModal, setShowUploadModal] = useState(false);

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
  const pedirExclusao = (id: string, titulo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setParaExcluir({ id, titulo });
  };

  const confirmarExclusao = async () => {
    if (!paraExcluir) return;
    const { id } = paraExcluir;
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
      setParaExcluir(null);
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

  const editaisFiltrados = filtrarEOrdenarEditais(editais, filtros);

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
          
          <FiltrosEditaisSidebar filtros={filtros} onChange={setFiltros} />

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
                <h4 style={{ fontWeight: 600, fontSize: '1.25rem' }}>Buscando editais... pode levar alguns minutos</h4>
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
                            <option value="Pesquisa">🔬 Pesquisa e Tecnologia</option>
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
                                onClick={(e) => pedirExclusao(edital.id, edital.titulo, e)}
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
                                onClick={(e) => pedirExclusao(edital.id, edital.titulo, e)}
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

      <AnaliseEditalDrawer
        edital={editalSelecionado}
        excluindo={deleting === editalSelecionado?.id}
        onFechar={() => setEditalSelecionado(null)}
        onExcluir={(e) => {
          setParaExcluir({ id: e.id, titulo: e.titulo });
          setEditalSelecionado(null);
        }}
      />
      <ConfirmDialog
        aberto={paraExcluir !== null}
        titulo="Excluir edital"
        mensagem={`Tem certeza que deseja excluir "${paraExcluir?.titulo ?? ''}"? Isso também removerá o PDF.`}
        textoConfirmar="Excluir"
        perigoso
        carregando={deleting !== null}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setParaExcluir(null)}
      />
      <UploadPdfModal aberto={showUploadModal} onFechar={() => setShowUploadModal(false)} onProcessado={fetchEditais} />
      
      <ProcessingOverlay
        isOpen={analyzing !== null || reanalyzing !== null}
        title={reanalyzing !== null ? "Re-analisando Edital com IA..." : "Analisando Edital com IA..."}
        message="A inteligência artificial está lendo o arquivo PDF, dividindo o conteúdo em partes (chunks) e extraindo resumos, prazos, elegibilidade, valores e requisitos de conformidade. Aguarde, pois isso pode levar até 1 minuto."
      />
    </MainLayout>
  );
}

