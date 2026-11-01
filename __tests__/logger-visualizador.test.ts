import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from './setup';

// Logs do pipeline ficam em logs_sistema (contexto 'pipeline') e no SSE, mas o visualizador admin não os lista nem conta.
describe('visualizador admin de logs ignora o contexto pipeline', () => {
  let mock: ReturnType<typeof setupTestDbMock>;

  beforeEach(async () => {
    mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();

    const { logsSistema } = await import('../lib/database/schema');
    await mock.db.insert(logsSistema).values([
      { nivel: 'info', mensagem: 'linha do pipeline', contexto: 'pipeline', criadoEm: '2026-10-30T10:00:00' },
      { nivel: 'error', mensagem: 'erro do pipeline', contexto: 'pipeline', criadoEm: '2026-10-30T10:01:00' },
      { nivel: 'info', mensagem: 'linha de outro contexto', contexto: 'api', criadoEm: '2026-10-30T10:02:00' },
    ]);
  });

  it('getLogs não lista linhas de pipeline', async () => {
    const { logger } = await import('../lib/logger');

    const logs = await logger.getLogs();

    expect(logs.map((l) => l.mensagem)).toEqual(['linha de outro contexto']);
  });

  it('getTotalCount não conta linhas de pipeline', async () => {
    const { logger } = await import('../lib/logger');

    expect(await logger.getTotalCount()).toBe(1);
  });

  it('getStats não conta linhas de pipeline, nem em total, erros ou infos', async () => {
    const { logger } = await import('../lib/logger');

    const stats = await logger.getStats();

    expect(stats.total).toBe(1);
    expect(stats.erros).toBe(0);
    expect(stats.infos).toBe(1);
    expect(stats.ultimoErro).toBeNull();
  });
});
