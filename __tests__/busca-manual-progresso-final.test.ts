import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';
import type { ProgressoBusca } from '../lib/scraper/progresso-busca';
import { eq } from 'drizzle-orm';
import { JobStatus, TipoJob } from '../lib/jobs/job-types';

vi.mock('@/lib/api/auth', () => ({
  verificarAdmin: async () => ({
    ok: true,
    usuario: { id: 'admin', nome: 'Admin', email: 'admin@x', role: 'admin', status: 'ativo' },
  }),
}));

const MIN = 60 * 1000;

const PROGRESSO: ProgressoBusca = {
  etapa: 'processando',
  total: 10,
  verificados: 4,
  saoEditais: 2,
  uteis: 1,
  paraRevisar: 1,
  descartados: 1,
  jaExistentes: 0,
  atual: 'Edital X',
  percentual: 40,
  atualizadoEm: '2026-10-31T12:00:00.000Z',
};

describe.skipIf(!IS_POSTGRES)('GET /api/editais/busca/progresso: andamento final do job', () => {
  let db: any;
  let schema: typeof import('../lib/database/schema');
  let rota: typeof import('../app/api/editais/busca/progresso/route');
  let JobRepository: typeof import('../lib/jobs/job-repository').JobRepository;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    db = (await import('../lib/database/db')).db;
    schema = await import('../lib/database/schema');
    rota = await import('../app/api/editais/busca/progresso/route');
    JobRepository = (await import('../lib/jobs/job-repository')).JobRepository;
  });

  const consultar = async (query = '') => {
    const res = await rota.GET(new NextRequest(`http://x/api/editais/busca/progresso${query}`));
    return { status: res.status, corpo: await res.json() };
  };

  // Datas antigas em relação ao relógio real, que é o que a rota usa ao recuperar órfãos
  const envelhecer = async (jobId: string, minutos: number) => {
    const antigo = new Date(Date.now() - minutos * MIN).toISOString();
    await db.update(schema.jobs).set({ iniciadoEm: antigo, atualizadoEm: antigo }).where(eq(schema.jobs.id, jobId));
  };

  it('job PENDENTE vencido (sem worker, sem snapshot) responde etapa erro, não ociosa', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-sem-worker', TipoJob.BUSCA_MANUAL);
    await envelhecer('job-sem-worker', 10);

    const { status, corpo } = await consultar('?jobId=job-sem-worker');

    expect(status).toBe(200);
    expect(corpo.etapa).toBe('erro');
    expect(corpo.atual).toBe('Worker indisponível');
  });

  it('job RODANDO órfão (worker morto, último snapshot coletando) responde etapa erro', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-morto', TipoJob.BUSCA_MANUAL);
    await repo.reivindicarProximoPendente();
    await repo.gravarProgresso('job-morto', { ...PROGRESSO, etapa: 'coletando' });
    await envelhecer('job-morto', 6);

    const { status, corpo } = await consultar('?jobId=job-morto');

    expect(status).toBe(200);
    expect(corpo.etapa).toBe('erro');
    expect(corpo.atual).toContain('Job interrompido');
    expect(corpo.total).toBe(10);
  });

  it('job CONCLUIDO com snapshot não-final responde etapa concluida', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-ok', TipoJob.BUSCA_MANUAL);
    await repo.gravarProgresso('job-ok', { ...PROGRESSO, etapa: 'processando' });
    await repo.finalizar('job-ok', JobStatus.CONCLUIDO);

    const { status, corpo } = await consultar('?jobId=job-ok');

    expect(status).toBe(200);
    expect(corpo.etapa).toBe('concluida');
  });
});
