'use client';

import React, { useState, useEffect } from 'react';
import { Edital } from '@/lib/db/editais-store';
import EditalReviewCard from './EditalReviewCard';

/**
 * Painel completo para revisão de editais
 */
export const EditalReviewPanel: React.FC = () => {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<'pendente' | 'aprovado' | 'rejeitado'>('pendente');

  // Carregar editais
  const carregarEditais = async () => {
    setCarregando(true);
    try {
      const response = await fetch(`/api/editais/revisar?status=${filtro}`);
      const data = await response.json();

      if (data.success) {
        setEditais(data.editais);
      } else {
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        setErro(errorMsg || 'Erro ao carregar editais');
      }
    } catch (erro) {
      setErro('Erro ao carregar editais');
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  };

  // Carregar ao montar e quando filtro muda
  useEffect(() => {
    carregarEditais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Aprovar edital
  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/editais/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          acao: 'aprovar'
        })
      });

      if (response.ok) {
        // Remover da lista
        setEditais(editais.filter((e) => e.id !== id));
        alert('✅ Edital aprovado com sucesso!');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        alert(`❌ Erro: ${errorMsg || 'Erro desconhecido'}`);
      }
    } catch (erro) {
      alert('Erro ao aprovar edital');
      console.error(erro);
    }
  };

  // Rejeitar edital
  const handleReject = async (id: string) => {
    try {
      const response = await fetch('/api/editais/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          acao: 'rejeitar'
        })
      });

      if (response.ok) {
        setEditais(editais.filter((e) => e.id !== id));
        alert('❌ Edital rejeitado');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        alert(`Erro: ${errorMsg || 'Erro desconhecido'}`);
      }
    } catch (erro) {
      alert('Erro ao rejeitar edital');
      console.error(erro);
    }
  };

  // Salvar correções
  const handleSave = async (id: string, dados: any) => {
    try {
      const response = await fetch('/api/editais/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          acao: 'corrigir',
          dados
        })
      });

      if (response.ok) {
        alert('✅ Correções salvas!');
        carregarEditais(); // Recarregar
      } else {
        const data = await response.json();
        const errorMsg = typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : null);
        alert(`Erro: ${errorMsg || 'Erro desconhecido'}`);
      }
    } catch (erro) {
      alert('Erro ao salvar correções');
      console.error(erro);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700' }}>
          📋 Revisão de Editais
        </h2>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['pendente', 'aprovado', 'rejeitado'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: '8px 16px',
                backgroundColor: filtro === f ? '#3b82f6' : '#e5e7eb',
                color: filtro === f ? '#fff' : '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              {f === 'pendente' && '⏳ Pendentes'}
              {f === 'aprovado' && '✅ Aprovados'}
              {f === 'rejeitado' && '❌ Rejeitados'}
            </button>
          ))}
        </div>
      </div>

      {/* STATUS */}
      {carregando && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          ⏳ Carregando editais...
        </div>
      )}

      {erro && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px'
          }}
        >
          ❌ {erro}
        </div>
      )}

      {!carregando && editais.length === 0 && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            color: '#166534'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p style={{ margin: '0', fontWeight: '600' }}>
            {filtro === 'pendente' ? 'Nenhum edital pendente de revisão!' : 'Nenhum edital neste status'}
          </p>
        </div>
      )}

      {/* LISTA DE EDITAIS */}
      {!carregando && editais.length > 0 && (
        <div>
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>
            {editais.length} edital{editais.length !== 1 ? 'is' : ''} {filtro}
            {filtro === 'pendente' && ' aguardando revisão'}
          </p>

          {editais.map((edital) => (
            <EditalReviewCard
              key={edital.id}
              edital={edital}
              onApprove={handleApprove}
              onReject={handleReject}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EditalReviewPanel;
