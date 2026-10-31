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

const post = () => new NextRequest('http://x/api/editais/busca', { method: 'POST' });

describe.skipIf(!IS_POSTGRES)('POST /api/editais/busca: conflito e limite', () => {
  let rota: typeof import('../app/api/editais/busca/route');
  let db: any;
  let schema: typeof import('../lib/database/schema');
  let JobRepository: typeof import('../lib/jobs/job-repository').JobRepository;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    rota = await import('../app/api/editais/busca/route');
    schema = await import('../lib/database/schema');
    db = (await import('../lib/database/db')).db;
    JobRepository = (await import('../lib/jobs/job-repository')).JobRepository;
  });

  const contar = async () => ({
    jobs: (await db.select().from(schema.jobs)).length,
    buscas: (await db.select().from(schema.buscasEditais)).length,
  });

  it('com varredura semanal aguardando, responde 409 e não insere nada', async () => {
    await new JobRepository().enfileirar('varredura-fila');

    const res = await rota.POST(post());

    expect(res.status).toBe(409);
    expect(await contar()).toEqual({ jobs: 1, buscas: 0 });
  });

  it('com a varredura semanal rodando, responde 409 e não insere nada', async () => {
    await new JobRepository().criar('varredura-rodando');

    const res = await rota.POST(post());

    expect(res.status).toBe(409);
    expect(await contar()).toEqual({ jobs: 1, buscas: 0 });
  });

  it('com outra busca manual aguardando, responde 409 e não insere nada', async () => {
    await new JobRepository().enfileirar('busca-fila', TipoJob.BUSCA_MANUAL);

    const res = await rota.POST(post());

    expect(res.status).toBe(409);
    expect(await contar()).toEqual({ jobs: 1, buscas: 0 });
  });

  it('com o limite semanal de 2 buscas atingido, responde 429 e não insere nada', async () => {
    const agora = new Date().toISOString();
    await db.insert(schema.buscasEditais).values([
      { iniciadaEm: agora, status: 'concluida' },
      { iniciadaEm: agora, status: 'concluida' },
    ]);

    const res = await rota.POST(post());

    expect(res.status).toBe(429);
    expect(await contar()).toEqual({ jobs: 0, buscas: 2 });
  });

  it('dez POSTs concorrentes: exatamente um 202 e nove 409', async () => {
    const respostas = await Promise.all(Array.from({ length: 10 }, () => rota.POST(post())));
    const codigos = respostas.map((r) => r.status).sort();

    expect(codigos.filter((c) => c === 202)).toHaveLength(1);
    expect(codigos.filter((c) => c === 409)).toHaveLength(9);
    expect(await contar()).toEqual({ jobs: 1, buscas: 1 });
  });
});
