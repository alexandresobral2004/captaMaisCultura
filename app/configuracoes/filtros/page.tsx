'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { TermTag } from '@/components/ui/term-tag';
import { PipelineVisualizer, PipelineStepStatus } from '@/components/ui/pipeline-step';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastContainer, Toast } from '@/components/ui/toast';
import {
  Filter,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Plus,
  Search,
  ChevronRight,
  Trash2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Minus,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Categoria = 'tecnologia' | 'contexto_institucional' | 'contexto_geral';

interface WhitelistData {
  tecnologia: string[];
  contexto_institucional: string[];
  contexto_geral: string[];
}

interface BlacklistData {
  blacklist: string[];
  excecoes: Record<string, string[]>;
}

interface FiltrosStats {
  totalWhitelist: number;
  totalBlacklist: number;
  totalComExcecoes: number;
  totalSemExcecoes: number;
  coberturaPorCategoria: { tecnologia: number; contexto_institucional: number; contexto_geral: number };
}

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

// ─── Toast helpers ────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message, duration: 4000 }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<Categoria, string> = {
  tecnologia: 'Tecnologia',
  contexto_institucional: 'Contexto Institucional',
  contexto_geral: 'Contexto Geral',
};

const GENERIC_TERMS = ['edital', 'projeto', 'programa', 'solução', 'ferramenta', 'bolsa', 'auxílio', 'investimento'];

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'whitelist' | 'blacklist' | 'simulador';

