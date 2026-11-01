import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';
import { TipoJob } from '../lib/jobs/job-types';

// Sem editais nos portais: a busca não depende de rede nem de IA
vi.mock('../lib/scraper/fetcher', () => ({
  buscarEditaisPortais: async () => [],
}));

// Só Postgres: JobRepository não roda no mock SQLite (mesmo critério dos demais testes de progresso)
describe.skipIf(!IS_POSTGRES)('busca manual com falha na gravação de logs', () => {
  let mock: ReturnType<typeof setupTestDbMock>;

  beforeEach(() => {
    mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
  });

  it('a busca termina como concluída mesmo se todo insert em logs_sistema falhar', async () => {
    const { JobRepository } = await import('../lib/jobs/job-repository');
    const { executarBuscaManual } = await import('../lib/scraper/busca-manual');
    const { logsSistema } = await import('../lib/database/schema');

    await new JobRepository().enfileirar('job-falha-log', TipoJob.BUSCA_MANUAL);

    const original = mock.db.insert.bind(mock.db);
    vi.spyOn(mock.db, 'insert').mockImplementation((tabela: unknown) => {
      if (tabela === logsSistema) throw Object.assign(new Error('falha de gravação'), { code: '53300' });
      return original(tabela);
    });
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(executarBuscaManual('job-falha-log', 1)).resolves.toBeDefined();

    const job = await new JobRepository().buscarPorId('job-falha-log');
    expect(job?.progresso).toMatchObject({ etapa: 'concluida', percentual: 100 });
    expect(erroConsole).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ codigo: '53300' }));
    vi.restoreAllMocks();
  });
});
