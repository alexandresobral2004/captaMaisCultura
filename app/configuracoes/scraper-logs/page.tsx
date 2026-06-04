'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Trash2, Filter } from 'lucide-react';
import { PipelineLogEvent } from '@/lib/scraper/pipeline-logger';
import { useToast } from '@/contexts/toast-context';

type PhaseFilter = 'all' | 'busca' | 'whitelist' | 'blacklist' | 'ia' | 'error';

export default function ScraperLogsPage() {
  const [logs, setLogs] = useState<PipelineLogEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { showSuccess, showError } = useToast();

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/v1/scraper/logs/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (event.data === ': heartbeat') return;
      
      try {
        const logData: PipelineLogEvent = JSON.parse(event.data);
        setLogs(prev => {
          // If we are replacing the whole state due to receiving buffer on load, 
          // we might just want to append and ensure we don't have duplicates
          const exists = prev.some(l => l.id === logData.id);
          if (exists) return prev;
          
          return [...prev, logData];
        });
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      setIsConnected(false);
      eventSource.close();
      
      // Try to reconnect after 5s
      setTimeout(() => {
        connectSSE();
      }, 5000);
    };
  }, []);

  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connectSSE]);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    } else if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const startScan = async () => {
    try {
      setIsScanning(true);
      const res = await fetch('/api/v1/scraper/logs/trigger', { method: 'POST' });
      if (res.ok) {
        showSuccess('Scan iniciado', 'Acompanhe os logs no terminal');
      } else {
        throw new Error('Falha ao iniciar');
      }
    } catch (err) {
      showError('Erro', 'Falha ao disparar o scan');
    } finally {
      setIsScanning(false);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.level === 'error' || log.phase === 'pipeline';
    return log.phase === filter;
  });

  const getLogClasses = (log: PipelineLogEvent) => {
    let classes = 'scraper-terminal-line ';
    if (log.level === 'success') classes += 'scraper-log-success ';
    else if (log.level === 'error') classes += 'scraper-log-error ';
    else if (log.level === 'warning') classes += 'scraper-log-warning ';
    else if (log.level === 'step') classes += 'scraper-log-step ';
    return classes;
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="dashboard-title">Logs do Scraper</h2>
            <p className="dashboard-subtitle">Acompanhe a busca e filtragem em tempo real</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-sm mr-4 ${isConnected ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600 dark:bg-green-500 animate-pulse' : 'bg-red-600 dark:bg-red-500'}`}></div>
              {isConnected ? 'Conectado' : 'Reconectando...'}
            </div>
            
            <Button variant="outline" size="sm" onClick={() => setLogs([])}>
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Tela
            </Button>
            
            <Button size="sm" onClick={startScan} disabled={isScanning}>
              <Play className="w-4 h-4 mr-2" />
              {isScanning ? 'Iniciando...' : 'Iniciar Scan'}
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col bg-[#0f172a] border-slate-700">
          <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] border-b border-slate-700">
            <div className="flex items-center gap-1 text-slate-300">
              <Filter className="w-4 h-4 mr-2" />
              <FilterButton label="Todos" active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterButton label="Busca" active={filter === 'busca'} onClick={() => setFilter('busca')} />
              <FilterButton label="Whitelist" active={filter === 'whitelist'} onClick={() => setFilter('whitelist')} />
              <FilterButton label="Blacklist" active={filter === 'blacklist'} onClick={() => setFilter('blacklist')} />
              <FilterButton label="IA" active={filter === 'ia'} onClick={() => setFilter('ia')} />
              <FilterButton label="Erros" active={filter === 'error'} onClick={() => setFilter('error')} />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              {filteredLogs.length} eventos
            </div>
          </div>
          
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            <div 
              ref={terminalRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto p-4 font-mono text-sm"
              style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
            >
              {filteredLogs.map((log, i) => {
                const isNewEdital = i > 0 && log.editalId && log.editalId !== filteredLogs[i-1].editalId && filteredLogs[i-1].editalId;
                
                return (
                  <div key={log.id}>
                    {isNewEdital && (
                      <div className="scraper-log-separator my-2">─────────────────────────────────────────────────────────────────</div>
                    )}
                    <div className={getLogClasses(log)}>
                      <span className="scraper-log-timestamp mr-3">{formatTime(log.ts)}</span>
                      
                      {log.phase === 'busca' && <span className="scraper-log-phase mr-2">🌐 [BUSCA]</span>}
                      {log.phase === 'whitelist' && <span className="scraper-log-phase mr-2">WL</span>}
                      {log.phase === 'blacklist' && <span className="scraper-log-phase mr-2">BL</span>}
                      {log.phase === 'ia' && <span className="scraper-log-phase mr-2">🤖 [IA]</span>}
                      {log.phase === 'resultado' && <span className="scraper-log-phase mr-2">🏁 [RES]</span>}
                      
                      {log.editalTitulo && (
                        <span className="text-slate-300 mr-2">&quot;{log.editalTitulo.substring(0, 50)}{log.editalTitulo.length > 50 ? '...' : ''}&quot;</span>
                      )}
                      
                      <span className="font-semibold">{log.message}</span>
                      
                      {log.level === 'warning' && log.phase === 'whitelist' && (
                        <span className="ml-2" title="Termo genérico">⚠️</span>
                      )}
                      
                      {log.detail && (
                        <div className="ml-14 text-xs mt-1 text-slate-400">
                          ↳ {log.detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredLogs.length === 0 && (
                <div className="text-slate-500 italic">
                  Aguardando eventos... {isConnected ? '' : '(reconectando)'}
                </div>
              )}
            </div>
            
            {!autoScroll && (
              <div className="absolute bottom-4 right-4 z-10">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 opacity-80 hover:opacity-100 shadow-lg"
                  onClick={() => setAutoScroll(true)}
                >
                  ▼ Rolar para baixo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
