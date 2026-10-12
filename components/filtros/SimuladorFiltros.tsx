'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TermTag } from '@/components/ui/term-tag';
import { FlaskConical, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface SimulacaoResult {
  whitelist: {
    válido: boolean;
    confidence: string;
    termosEncontrados: string[];
    categoria: string;
  };
  blacklist: {
    scoreNegativo: number;
    termosEncontrados: Array<{ termo: string; ocorrencias: number; peso: number; contexto?: string }>;
    severidade: 'baixa' | 'media' | 'alta';
    recomendacao: 'penalizar' | 'revisar' | 'bloquear';
    motivos: string[];
  };
  decisao: {
    status: 'pendente' | 'descartado' | 'duvida';
    etapaQueDescartou: 'whitelist' | 'blacklist' | null;
    mensagem: string;
  };
}

export function SimuladorFiltros({ onErro }: { onErro: (mensagem: string) => void }) {
  const [simTitulo, setSimTitulo] = useState('');
  const [simDescricao, setSimDescricao] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulacaoResult | null>(null);

  const handleSimular = async () => {
    if (!simTitulo.trim()) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/v1/filtros/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: simTitulo, descricao: simDescricao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSimResult(data);
    } catch (err: any) {
      onErro(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        Teste como o pipeline classificaria um edital com base nos filtros atuais.
        A simulação <strong>não chama a IA</strong> — executa apenas as etapas 1 (whitelist) e 2 (blacklist).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-primary)' }}>
            Título do Edital *
          </label>
          <Input
            id="sim-titulo"
            placeholder="Ex: Edital de Fomento à Inteligência Artificial nas Universidades Federais"
            value={simTitulo}
            onChange={(e) => setSimTitulo(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-primary)' }}>
            Descrição (opcional)
          </label>
          <textarea
            id="sim-descricao"
            placeholder="Cole aqui um trecho da descrição do edital para uma análise mais precisa..."
            value={simDescricao}
            onChange={(e) => setSimDescricao(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: 'var(--font-size-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-background)', color: 'var(--color-text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <Button
          id="sim-run-btn"
          onClick={handleSimular}
          disabled={simLoading || !simTitulo.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          {simLoading ? (
            <><Spinner /> Simulando...</>
          ) : (
            <><FlaskConical style={{ width: '1rem', height: '1rem' }} /> Testar filtros</>
          )}
        </Button>
      </div>

      {/* Result */}
      {simResult && (
        <div className="simulator-result">
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Resultado da Simulação
          </p>

          {/* Etapa 1 — Whitelist */}
          <div className={`simulator-step ${simResult.whitelist.válido ? 'passou' : 'bloqueou'}`}>
            <div className="simulator-step-header">
              <span className="simulator-step-title">Etapa 1 — Whitelist</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                {simResult.whitelist.válido ? (
                  <><CheckCircle2 style={{ width: '0.875rem', height: '0.875rem', color: '#059669' }} /> PASSOU</>
                ) : (
                  <><XCircle style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} /> BLOQUEOU</>
                )}
              </span>
            </div>
            {simResult.whitelist.válido && (
              <>
                <p className="simulator-step-detail">
                  Confiança: <strong>{simResult.whitelist.confidence}</strong> · Categoria: <strong>{simResult.whitelist.categoria}</strong>
                </p>
                {simResult.whitelist.termosEncontrados.length > 0 && (
                  <div className="simulator-step-terms">
                    {simResult.whitelist.termosEncontrados.slice(0, 10).map((t) => (
                      <TermTag key={t} term={t} variant="whitelist" />
                    ))}
                    {simResult.whitelist.termosEncontrados.length > 10 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        +{simResult.whitelist.termosEncontrados.length - 10} mais
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {!simResult.whitelist.válido && (
              <p className="simulator-step-detail">Nenhum termo TI encontrado — edital seria descartado aqui sem chamar a IA.</p>
            )}
          </div>

          {/* Etapa 2 — Termos de descarte */}
          {simResult.whitelist.válido && (
            <div className={`simulator-step ${simResult.blacklist.recomendacao === 'bloquear' ? 'bloqueou' : simResult.blacklist.recomendacao === 'revisar' ? 'penalizou' : simResult.blacklist.scoreNegativo > 0 ? 'penalizou' : 'passou'}`}>
              <div className="simulator-step-header">
                <span className="simulator-step-title">Etapa 2 — Termos de descarte</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  {simResult.blacklist.recomendacao === 'bloquear' ? (
                    <><XCircle style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} /> BLOQUEOU</>
                  ) : simResult.blacklist.scoreNegativo > 0 ? (
                    <><AlertCircle style={{ width: '0.875rem', height: '0.875rem', color: '#d97706' }} /> {simResult.blacklist.recomendacao.toUpperCase()} (passa)</>
                  ) : (
                    <><CheckCircle2 style={{ width: '0.875rem', height: '0.875rem', color: '#059669' }} /> LIMPA</>
                  )}
                </span>
              </div>

              {simResult.blacklist.scoreNegativo > 0 && (
                <>
                  <div className="score-bar-container" style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', minWidth: '5rem' }}>
                      Nota: <strong style={{ color: 'var(--color-text-primary)' }}>-{simResult.blacklist.scoreNegativo}</strong>
                    </span>
                    <div className="score-bar-track">
                      <div
                        className={`score-bar-fill ${simResult.blacklist.severidade}`}
                        style={{ width: `${Math.min(100, (simResult.blacklist.scoreNegativo / 75) * 100)}%` }}
                      />
                    </div>
                    <span className="score-bar-value" style={{ color: simResult.blacklist.severidade === 'alta' ? '#dc2626' : simResult.blacklist.severidade === 'media' ? '#d97706' : '#059669' }}>
                      {simResult.blacklist.scoreNegativo}/75+
                    </span>
                  </div>

                  {simResult.blacklist.termosEncontrados.map((t) => (
                    <p key={t.termo} className="simulator-step-detail">
                      → <strong>{t.termo}</strong> ({t.ocorrencias}x, -{t.peso}pts)
                      {t.contexto ? <span style={{ color: '#059669' }}> · {t.contexto}</span> : ''}
                    </p>
                  ))}
                </>
              )}
              {simResult.blacklist.scoreNegativo === 0 && (
                <p className="simulator-step-detail">Nenhum termo da blacklist encontrado.</p>
              )}
            </div>
          )}

          {/* Decisão final */}
          <div className={`simulator-step ${simResult.decisao.status}`} style={{ borderWidth: 2 }}>
            <div className="simulator-step-header">
              <span className="simulator-step-title">
                {simResult.decisao.status === 'pendente' && '🟢 Decisão Final — PENDENTE'}
                {simResult.decisao.status === 'descartado' && '🔴 Decisão Final — DESCARTADO'}
                {simResult.decisao.status === 'duvida' && '🟡 Decisão Final — DÚVIDA'}
              </span>
            </div>
            <p className="simulator-step-detail">{simResult.decisao.mensagem}</p>
          </div>
        </div>
      )}
    </div>
  );
}
