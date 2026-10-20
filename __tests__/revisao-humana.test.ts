import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from './setup';

describe('revisão humana: o status de revisão é gravado no banco', () => {
  let store: typeof import('../lib/db/editais-store');
  let rota: typeof import('../app/api/editais/revisar/route');

  const base = { orgao: 'CNPq', dataLimite: '2026-12-31', statusAnalise: 'analisado' as const };

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    store = await import('../lib/db/editais-store');
    rota = await import('../app/api/editais/revisar/route');
  });

  const listar = async (status: string) =>
    (await (await rota.GET(new Request(`http://x/api/editais/revisar?status=${status}`))).json()).editais.map((e: any) => e.id);
  const revisar = (id: string, acao: string) =>
    rota.POST(new Request('http://x/api/editais/revisar', { method: 'POST', body: JSON.stringify({ id, acao }) }));

  it('saveEdital grava e lê statusRevisao e validadoManualmente', async () => {
    await store.saveEdital({ id: 'r1', titulo: 'A', link: 'https://x/a', ...base, statusRevisao: 'pendente' } as any);
    const lido = await store.getEditalPorId('r1');
    expect(lido?.statusRevisao).toBe('pendente');
    expect(lido?.validadoManualmente).toBeUndefined();
  });

  it('pendente aparece na fila; aprovar e rejeitar movem o edital de lista', async () => {
    await store.saveEdital({ id: 'r1', titulo: 'A', link: 'https://x/a', ...base, statusRevisao: 'pendente' } as any);
    await store.saveEdital({ id: 'r2', titulo: 'B', link: 'https://x/b', ...base, statusRevisao: 'pendente' } as any);
    expect((await listar('pendente')).sort()).toEqual(['r1', 'r2']);

    expect((await revisar('r1', 'aprovar')).status).toBe(200);
    expect((await revisar('r2', 'rejeitar')).status).toBe(200);

    expect(await listar('pendente')).toEqual([]);
    expect(await listar('aprovado')).toEqual(['r1']);
    expect(await listar('rejeitado')).toEqual(['r2']);

    const aprovado = await store.getEditalPorId('r1');
    expect(aprovado?.validadoManualmente).toBe(true);
    expect(aprovado?.dataAprovacao).toBeInstanceOf(Date);
  });
});
