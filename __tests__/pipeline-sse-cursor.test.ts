import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables } from './setup';

// Lê o stream SSE em segundo plano e junta as mensagens (campo message) na ordem em que chegam
function abrirLeitura(res: Response) {
  const corpo = res.body;
  if (!corpo) throw new Error('resposta sem corpo');
  const leitor = corpo.getReader();
  const decoder = new TextDecoder();
  const mensagens: string[] = [];
  let pendente = '';

  void (async () => {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) return;
      pendente += decoder.decode(value, { stream: true });
      let fim = pendente.indexOf('\n\n');
      while (fim >= 0) {
        const bloco = pendente.slice(0, fim);
        pendente = pendente.slice(fim + 2);
        if (bloco.startsWith('data: ')) {
          const evento: { message: string } = JSON.parse(bloco.slice('data: '.length));
          mensagens.push(evento.message);
        }
        fim = pendente.indexOf('\n\n');
      }
    }
  })().catch(() => {});

  return { mensagens, fechar: () => leitor.cancel() };
}

describe('SSE de logs do pipeline lê por cursor no banco', () => {
  beforeEach(() => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
  });

  it('outra réplica recebe os eventos de um emissor anterior, em ordem, sem repetir', async () => {
    // Emissor anterior (quem roda a varredura, no worker)
    const emissor = await import('../lib/scraper/pipeline-logger');
    emissor.pipelineLogger.iniciarJob('job-sse');
    emissor.pipelineLogger.logBusca('a');
    emissor.pipelineLogger.logBusca('b');
    emissor.pipelineLogger.logBusca('c');
    await emissor.pipelineLogger.descarregar();

    // Réplica web: módulos recarregados, nada em memória do emissor
    vi.resetModules();
    const rota = await import('../app/api/v1/scraper/logs/stream/route');
    const conexao = abrirLeitura(await rota.GET(new NextRequest('http://x/api/v1/scraper/logs/stream')));

    try {
      await vi.waitFor(() => {
        expect(conexao.mensagens).toEqual(['a', 'b', 'c']);
      }, { timeout: 10000, interval: 100 });

      // Mais eventos do emissor: o segundo ciclo traz só os novos
      emissor.pipelineLogger.logBusca('d');
      emissor.pipelineLogger.logBusca('e');
      await emissor.pipelineLogger.descarregar();

      await vi.waitFor(() => {
        expect(conexao.mensagens).toEqual(['a', 'b', 'c', 'd', 'e']);
      }, { timeout: 10000, interval: 100 });
    } finally {
      await conexao.fechar();
    }
  }, 20000);

  it('history=false não envia o que já existia e envia o que chega depois', async () => {
    const emissor = await import('../lib/scraper/pipeline-logger');
    emissor.pipelineLogger.iniciarJob('job-sse-sem-historico');
    emissor.pipelineLogger.logBusca('antigo 1');
    emissor.pipelineLogger.logBusca('antigo 2');
    await emissor.pipelineLogger.descarregar();

    vi.resetModules();
    const rota = await import('../app/api/v1/scraper/logs/stream/route');
    const conexao = abrirLeitura(await rota.GET(new NextRequest('http://x/api/v1/scraper/logs/stream?history=false')));
    try {
      emissor.pipelineLogger.logBusca('novo');
      await emissor.pipelineLogger.descarregar();

      await vi.waitFor(() => {
        expect(conexao.mensagens).toEqual(['novo']);
      }, { timeout: 10000, interval: 100 });
    } finally {
      await conexao.fechar();
    }
  }, 20000);
});
