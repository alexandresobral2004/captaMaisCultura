'use client';

import React, { useState } from 'react';
import { Edital } from '@/lib/db/editais-store';

interface EditalReviewCardProps {
  edital: Edital;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onSave: (id: string, dados: any) => Promise<void>;
}

/**
 * Componente para revisão visual de editais
 * Mostra scores de confiança, permite editar campos e aprovar/rejeitar
 */
export const EditalReviewCard: React.FC<EditalReviewCardProps> = ({
  edital,
  onApprove,
  onReject,
  onSave
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dadosEditados, setDadosEditados] = useState<any>({});

  // Calcular confiança média
  const calcularConfiancaMedia = (): number => {
    if (!edital.confiancaPorCampo) return 0;
    const values = Object.values(edital.confiancaPorCampo).filter((v) => typeof v === 'number') as number[];
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const confiancaMedia = calcularConfiancaMedia();

  // Determinar cor baseado em confiança
  const getCorConfianca = (valor: number): string => {
    if (valor >= 80) return '#10b981'; // verde
    if (valor >= 60) return '#f59e0b'; // amarelo
    return '#ef4444'; // vermelho
  };

  // Determinar status visual
  const getStatusBadge = (
    valor: number
  ): { texto: string; cor: string; emoji: string } => {
    if (valor >= 80) return { texto: 'Validado', cor: '#10b981', emoji: '✅' };
    if (valor >= 60) return { texto: 'Aviso', cor: '#f59e0b', emoji: '⚠️' };
    return { texto: 'Erro', cor: '#ef4444', emoji: '❌' };
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(edital.id);
    } catch (erro) {
      console.error('Erro ao aprovar:', erro);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (confirm('Tem certeza que deseja rejeitar este edital?')) {
      setIsLoading(true);
      try {
        await onReject(edital.id);
      } catch (erro) {
        console.error('Erro ao rejeitar:', erro);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(edital.id, dadosEditados);
      setIsEditing(false);
      setDadosEditados({});
    } catch (erro) {
      console.error('Erro ao salvar:', erro);
    } finally {
      setIsLoading(false);
    }
  };

  const campos = [
    { label: 'Título', key: 'titulo', tipo: 'text' },
    { label: 'Órgão', key: 'orgao', tipo: 'text' },
    { label: 'Data Limite', key: 'dataLimite', tipo: 'text' },
    { label: 'Valor Mín', key: 'valorMin', tipo: 'number' },
    { label: 'Valor Máx', key: 'valorMax', tipo: 'number' },
    { label: 'Elegibilidade', key: 'elegibilidade', tipo: 'textarea' },
    { label: 'Objetivo', key: 'objetivo', tipo: 'textarea' }
  ];

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
              📄 {edital.titulo}
            </h3>
            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              {edital.orgao} • ID: {edital.id.substring(0, 8)}
            </p>
          </div>

          {/* CONFIANÇA VISUAL */}
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: getCorConfianca(confiancaMedia),
                marginBottom: '4px'
              }}
            >
              {confiancaMedia}%
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#666',
                backgroundColor: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'inline-block'
              }}
            >
              Confiança Média
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO */}
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            marginTop: '12px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${confiancaMedia}%`,
              height: '100%',
              backgroundColor: getCorConfianca(confiancaMedia),
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* CAMPOS COM CONFIANÇA */}
      <div style={{ marginBottom: '16px', maxHeight: isEditing ? 'none' : '300px', overflow: 'hidden' }}>
        {campos.map((campo) => {
          const valor = edital[campo.key as keyof Edital];
          const confianca = edital.confiancaPorCampo?.[campo.key] || 0;
          const status = getStatusBadge(confianca);

          return (
            <div
              key={campo.key}
              style={{
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                  {campo.label}
                </label>
                <span
                  style={{
                    fontSize: '11px',
                    backgroundColor: status.cor,
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: '600'
                  }}
                >
                  {status.emoji} {confianca}%
                </span>
              </div>

              {isEditing ? (
                campo.tipo === 'textarea' ? (
                  <textarea
                    value={dadosEditados[campo.key] !== undefined ? dadosEditados[campo.key] : valor || ''}
                    onChange={(e) => setDadosEditados({ ...dadosEditados, [campo.key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      minHeight: '60px',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <input
                    type={campo.tipo}
                    value={dadosEditados[campo.key] !== undefined ? dadosEditados[campo.key] : valor || ''}
                    onChange={(e) => setDadosEditados({ ...dadosEditados, [campo.key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                )
              ) : (
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#374151',
                    wordBreak: 'break-word',
                    minHeight: '20px'
                  }}
                >
                  {valor ? String(valor) : <em style={{ color: '#9ca3af' }}>Não preenchido</em>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER COM BOTÕES */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {!isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              📝 Editar
            </button>

            <button
              onClick={handleApprove}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              ✅ Aprovar
            </button>

            <button
              onClick={handleReject}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              ❌ Rejeitar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setIsEditing(false);
                setDadosEditados({});
              }}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? '⏳ Salvando...' : '💾 Salvar Correções'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EditalReviewCard;
