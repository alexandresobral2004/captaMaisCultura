import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from '../setup';
import { TipoJob } from '../../lib/jobs/job-types';

vi.mock('@/lib/scraper/fetcher', () => ({
  buscarEditaisPortais: vi.fn(async () => [{ id: 'edital-1', titulo: 'Edital 1', link: 'https://x/1' }]),
  filtrarComClassificador: vi.fn(async () => []),
}));

vi.mock('@/lib/db/editais-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/db/editais-store')>()),
  // Edital excluído pelo usuário: a busca conta como "já existente" e não baixa de novo
  isEditalExcluido: vi.fn(async () => true),
}));

describe.skipIf(!IS_POSTGRES)('worker executa a busca manual', () => {
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

  it('job de busca manual vira CONCLUIDO e a busca vira concluida, com as contagens', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-busca', TipoJob.BUSCA_MANUAL);
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: new Date().toISOString(),
      status: 'pendente',
      jobId: 'job-busca',
    });

    // O worker reivindica o job e depois o executa pelo id
    await repo.reivindicarProximoPendente();
    const resultado = await new JobRunner().executar('job-busca');

    expect(resultado.status).toBe('CONCLUIDO');
    const [job] = await db.select().from(schema.jobs);
    expect(job.status).toBe('CONCLUIDO');

    const [busca] = await db.select().from(schema.buscasEditais);
    expect(busca).toMatchObject({ status: 'concluida', novos: 0, jaExistentes: 1, descartados: 0, comErro: 0 });
  });
});
