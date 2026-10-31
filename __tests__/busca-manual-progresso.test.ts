import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';
import type { ProgressoBusca } from '../lib/scraper/progresso-busca';
import { JobStatus, TipoJob } from '../lib/jobs/job-types';

vi.mock('@/lib/api/auth', () => ({
  verificarAdmin: async () => ({
    ok: true,
    usuario: { id: 'admin', nome: 'Admin', email: 'admin@x', role: 'admin', status: 'ativo' },
  }),
}));

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

describe.skipIf(!IS_POSTGRES)('GET /api/editais/busca/progresso: lê do banco', () => {
  let rota: typeof import('../app/api/editais/busca/progresso/route');
  let JobRepository: typeof import('../lib/jobs/job-repository').JobRepository;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    rota = await import('../app/api/editais/busca/progresso/route');
    JobRepository = (await import('../lib/jobs/job-repository')).JobRepository;
  });

  const consultar = async (query = '') => {
    const res = await rota.GET(new NextRequest(`http://x/api/editais/busca/progresso${query}`));
    return { status: res.status, corpo: await res.json() };
  };

  it('com jobId, devolve o progresso gravado no banco para aquele job', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-b1', TipoJob.BUSCA_MANUAL);
    await repo.gravarProgresso('job-b1', PROGRESSO);

    const { status, corpo } = await consultar('?jobId=job-b1');

    expect(status).toBe(200);
    expect(corpo).toMatchObject({ etapa: 'processando', total: 10, verificados: 4, percentual: 40 });
  });

  it('com jobId inexistente, responde 404', async () => {
    const { status } = await consultar('?jobId=nao-existe');
    expect(status).toBe(404);
  });

  it('sem jobId, devolve o progresso do último job de busca manual (ignora varreduras)', async () => {
    const repo = new JobRepository();
    await repo.enfileirar('job-antigo', TipoJob.BUSCA_MANUAL);
    await repo.gravarProgresso('job-antigo', { ...PROGRESSO, total: 1 });
    await repo.finalizar('job-antigo', JobStatus.CONCLUIDO);
    await repo.enfileirar('varredura-nova');
    await repo.gravarProgresso('varredura-nova', { ...PROGRESSO, total: 99 });

    const { status, corpo } = await consultar();

    expect(status).toBe(200);
    expect(corpo.total).toBe(1);
  });
});
