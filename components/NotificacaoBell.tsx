'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Notificacao {
  id: string;
  titulo: string;
  descricao: string;
  quantidade?: number;
  link: string;
  lida: boolean;
  criadoEm: string;
  urgencia?: 'baixa' | 'media' | 'alta';
}

/**
 * Componente de sino de notificações
 * Exibe badge com número de notificações não lidas
 */
export const NotificacaoBell: React.FC = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  // Buscar notificações
  const buscarNotificacoes = async () => {
    try {
      setCarregando(true);
      const response = await fetch('/api/editais/notificar?lida=false&limite=5');
      const data = await response.json();
      if (data.success) {
        setNotificacoes(data.notificacoes);
      }
    } catch (erro) {
      console.error('Erro ao buscar notificações:', erro);
    } finally {
      setCarregando(false);
    }
  };

  // Buscar notificações ao montar
  useEffect(() => {
    buscarNotificacoes();

    // Atualizar a cada 30 segundos
    const interval = setInterval(buscarNotificacoes, 30000);
    return () => clearInterval(interval);
  }, []);

  // Marcar como lida
  const marcarComoLida = async (id: string) => {
    try {
      await fetch('/api/editais/notificar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      buscarNotificacoes();
    } catch (erro) {
      console.error('Erro ao marcar como lida:', erro);
    }
  };

  // Contar notificações não lidas
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const getCorUrgencia = (urgencia?: string): string => {
    switch (urgencia) {
      case 'alta':
        return '#ef4444';
      case 'media':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* BOTÃO DO SINO */}
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '6px',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#e5e7eb';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        🔔

        {/* BADGE */}
        {naoLidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '10px',
              minWidth: '20px',
              textAlign: 'center'
            }}
          >
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {aberto && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            minWidth: '320px',
            maxWidth: '400px',
            zIndex: 1000,
            maxHeight: '400px',
            overflow: 'auto'
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              fontWeight: '600',
              fontSize: '14px',
              color: '#374151',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Notificações {naoLidas > 0 && `(${naoLidas})`}</span>
            {carregando && <span style={{ fontSize: '12px', color: '#9ca3af' }}>⏳</span>}
          </div>

          {/* LISTA */}
          {notificacoes.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px'
              }}
            >
              Nenhuma notificação
            </div>
          ) : (
            notificacoes.map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  backgroundColor: notif.lida ? '#fff' : '#f0f9ff',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = notif.lida ? '#fff' : '#f0f9ff';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '4px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: notif.lida ? '#d1d5db' : getCorUrgencia(notif.urgencia),
                        flexShrink: 0
                      }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}
                    >
                      {notif.titulo}
                    </span>
                  </div>
                  {notif.quantidade && (
                    <span
                      style={{
                        backgroundColor: getCorUrgencia(notif.urgencia),
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginLeft: '8px',
                        flexShrink: 0
                      }}
                    >
                      {notif.quantidade}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: '#6b7280',
                    lineHeight: '1.4'
                  }}
                >
                  {notif.descricao}
                </p>

                <div
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'space-between'
                  }}
                >
                  <button
                    onClick={() => {
                      router.push(notif.link);
                      setAberto(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: getCorUrgencia(notif.urgencia),
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Ver
                  </button>

                  {!notif.lida && (
                    <button
                      onClick={() => marcarComoLida(notif.id)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* FOOTER */}
          {notificacoes.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                textAlign: 'center',
                borderTop: '1px solid #e5e7eb',
                fontSize: '12px'
              }}
            >
              <a
                href="/notificacoes"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Ver todas
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacaoBell;
