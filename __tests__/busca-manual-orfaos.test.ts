import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';
import { TipoJob } from '../lib/jobs/job-types';

vi.mock('@/lib/api/auth', () => ({
  verificarAdmin: async () => ({
    ok: true,
    usuario: { id: 'admin', nome: 'Admin', email: 'admin@x', role: 'admin', status: 'ativo' },
  }),
}));

vi.mock('@/lib/scraper/fetcher', () => ({
  buscarEditaisPortais: vi.fn(async () => []),
  filtrarComClassificador: vi.fn(async () => []),
}));

const MIN = 60 * 1000;

describe.skipIf(!IS_POSTGRES)('buscas e jobs presos: heartbeat e órfãos (relógio injetado)', () => {
  let db: any;
  let schema: typeof import('../lib/database/schema');
  let controle: typeof import('../lib/scraper/controle-busca');
  let JobRepository: typeof import('../lib/jobs/job-repository').JobRepository;
  let rota: typeof import('../app/api/editais/busca/route');
  const T0 = new Date('2026-10-31T12:00:00.000Z');

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    db = (await import('../lib/database/db')).db;
    schema = await import('../lib/database/schema');
    controle = await import('../lib/scraper/controle-busca');
    JobRepository = (await import('../lib/jobs/job-repository')).JobRepository;
    rota = await import('../app/api/editais/busca/route');
  });

  it('busca e job RODANDO sem batida há mais de 5 min viram erro ao consultar', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-morto', TipoJob.BUSCA_MANUAL);
    await repo.reivindicarProximoPendente();
    // Mesma referência de tempo do relógio injetado
    await db.update(schema.jobs).set({ iniciadoEm: T0.toISOString(), atualizadoEm: T0.toISOString() });
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: T0.toISOString(), atualizadaEm: T0.toISOString(), status: 'em_andamento', jobId: 'job-morto',
    });

    await controle.recuperarOrfaosAsync(db, new Date(T0.getTime() + 6 * MIN));

    expect((await repo.buscarPorId('job-morto'))?.status).toBe('ERRO');
    const [busca] = await db.select().from(schema.buscasEditais);
    expect(busca).toMatchObject({ status: 'erro', mensagem: 'Interrompida' });
  });

  it('heartbeat recente mantém a busca em andamento', async () => {
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: T0.toISOString(), atualizadaEm: new Date(T0.getTime() + 5 * MIN).toISOString(), status: 'em_andamento',
    });

    await controle.recuperarOrfaosAsync(db, new Date(T0.getTime() + 6 * MIN));

    const [busca] = await db.select().from(schema.buscasEditais);
    expect(busca.status).toBe('em_andamento');
  });

  it('job PENDENTE há mais de 3 min vira ERRO (Worker indisponível) e não gasta o limite', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-sem-worker', TipoJob.BUSCA_MANUAL);
    await db.update(schema.jobs).set({ iniciadoEm: T0.toISOString(), atualizadoEm: T0.toISOString() });
    await db.insert(schema.buscasEditais).values({
      iniciadaEm: T0.toISOString(), atualizadaEm: T0.toISOString(), status: 'pendente', jobId: 'job-sem-worker',
    });

    const agora = new Date(T0.getTime() + 4 * MIN);
    await controle.recuperarOrfaosAsync(db, agora);

    const job = await repo.buscarPorId('job-sem-worker');
    expect(job?.status).toBe('ERRO');
    expect(job?.erroDetalhes).toContain('Worker indisponível');
    const [busca] = await db.select().from(schema.buscasEditais);
    expect(busca).toMatchObject({ status: 'erro', mensagem: 'Worker indisponível' });

    const situacao = await controle.situacaoDaBuscaAsync(agora);
    expect(situacao.usadas).toBe(0);
  });

  it('com a busca presa já encerrada, um novo POST responde 202', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-travado', TipoJob.BUSCA_MANUAL);
    // Gravado há 10 min de verdade: o POST recupera órfãos antes de decidir
    const antigo = new Date(Date.now() - 10 * MIN).toISOString();
    await db.update(schema.jobs).set({ iniciadoEm: antigo, atualizadoEm: antigo, status: 'RODANDO' });

    const res = await rota.POST(new NextRequest('http://x/api/editais/busca', { method: 'POST' }));

    expect(res.status).toBe(202);
  });
});
