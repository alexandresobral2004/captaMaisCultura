import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, rawQuery } from './setup';

// Eventos do pipeline vão para logs_sistema (contexto 'pipeline'), em lotes com no máximo uma gravação por segundo.
async function linhasDoPipeline(rawDb: unknown) {
  return rawQuery(rawDb, 'SELECT mensagem, detalhes FROM logs_sistema WHERE contexto = ? ORDER BY id', ['pipeline']);
}

function detalhesDe(linha: { detalhes: unknown }): { jobId: string; message: string } {
  return JSON.parse(String(linha.detalhes));
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('pipeline logger grava em logs_sistema', () => {
  let mock: ReturnType<typeof setupTestDbMock>;

  beforeEach(() => {
    mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('eventos aparecem em ordem, com contexto pipeline e o jobId em detalhes', async () => {
    const { pipelineLogger } = await import('../lib/scraper/pipeline-logger');
    pipelineLogger.iniciarJob('job-log-1');

    pipelineLogger.logBusca('primeiro');
    pipelineLogger.logBusca('segundo');
    pipelineLogger.logErro('edital-1', 'falhou');
    await pipelineLogger.descarregar();

    const linhas = await linhasDoPipeline(mock.rawDb);
    expect(linhas.map((l) => detalhesDe(l).message)).toEqual(['primeiro', 'segundo', '❌ ERRO: falhou']);
    expect(linhas.every((l) => detalhesDe(l).jobId === 'job-log-1')).toBe(true);
  });

  it('agrupa os eventos do intervalo: nada antes de 1 s, tudo junto depois', async () => {
    const { pipelineLogger } = await import('../lib/scraper/pipeline-logger');
    pipelineLogger.iniciarJob('job-log-2');

    for (let i = 0; i < 10; i++) pipelineLogger.logBusca(`item ${i}`);

    await esperar(500);
    expect(await linhasDoPipeline(mock.rawDb)).toHaveLength(0);

    await vi.waitFor(async () => {
      expect(await linhasDoPipeline(mock.rawDb)).toHaveLength(10);
    }, { timeout: 3000, interval: 50 });
  });

  it('falha ao gravar não lança para quem emite e registra só nome e código do erro', async () => {
    const { pipelineLogger } = await import('../lib/scraper/pipeline-logger');
    const { logsSistema } = await import('../lib/database/schema');
    const original = mock.db.insert.bind(mock.db);
    vi.spyOn(mock.db, 'insert').mockImplementation((tabela: unknown) => {
      if (tabela === logsSistema) throw Object.assign(new Error('segredo da mensagem'), { code: 'XX000' });
      return original(tabela);
    });
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => pipelineLogger.logBusca('vai falhar')).not.toThrow();
    await expect(pipelineLogger.descarregar()).resolves.toBeUndefined();

    expect(erroConsole).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ nome: 'Error', codigo: 'XX000' }));
    const registrado = JSON.stringify(erroConsole.mock.calls);
    expect(registrado).not.toContain('segredo da mensagem');
  });

  it('gravações concorrentes saem na ordem de emissão, com ids crescentes', async () => {
    const { pipelineLogger } = await import('../lib/scraper/pipeline-logger');
    const { logsSistema } = await import('../lib/database/schema');
    const original = mock.db.insert.bind(mock.db);
    let chamadas = 0;
    vi.spyOn(mock.db, 'insert').mockImplementation((tabela: unknown) => {
      const builder = original(tabela);
      if (tabela !== logsSistema) return builder;
      // O primeiro lote demora 1,5 s para gravar; os seguintes gravam na hora
      const atraso = chamadas++ === 0 ? 1500 : 0;
      return { values: (linhas: unknown) => esperar(atraso).then(() => builder.values(linhas)) };
    });

    pipelineLogger.iniciarJob('job-ordem');
    pipelineLogger.logBusca('a');
    pipelineLogger.logBusca('b');
    await esperar(1100); // o timer dispara e o primeiro lote começa a gravar (lento)
    pipelineLogger.logBusca('c');
    pipelineLogger.logBusca('d');
    await pipelineLogger.descarregar(); // a 2ª gravação começa enquanto a 1ª ainda está em curso

    const linhas = await rawQuery(mock.rawDb, 'SELECT id, detalhes FROM logs_sistema WHERE contexto = ? ORDER BY id', ['pipeline']);
    expect(linhas.map((l) => detalhesDe(l).message)).toEqual(['a', 'b', 'c', 'd']);
    const ids = linhas.map((l) => Number(l.id));
    expect(ids.every((id, i) => i === 0 || id > ids[i - 1])).toBe(true);
  }, 15000);

  it('falha de gravação não vira nova linha de pipeline sobre a própria falha', async () => {
    const { pipelineLogger } = await import('../lib/scraper/pipeline-logger');
    const { logsSistema } = await import('../lib/database/schema');
    const original = mock.db.insert.bind(mock.db);
    let falhou = false;
    vi.spyOn(mock.db, 'insert').mockImplementation((tabela: unknown) => {
      if (tabela === logsSistema && !falhou) {
        falhou = true;
        throw Object.assign(new Error('falha'), { code: 'XX000' });
      }
      return original(tabela);
    });
    // Mesmo redirecionamento do job-runner durante a execução: console.error vira evento do pipeline
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      pipelineLogger.logErro('varredura', String(args[0]));
    });

    pipelineLogger.iniciarJob('job-falha');
    pipelineLogger.logBusca('vai falhar');
    await pipelineLogger.descarregar();
    await esperar(1200); // deixa o timer agir, caso a falha tenha enfileirado algo
    await pipelineLogger.descarregar();

    expect(await linhasDoPipeline(mock.rawDb)).toHaveLength(0);
  }, 15000);
});
