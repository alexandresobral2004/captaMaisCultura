'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/contexts/toast-context';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useConfirm } from '@/contexts/confirm-context';
import { LogEntry, LogStats, LogsResponse, nivelConfig, formatDate, getBadgeVariant } from '@/components/logs/tipos';
import { LogDetalheDrawer } from '@/components/logs/LogDetalheDrawer';

const nivelOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'error', label: 'Erros' },
  { value: 'warning', label: 'Avisos' },
  { value: 'info', label: 'Informação' },
];

const cenarioOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'login', label: 'Login' },
  { value: 'session_expired', label: 'Sessão Expirada' },
  { value: 'token_acquisition', label: 'Acesso ao portal' },
  { value: 'scrape_editais', label: 'Busca de editais' },
  { value: 'download_pdf', label: 'Baixar PDF' },
  { value: 'network_error', label: 'Falha de internet' },
  { value: 'timeout', label: 'Demorou demais' },
  { value: 'busca_portal', label: 'Busca em portal' },
  { value: 'analise_ia', label: 'Análise IA' },
  { value: 'api_openai', label: 'Serviço de IA' },
  { value: 'rate_limit', label: 'Limite de uso' },
  { value: 'validation_error', label: 'Validação' },
  { value: 'database_error', label: 'Banco de Dados' },
  { value: 'unknown', label: 'Desconhecido' },
];

const acaoOptions = [
  { value: 'todos', label: 'Todas' },
  { value: 'retry', label: 'Tentar de novo' },
  { value: 'mark_error', label: 'Marcado com erro' },
  { value: 'human_review', label: 'Revisão Humana' },
  { value: 'skip', label: 'Pular' },
  { value: 'fallback', label: 'Plano alternativo' },
  { value: 'ignore', label: 'Ignorar' },
];

export default function LogsPage() {
  const confirmar = useConfirm();
  const { showError, showSuccess, showToast } = useToast();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [nivel, setNivel] = useState<string>('todos');
  const [cenario, setCenario] = useState<string>('todos');
  const [acao, setAcao] = useState<string>('todos');
  const [dataIni, setDataIni] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [busca, setBusca] = useState<string>('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/logs/stats');
      if (!res.ok) throw new Error('Falha ao carregar estatísticas');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        nivel,
        cenario,
        acao,
      });

      if (dataIni) params.append('dataIni', dataIni);
      if (dataFim) params.append('dataFim', dataFim);
      if (busca.trim()) params.append('busca', busca.trim());

      const res = await fetch(`/api/v1/logs?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar logs');

      const data: LogsResponse = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      showError('Erro ao carregar', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, nivel, cenario, acao, dataIni, dataFim, busca, showError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = () => {
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setNivel('todos');
    setCenario('todos');
    setAcao('todos');
    setDataIni('');
    setDataFim('');
    setBusca('');
    setPage(1);
    setTimeout(fetchLogs, 0);
  };

  const handleClearLogs = async () => {
    if (!(await confirmar('Tem certeza que deseja limpar todos os logs? Esta ação não pode ser desfeita.'))) {
      return;
    }

    try {
      const res = await fetch('/api/v1/logs?olderThanDays=0', {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Falha ao limpar logs');

      const data = await res.json();
      if (data.success) {
        showSuccess('Logs limpos', `${data.deleted} logs removidos`);
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      showError('Erro ao limpar logs', (err as Error).message);
    }
  };

  const formatDateInput = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="dashboard-title">Logs de Erro</h2>
            <p className="dashboard-subtitle">
              Acompanhe erros e eventos do sistema
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchStats(); fetchLogs(); }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        {!loadingStats && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <AlertCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total de Logs</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Erros</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.erros}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Avisos</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.warnings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Info</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.infos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle>Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nível</label>
                <select
                  value={nivel}
                  onChange={(e) => { setNivel(e.target.value); setPage(1); }}
                  className="input"
                >
                  {nivelOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cenário</label>
                <select
                  value={cenario}
                  onChange={(e) => { setCenario(e.target.value); setPage(1); }}
                  className="input"
                >
                  {cenarioOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ação</label>
                <select
                  value={acao}
                  onChange={(e) => { setAcao(e.target.value); setPage(1); }}
                  className="input"
                >
                  {acaoOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Início</label>
                <Input
                  type="date"
                  value={dataIni}
                  onChange={(e) => setDataIni(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Fim</label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Buscar na mensagem..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={handleFilter} size="sm">
                  Filtrar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                  className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Logs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros ({total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data/Hora</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Nível</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Mensagem</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Cenário</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Ação</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Rep.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(log.criadoEm)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getBadgeVariant(log.nivel)}>
                            {nivelConfig[log.nivel as keyof typeof nivelConfig]?.label || log.nivel}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100 max-w-md truncate">
                          {log.mensagem}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {log.cenarioFalha || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {log.acaoTomada || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {log.repeticoes ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && logs.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  Página {page} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLog && <LogDetalheDrawer log={selectedLog} onFechar={() => setSelectedLog(null)} />}
    </MainLayout>
  );
}