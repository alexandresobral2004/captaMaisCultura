import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from './setup';
import type { Edital } from "../lib/db/editais-store";

vi.mock('../lib/ai/analyzer', () => ({
  analisarEditalComIA: vi.fn(async () => {
    throw new Error('IA indisponível');
  }),
}));

const base = {
  titulo: 'Edital de teste',
  link: 'https://x/edital',
  orgao: 'CNPq',
  dataLimite: '2026-12-31',
};

describe('P17: retentativa de análise com erro', () => {
  let pipeline: typeof import('../lib/scraper/pipeline');
  let store: typeof import('../lib/db/editais-store');

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    pipeline = await import('../lib/scraper/pipeline');
    store = await import('../lib/db/editais-store');
  });

  it('entra na fila: pendente, ou erro com menos de 3 tentativas', () => {
    expect(pipeline.precisaAnalisar({ statusAnalise: 'pendente' })).toBe(true);
    expect(pipeline.precisaAnalisar({ statusAnalise: 'erro', tentativasAnalise: 0 })).toBe(true);
    expect(pipeline.precisaAnalisar({ statusAnalise: 'erro', tentativasAnalise: 2 })).toBe(true);
  });

  it('fica fora da fila: erro com 3 tentativas, ou status já analisado', () => {
    expect(pipeline.precisaAnalisar({ statusAnalise: 'erro', tentativasAnalise: 3 })).toBe(false);
    expect(pipeline.precisaAnalisar({ statusAnalise: 'analisado', tentativasAnalise: 0 })).toBe(false);
  });

  it('o contador de tentativas é gravado e não é zerado por outra gravação do edital', async () => {
    await store.saveEdital({ id: 'p17-a', ...base, statusAnalise: 'erro', tentativasAnalise: 2 });
    // Gravação sem o campo (ex.: edital salvo de novo pela busca) não pode apagar o contador
    await store.saveEdital({ id: 'p17-a', ...base, statusAnalise: 'erro' });

    expect((await store.getEditalPorId('p17-a'))?.tentativasAnalise).toBe(2);
  });

  it('falha de análise incrementa o contador', async () => {
    const edital: Edital = {
      ...base,
      id: 'p17-b',
      valor: '',
      status: 'Aberto',
      descricao: 'Edital de teste',
      criadoEm: '2026-10-31T12:00:00.000Z',
      fonteConteudo: 'pdf_upload',
      conteudoCompleto: 'texto do edital',
      statusAnalise: 'erro',
      tentativasAnalise: 1,
    };
    await store.saveEdital(edital);

    const ok = await pipeline.processarEditalUnico(edital);

    expect(ok).toBe(false);
    const salvo = await store.getEditalPorId('p17-b');
    expect(salvo).toMatchObject({ statusAnalise: 'erro', tentativasAnalise: 2 });
  });
});
