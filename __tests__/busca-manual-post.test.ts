import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';

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

describe.skipIf(!IS_POSTGRES)('POST /api/editais/busca: só enfileira', () => {
  let rota: typeof import('../app/api/editais/busca/route');
  let fetcher: typeof import('../lib/scraper/fetcher');
  let db: any;
  let schema: typeof import('../lib/database/schema');

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.clearAllMocks();
    vi.resetModules();
    rota = await import('../app/api/editais/busca/route');
    fetcher = await import('../lib/scraper/fetcher');
    schema = await import('../lib/database/schema');
    db = (await import('../lib/database/db')).db;
  });

  it('responde 202 com jobId, grava job e busca na fila e não executa a busca', async () => {
    const res = await rota.POST(new NextRequest('http://x/api/editais/busca', { method: 'POST' }));

    expect(res.status).toBe(202);
    const corpo = await res.json();
    expect(typeof corpo.jobId).toBe('string');

    const jobs = await db.select().from(schema.jobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: corpo.jobId, status: 'PENDENTE', tipo: 'busca_manual' });

    const buscas = await db.select().from(schema.buscasEditais);
    expect(buscas).toHaveLength(1);
    expect(buscas[0]).toMatchObject({ status: 'pendente', jobId: corpo.jobId });

    expect(fetcher.buscarEditaisPortais).not.toHaveBeenCalled();
  });
});
