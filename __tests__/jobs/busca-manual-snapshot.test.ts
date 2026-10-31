import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from '../setup';
import { TipoJob } from '../../lib/jobs/job-types';

vi.mock('@/lib/scraper/fetcher', () => ({
  buscarEditaisPortais: vi.fn(async () => [{ id: 'edital-1', titulo: 'Edital 1', link: 'https://x/1' }]),
  filtrarComClassificador: vi.fn(async () => []),
}));

vi.mock('@/lib/db/editais-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/db/editais-store')>()),
  isEditalExcluido: vi.fn(async () => true),
}));

describe.skipIf(!IS_POSTGRES)('snapshot de andamento não derruba a busca', () => {
  let db: any;
  let schema: typeof import('../../lib/database/schema');
  let JobRepository: typeof import('../../lib/jobs/job-repository').JobRepository;
  let JobRunner: typeof import('../../lib/jobs/job-runner').JobRunner;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    db = (await import('../../lib/database/db')).db;
    schema = await import('../../lib/database/schema');
    JobRepository = (await import('../../lib/jobs/job-repository')).JobRepository;
    JobRunner = (await import('../../lib/jobs/job-runner')).JobRunner;
  });

  it('falha ao gravar o progresso não faz a busca nem o job virarem erro', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(JobRepository.prototype, 'gravarProgresso').mockRejectedValue(new Error('falha ao gravar progresso'));
    const repo = new JobRepository();
    await repo.enfileirar('job-snapshot', TipoJob.BUSCA_MANUAL);
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: new Date().toISOString(),
      status: 'pendente',
      jobId: 'job-snapshot',
    });
    await repo.reivindicarProximoPendente();

    const resultado = await new JobRunner().executar('job-snapshot');

    expect(resultado.status).toBe('CONCLUIDO');
    const [job] = await db.select().from(schema.jobs);
    expect(job.status).toBe('CONCLUIDO');
    const [busca] = await db.select().from(schema.buscasEditais);
    expect(busca.status).toBe('concluida');
  });
});
