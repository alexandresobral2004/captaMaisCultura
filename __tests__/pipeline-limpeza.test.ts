import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, rawQuery } from './setup';

const DIA_MS = 24 * 60 * 60 * 1000;

describe('limpeza de logs do pipeline com mais de 7 dias', () => {
  let mock: ReturnType<typeof setupTestDbMock>;

  beforeEach(() => {
    mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
  });

  it('apaga o pipeline antigo e preserva o recente e o de outro contexto', async () => {
    const { logsSistema } = await import('../lib/database/schema');
    const { apagarLogsPipelineAntigos } = await import('../lib/scraper/pipeline-eventos');
    const agora = Date.now();
    const iso = (ms: number) => new Date(agora - ms).toISOString();

    await mock.db.insert(logsSistema).values([
      { nivel: 'info', mensagem: 'pipeline antigo', contexto: 'pipeline', criadoEm: iso(10 * DIA_MS) },
      { nivel: 'info', mensagem: 'pipeline recente', contexto: 'pipeline', criadoEm: iso(1 * DIA_MS) },
      { nivel: 'info', mensagem: 'outro contexto antigo', contexto: 'varredura', criadoEm: iso(10 * DIA_MS) },
    ]);

    await apagarLogsPipelineAntigos(new Date(agora));

    const restantes = await rawQuery(mock.rawDb, 'SELECT mensagem FROM logs_sistema ORDER BY id');
    expect(restantes.map((l) => l.mensagem)).toEqual(['pipeline recente', 'outro contexto antigo']);
  });
});