export default function FiltrosPage() {
  const { toasts, addToast, removeToast } = useToasts();

  // Data state
  const [whitelist, setWhitelist] = useState<WhitelistData | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistData | null>(null);
  const [stats, setStats] = useState<FiltrosStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('whitelist');

  // ── Whitelist state ──
  const [whitelistSearch, setWhitelistSearch] = useState('');
  const [activeCategoria, setActiveCategoria] = useState<Categoria>('tecnologia');
  const [novoTermoWL, setNovoTermoWL] = useState('');
  const [addingWL, setAddingWL] = useState(false);

  // ── Blacklist state ──
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [expandedTermos, setExpandedTermos] = useState<Set<string>>(new Set());
  const [novoTermoBL, setNovoTermoBL] = useState('');
  const [addingBL, setAddingBL] = useState(false);
  const [addingExcecaoFor, setAddingExcecaoFor] = useState<string | null>(null);
  const [novaExcecao, setNovaExcecao] = useState('');

  // ── Simulator state ──
  const [simTitulo, setSimTitulo] = useState('');
  const [simDescricao, setSimDescricao] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulacaoResult | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/filtros');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
      setWhitelist(data.whitelist);
      setBlacklist(data.blacklist);
      setStats(data.stats);
    } catch (err: any) {
      addToast('error', 'Falha ao carregar filtros', err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Whitelist actions ───────────────────────────────────────────────────────

  const handleAddWhitelist = async () => {
    const termo = novoTermoWL.trim().toLowerCase();
    if (!termo) return;
    setAddingWL(true);
    try {
      const res = await fetch('/api/v1/filtros/whitelist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: activeCategoria, termo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWhitelist((prev) => {
        if (!prev) return prev;
        const lista = [...prev[activeCategoria], termo].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return { ...prev, [activeCategoria]: lista };
      });
      setStats((prev) => prev ? { ...prev, totalWhitelist: prev.totalWhitelist + 1, coberturaPorCategoria: { ...prev.coberturaPorCategoria, [activeCategoria]: prev.coberturaPorCategoria[activeCategoria] + 1 } } : prev);
      setNovoTermoWL('');
      addToast('success', 'Termo adicionado', `"${termo}" adicionado em ${CATEGORIA_LABELS[activeCategoria]}`);
    } catch (err: any) {
      addToast('error', 'Erro ao adicionar', err.message);
    } finally {
      setAddingWL(false);
    }
  };

  const handleRemoveWhitelist = async (categoria: Categoria, termo: string) => {
    try {
      const res = await fetch('/api/v1/filtros/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, termo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWhitelist((prev) => {
        if (!prev) return prev;
        return { ...prev, [categoria]: prev[categoria].filter((t) => t !== termo) };
      });
      setStats((prev) => prev ? { ...prev, totalWhitelist: prev.totalWhitelist - 1, coberturaPorCategoria: { ...prev.coberturaPorCategoria, [categoria]: prev.coberturaPorCategoria[categoria] - 1 } } : prev);
      addToast('success', 'Termo removido', `"${termo}" removido de ${CATEGORIA_LABELS[categoria]}`);
    } catch (err: any) {
      addToast('error', 'Erro ao remover', err.message);
    }
  };

  // ─── Blacklist actions ───────────────────────────────────────────────────────

  const handleAddBlacklist = async () => {
    const termo = novoTermoBL.trim().toLowerCase();
    if (!termo) return;
    setAddingBL(true);
    try {
      const res = await fetch('/api/v1/filtros/blacklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'termo', termo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBlacklist((prev) => {
        if (!prev) return prev;
        const lista = [...prev.blacklist, termo].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return { ...prev, blacklist: lista };
      });
      setStats((prev) => prev ? { ...prev, totalBlacklist: prev.totalBlacklist + 1, totalSemExcecoes: prev.totalSemExcecoes + 1 } : prev);
      setNovoTermoBL('');
      addToast('success', 'Termo adicionado à blacklist', `"${termo}" bloqueará editais com esse conteúdo`);
    } catch (err: any) {
      addToast('error', 'Erro ao adicionar', err.message);
    } finally {
      setAddingBL(false);
    }
  };

  const handleRemoveBlacklist = async (termo: string) => {
    try {
      const res = await fetch('/api/v1/filtros/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'termo', termo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const hadExcecoes = (blacklist?.excecoes[termo]?.length ?? 0) > 0;
      setBlacklist((prev) => {
        if (!prev) return prev;
        const novasExcecoes = { ...prev.excecoes };
        delete novasExcecoes[termo];
        return { blacklist: prev.blacklist.filter((t) => t !== termo), excecoes: novasExcecoes };
      });
      setStats((prev) => prev ? {
        ...prev,
        totalBlacklist: prev.totalBlacklist - 1,
        totalComExcecoes: hadExcecoes ? prev.totalComExcecoes - 1 : prev.totalComExcecoes,
        totalSemExcecoes: !hadExcecoes ? prev.totalSemExcecoes - 1 : prev.totalSemExcecoes,
      } : prev);
      addToast('success', 'Termo removido', `"${termo}" removido da blacklist`);
    } catch (err: any) {
      addToast('error', 'Erro ao remover', err.message);
    }
  };

  const handleAddExcecao = async (termo: string) => {
    const excecao = novaExcecao.trim().toLowerCase();
    if (!excecao) return;
    try {
      const res = await fetch('/api/v1/filtros/blacklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'excecao', termo, excecao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const eraVazia = (blacklist?.excecoes[termo]?.length ?? 0) === 0;
      setBlacklist((prev) => {
        if (!prev) return prev;
        const lista = [...(prev.excecoes[termo] || []), excecao].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return { ...prev, excecoes: { ...prev.excecoes, [termo]: lista } };
      });
      if (eraVazia) {
        setStats((prev) => prev ? { ...prev, totalComExcecoes: prev.totalComExcecoes + 1, totalSemExcecoes: prev.totalSemExcecoes - 1 } : prev);
      }
      setNovaExcecao('');
      setAddingExcecaoFor(null);
      addToast('success', 'Exceção adicionada', `"${excecao}" agora neutraliza "${termo}"`);
    } catch (err: any) {
      addToast('error', 'Erro ao adicionar exceção', err.message);
    }
  };

  const handleRemoveExcecao = async (termo: string, excecao: string) => {
    try {
      const res = await fetch('/api/v1/filtros/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'excecao', termo, excecao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const excecoesRestantes = (blacklist?.excecoes[termo] || []).filter((e) => e !== excecao);
      setBlacklist((prev) => {
        if (!prev) return prev;
        const novasExcecoes = { ...prev.excecoes };
        if (excecoesRestantes.length === 0) {
          delete novasExcecoes[termo];
        } else {
          novasExcecoes[termo] = excecoesRestantes;
        }
        return { ...prev, excecoes: novasExcecoes };
      });
      if (excecoesRestantes.length === 0) {
        setStats((prev) => prev ? { ...prev, totalComExcecoes: prev.totalComExcecoes - 1, totalSemExcecoes: prev.totalSemExcecoes + 1 } : prev);
      }
      addToast('success', 'Exceção removida', `"${excecao}" removida de "${termo}"`);
    } catch (err: any) {
      addToast('error', 'Erro ao remover exceção', err.message);
    }
  };

  // ─── Simulator ───────────────────────────────────────────────────────────────

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
      addToast('error', 'Erro na simulação', err.message);
    } finally {
      setSimLoading(false);
    }
  };

  // ─── Filtered lists ───────────────────────────────────────────────────────────

  const filteredWhitelistTerms = whitelist
    ? whitelist[activeCategoria].filter((t) =>
        whitelistSearch ? t.toLowerCase().includes(whitelistSearch.toLowerCase()) : true
      )
    : [];

  const filteredBlacklistTerms = blacklist
    ? blacklist.blacklist.filter((t) =>
        blacklistSearch ? t.toLowerCase().includes(blacklistSearch.toLowerCase()) : true
      )
    : [];

  // ─── Pipeline steps config ────────────────────────────────────────────────────

  const getPipelineSteps = () => [
    {
      step: 1,
      label: 'Whitelist',
      description: `${stats?.coberturaPorCategoria.tecnologia ?? '–'} termos tech • ${stats?.coberturaPorCategoria.contexto_institucional ?? '–'} institucionais • ${stats?.coberturaPorCategoria.contexto_geral ?? '–'} gerais`,
    },
    {
      step: 2,
      label: 'Blacklist',
      description: `${stats?.totalBlacklist ?? '–'} termos • Score > 45 bloqueia • ${stats?.totalSemExcecoes ?? '–'} sem exceção`,
    },
    {
      step: 3,
      label: 'IA (OpenAI)',
      description: 'Classificação final — chamada apenas se etapas 1 e 2 passarem',
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div>
          <h2 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Filter style={{ width: '1.75rem', height: '1.75rem', color: 'var(--color-primary)' }} />
            Filtros de Editais
          </h2>
          <p className="dashboard-subtitle">
            Controle o que o sistema baixa e o que descarta — whitelist, blacklist e exceções contextuais.
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner />
          </div>
        ) : (
          <>
            <div className="filtros-stats-grid">
              <div className="filtros-stat-card">
                <span className="filtros-stat-value" style={{ color: 'var(--color-primary)' }}>
                  {stats?.totalWhitelist ?? '–'}
                </span>
                <span className="filtros-stat-label">Termos na Whitelist</span>
              </div>
              <div className="filtros-stat-card">
                <span className="filtros-stat-value" style={{ color: '#dc2626' }}>
                  {stats?.totalBlacklist ?? '–'}
                </span>
                <span className="filtros-stat-label">Termos na Blacklist</span>
              </div>
              <div className="filtros-stat-card">
                <span className="filtros-stat-value" style={{ color: '#059669' }}>
                  {stats?.totalComExcecoes ?? '–'}
                </span>
                <span className="filtros-stat-label">Com Exceções Mapeadas</span>
              </div>
              <div className="filtros-stat-card">
                <span className="filtros-stat-value" style={{ color: '#d97706' }}>
                  {stats?.totalSemExcecoes ?? '–'}
                </span>
                <span className="filtros-stat-label">Sem Exceção (⚠️ risco)</span>
              </div>
            </div>

            {/* Pipeline visual */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', background: 'var(--color-background)' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-primary)' }}>
                Pipeline de Classificação
              </p>
              <PipelineVisualizer steps={getPipelineSteps()} />
              <p style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Score blacklist: <strong>1–20 → penalizar (passa)</strong> · <strong>21–45 → revisar (passa)</strong> · <strong>&gt; 45 → bloquear ❌</strong>
              </p>
            </div>

            {/* Tabs */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', background: 'var(--color-background)' }}>
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${activeTab === 'whitelist' ? 'active' : ''}`}
                  onClick={() => setActiveTab('whitelist')}
                  id="tab-whitelist"
                >
                  <ShieldCheck style={{ width: '1rem', height: '1rem' }} />
                  Whitelist
                  <span className="filter-tab-count">{stats?.totalWhitelist ?? 0}</span>
                </button>
                <button
                  className={`filter-tab ${activeTab === 'blacklist' ? 'active' : ''}`}
                  onClick={() => setActiveTab('blacklist')}
                  id="tab-blacklist"
                >
                  <ShieldX style={{ width: '1rem', height: '1rem' }} />
                  Blacklist
                  <span className="filter-tab-count">{stats?.totalBlacklist ?? 0}</span>
                </button>
                <button
                  className={`filter-tab ${activeTab === 'simulador' ? 'active' : ''}`}
                  onClick={() => setActiveTab('simulador')}
                  id="tab-simulador"
                >
                  <FlaskConical style={{ width: '1rem', height: '1rem' }} />
                  Simulador
                </button>
              </div>

              {/* ── Tab: Whitelist ─────────────────────────────────────────── */}
              {activeTab === 'whitelist' && whitelist && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Alerta de fragilidade */}
                  <div className="alert-fragility">
                    <AlertTriangle className="alert-fragility-icon" style={{ width: '1rem', height: '1rem' }} />
                    <div>
                      <strong>Atenção — Contexto Geral muito permissivo:</strong>{' '}
                      os termos{' '}
                      {GENERIC_TERMS.map((t, i) => (
                        <span key={t}>
                          <code style={{ background: '#fef08a', padding: '0 3px', borderRadius: 3 }}>{t}</code>
                          {i < GENERIC_TERMS.length - 1 ? ', ' : ''}
                        </span>
                      ))}{' '}
                      aprovam qualquer edital público na etapa 1. Considere removê-los para reduzir chamadas à IA.
                    </div>
                  </div>

                  {/* Category pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(['tecnologia', 'contexto_institucional', 'contexto_geral'] as Categoria[]).map((cat) => (
                      <button
                        key={cat}
                        className={`category-pill ${activeCategoria === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategoria(cat)}
                        id={`pill-${cat}`}
                      >
                        {CATEGORIA_LABELS[cat]}
                        <span style={{ fontWeight: 400, opacity: 0.7 }}>({whitelist[cat].length})</span>
                      </button>
                    ))}
                  </div>

                  {/* Search + Add */}
                  <div className="add-term-row">
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                      <Input
                        id="whitelist-search"
                        placeholder="Buscar termos..."
                        value={whitelistSearch}
                        onChange={(e) => setWhitelistSearch(e.target.value)}
                        style={{ paddingLeft: '2rem' }}
                      />
                    </div>
                    <Input
                      id="whitelist-new-term"
                      placeholder={`Novo termo em ${CATEGORIA_LABELS[activeCategoria]}...`}
                      value={novoTermoWL}
                      onChange={(e) => setNovoTermoWL(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddWhitelist()}
                      style={{ flex: 1 }}
                    />
                    <Button
                      id="whitelist-add-btn"
                      onClick={handleAddWhitelist}
                      disabled={addingWL || !novoTermoWL.trim()}
                    >
                      {addingWL ? <Spinner /> : <Plus style={{ width: '1rem', height: '1rem' }} />}
                      Adicionar
                    </Button>
                  </div>

                  {/* Terms grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', minHeight: '3rem' }}>
                    {filteredWhitelistTerms.length === 0 ? (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {whitelistSearch ? 'Nenhum termo encontrado.' : 'Nenhum termo nesta categoria.'}
                      </p>
                    ) : (
                      filteredWhitelistTerms.map((termo) => (
                        <TermTag
                          key={termo}
                          term={termo}
                          variant="whitelist"
                          onRemove={() => handleRemoveWhitelist(activeCategoria, termo)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Blacklist ─────────────────────────────────────────── */}
              {activeTab === 'blacklist' && blacklist && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Scoring info */}
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>Sistema de pontuação:</strong>{' '}
                    cada termo tem <strong>15pts base + 5pts</strong> por ocorrência extra (máx 35pts/termo).{' '}
                    Score <strong>&gt; 45 → bloqueia</strong> · 21–45 → só loga · 1–20 → só loga.{' '}
                    Exceções neutralizam o termo no contexto certo.
                  </div>

                  {/* Search + Add */}
                  <div className="add-term-row">
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                      <Input
                        id="blacklist-search"
                        placeholder="Buscar termos..."
                        value={blacklistSearch}
                        onChange={(e) => setBlacklistSearch(e.target.value)}
                        style={{ paddingLeft: '2rem' }}
                      />
                    </div>
                    <Input
                      id="blacklist-new-term"
                      placeholder="Novo termo para bloquear..."
                      value={novoTermoBL}
                      onChange={(e) => setNovoTermoBL(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddBlacklist()}
                      style={{ flex: 1 }}
                    />
                    <Button
                      id="blacklist-add-btn"
                      variant="outline"
                      onClick={handleAddBlacklist}
                      disabled={addingBL || !novoTermoBL.trim()}
                      style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                    >
                      {addingBL ? <Spinner /> : <Plus style={{ width: '1rem', height: '1rem' }} />}
                      Adicionar
                    </Button>
                  </div>

                  {/* Blacklist accordion */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {filteredBlacklistTerms.length === 0 ? (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {blacklistSearch ? 'Nenhum termo encontrado.' : 'Blacklist vazia.'}
                      </p>
                    ) : (
                      filteredBlacklistTerms.map((termo) => {
                        const excecoes = blacklist.excecoes[termo] || [];
                        const isExpanded = expandedTermos.has(termo);
                        const temExcecoes = excecoes.length > 0;

                        return (
                          <div key={termo} className="blacklist-item">
                            {/* Header */}
                            <div
                              className="blacklist-item-header"
                              onClick={() => {
                                setExpandedTermos((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(termo)) next.delete(termo);
                                  else next.add(termo);
                                  return next;
                                });
                              }}
                            >
                              <ChevronRight
                                className={`blacklist-item-chevron ${isExpanded ? 'expanded' : ''}`}
                                style={{ width: '0.875rem', height: '0.875rem' }}
                              />
                              <span className="blacklist-item-term">{termo}</span>
                              {!temExcecoes && (
                                <span title="Sem exceções — qualquer ocorrência é penalizada">
                                  <AlertTriangle style={{ width: '0.75rem', height: '0.75rem', color: '#d97706' }} />
                                </span>
                              )}
                              <span className="blacklist-item-weight">-15pts</span>
                              <button
                                id={`blacklist-remove-${termo.replace(/\s+/g, '-')}`}
                                onClick={(e) => { e.stopPropagation(); handleRemoveBlacklist(termo); }}
                                style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                                title={`Remover "${termo}"`}
                                aria-label={`Remover "${termo}"`}
                              >
                                <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                              </button>
                            </div>

                            {/* Body */}
                            {isExpanded && (
                              <div className="blacklist-item-body">
                                {!temExcecoes ? (
                                  <span className="blacklist-no-exceptions">
                                    <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} />
                                    Sem exceções — qualquer ocorrência do termo gera penalidade
                                  </span>
                                ) : (
                                  <div className="blacklist-exceptions-row">
                                    {excecoes.map((exc) => (
                                      <TermTag
                                        key={exc}
                                        term={exc}
                                        variant="exception"
                                        onRemove={() => handleRemoveExcecao(termo, exc)}
                                      />
                                    ))}
                                  </div>
                                )}

                                {/* Add exception */}
                                {addingExcecaoFor === termo ? (
                                  <div className="add-exception-inline">
                                    <input
                                      id={`excecao-input-${termo.replace(/\s+/g, '-')}`}
                                      className="add-exception-input"
                                      placeholder={`ex: "${termo} digital", "${termo} tecnológico"...`}
                                      value={novaExcecao}
                                      autoFocus
                                      onChange={(e) => setNovaExcecao(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddExcecao(termo);
                                        if (e.key === 'Escape') { setAddingExcecaoFor(null); setNovaExcecao(''); }
                                      }}
                                    />
                                    <Button variant="ghost" onClick={() => handleAddExcecao(termo)} style={{ height: '1.75rem', fontSize: 'var(--font-size-xs)', padding: '0 0.5rem' }}>
                                      ✓
                                    </Button>
                                    <Button variant="ghost" onClick={() => { setAddingExcecaoFor(null); setNovaExcecao(''); }} style={{ height: '1.75rem', fontSize: 'var(--font-size-xs)', padding: '0 0.5rem' }}>
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    id={`add-excecao-${termo.replace(/\s+/g, '-')}`}
                                    onClick={(e) => { e.stopPropagation(); setAddingExcecaoFor(termo); setNovaExcecao(''); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--font-size-xs)', color: '#166534', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
                                  >
                                    <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                                    + Exceção
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Simulador ─────────────────────────────────────────── */}
              {activeTab === 'simulador' && (
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
                        <><FlaskConical style={{ width: '1rem', height: '1rem' }} /> Simular Pipeline</>
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

                      {/* Etapa 2 — Blacklist */}
                      {simResult.whitelist.válido && (
                        <div className={`simulator-step ${simResult.blacklist.recomendacao === 'bloquear' ? 'bloqueou' : simResult.blacklist.recomendacao === 'revisar' ? 'penalizou' : simResult.blacklist.scoreNegativo > 0 ? 'penalizou' : 'passou'}`}>
                          <div className="simulator-step-header">
                            <span className="simulator-step-title">Etapa 2 — Blacklist</span>
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
                                  Score: <strong style={{ color: 'var(--color-text-primary)' }}>-{simResult.blacklist.scoreNegativo}</strong>
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
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
