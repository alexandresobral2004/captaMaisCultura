'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sanitizarHtml } from '@/lib/sanitize-html';
import { X, AlertTriangle, CheckCircle2, ListChecks, ChevronRight, Trash2 } from 'lucide-react';
import type { Edital } from './tipos';

interface AnaliseEditalDrawerProps {
  edital: Edital | null;
  excluindo: boolean;
  onFechar: () => void;
  onExcluir: (edital: Edital) => void;
}

export function AnaliseEditalDrawer({ edital, excluindo, onFechar, onExcluir }: AnaliseEditalDrawerProps) {
  const [requisitosEditados, setRequisitosEditados] = useState<string[]>([]);
  const [itensFinanciaveisEditados, setItensFinanciaveisEditados] = useState<string[]>([]);

  // Sincroniza os campos editáveis quando o edital selecionado muda
  useEffect(() => {
    setRequisitosEditados(edital?.analiseIA?.requisitos || []);
    setItensFinanciaveisEditados(edital?.analiseIA?.itensFinanciáveis || []);
  }, [edital]);

  if (!edital) return null;

  return (
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
                    <Badge variant="success">{edital.status}</Badge>
                    <Badge variant="default" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: 'none' }}>
                      Data Limite: {edital.dataLimite}
                    </Badge>
                    {edital.modalidade && (
                       <Badge variant="default" style={{ backgroundColor: 'transparent', color: 'var(--color-gray-700)', border: '1px solid var(--color-gray-300)' }}>{edital.modalidade}</Badge>
                    )}
                    {edital.analiseIA?.scoreAdequacao && (
                       <Badge variant="default" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                          Compatibilidade: {edital.analiseIA.scoreAdequacao}%
                       </Badge>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gray-900)', lineHeight: 1.3 }}>
                    {edital.titulo}
                  </h3>
                  <p className="text-sm text-gray-600" style={{ marginTop: '0.25rem' }}>{edital.orgao}</p>
                </div>
                
                <button 
                  onClick={() => onFechar()}
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
                    dangerouslySetInnerHTML={{ __html: sanitizarHtml(edital.analiseIA?.resumo || edital.descricao) }}
                  />
                  {edital.analiseIA?.objetivo && (
                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                      <strong>Objetivo:</strong> {edital.analiseIA.objetivo}
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
                    {edital.analiseIA?.elegibilidade || 'Detalhes pendentes.'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', fontSize: '0.875rem' }}>
                     {edital.areasTematicas && edital.areasTematicas.length > 0 && (
                       <div><strong>Áreas:</strong> {edital.areasTematicas.join(', ')}</div>
                     )}
                     {edital.abrangencia && (
                       <div><strong>Abrangência:</strong> {edital.abrangencia}</div>
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
                {edital.analiseIA?.pontosFracos && edital.analiseIA.pontosFracos.length > 0 && (
                  <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <AlertTriangle style={{ width: '1.1rem', height: '1.1rem' }} />
                      Pontos de Atenção / Alertas
                    </h4>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {edital.analiseIA.pontosFracos.map((p, i) => (
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
                  onClick={() => onExcluir(edital)}
                  disabled={excluindo}
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
                  <Button variant="outline" onClick={() => onFechar()}>
                    Fechar
                  </Button>
                  <a href={edital.link} target="_blank" rel="noopener noreferrer">
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
  );
}
