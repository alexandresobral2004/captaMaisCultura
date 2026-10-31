import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from '../setup';
import { TipoJob } from '../../lib/jobs/job-types';

vi.mock('@/lib/api/auth', () => ({
  verificarAdmin: async () => ({
    ok: true,
    usuario: { id: 'admin', nome: 'Admin', email: 'admin@x', role: 'admin', status: 'ativo' },
  }),
}));

vi.mock('@/lib/scraper/fetcher', () => ({
  buscarEditaisPortais: vi.fn(async () => [{ id: 'edital-1', titulo: 'Edital 1', link: 'https://x/1' }]),
  filtrarComClassificador: vi.fn(async () => []),
}));

vi.mock('@/lib/db/editais-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/db/editais-store')>()),
  isEditalExcluido: vi.fn(async () => true),
}));

describe.skipIf(!IS_POSTGRES)('worker grava o progresso no banco por jobId', () => {
  let db: any;
  let schema: typeof import('../../lib/database/schema');
  let JobRepository: typeof import('../../lib/jobs/job-repository').JobRepository;
  let JobRunner: typeof import('../../lib/jobs/job-runner').JobRunner;
  let rotaProgresso: typeof import('../../app/api/editais/busca/progresso/route');

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    db = (await import('../../lib/database/db')).db;
    schema = await import('../../lib/database/schema');
    JobRepository = (await import('../../lib/jobs/job-repository')).JobRepository;
    JobRunner = (await import('../../lib/jobs/job-runner')).JobRunner;
    rotaProgresso = await import('../../app/api/editais/busca/progresso/route');
  });

  it('ao terminar, o snapshot gravado no job é lido pelo GET ?jobId=', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-escrita', TipoJob.BUSCA_MANUAL);
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: new Date().toISOString(),
      status: 'pendente',
      jobId: 'job-escrita',
    });

    await repo.reivindicarProximoPendente();
    await new JobRunner().executar('job-escrita');

    const res = await rotaProgresso.GET(new NextRequest('http://x/api/editais/busca/progresso?jobId=job-escrita'));
    const corpo = await res.json();

    expect(corpo).toMatchObject({ etapa: 'concluida', percentual: 100, total: 1, verificados: 1, jaExistentes: 1 });
  });
});
