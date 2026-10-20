import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { makeEditalDTO, resetCounter } from '../helpers';
import { prazoVencido } from '../../lib/database/services/edital.service';

describe('exclusão de editais em lote', () => {
  let EditalService: typeof import('../../lib/database/services/edital.service').EditalService;
  let EditalRepository: typeof import('../../lib/database/repositories/edital.repository').EditalRepository;
  let store: typeof import('../../lib/db/editais-store');

  beforeEach(async () => {
    resetCounter();
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    EditalService = (await import('../../lib/database/services/edital.service')).EditalService;
    EditalRepository = (await import('../../lib/database/repositories/edital.repository')).EditalRepository;
    store = await import('../../lib/db/editais-store');
  });

  it('exclui todos de uma vez e informa as falhas sem parar', async () => {
    const repo = new EditalRepository();
    const a = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/a' }));
    const b = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/b' }));

    const r = await new EditalService().deletarVarios([a.id, b.id, a.id, 'nao-existe']);

    expect(r.excluidos.sort()).toEqual([a.id, b.id].sort());
    expect(r.falhas).toEqual([{ id: 'nao-existe', erro: expect.stringContaining('nao encontrado') }]);
    expect(await store.getEditalPorId(a.id)).toBeNull();
  });

  it('excluído com prazo vencido não volta: as buscas o reconhecem por id e por link, e salvar de novo é ignorado', async () => {
    const repo = new EditalRepository();
    const a = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/edital-a', dataLimite: '2020-01-31' }));
    await new EditalService().deletarVarios([a.id]);

    expect(await store.isEditalExcluido(a.id)).toBe(true);
    expect(await store.isEditalExcluido('outro-id-gerado-pelo-coletor', 'https://x.gov.br/edital-a')).toBe(true);

    await store.saveEdital({ id: a.id, titulo: 'Coletado de novo', orgao: 'CNPq', link: 'https://x.gov.br/edital-a', dataLimite: '2020-01-31' } as any);
    expect(await store.getEditalPorId(a.id)).toBeNull();
  });

  it('excluído ainda no prazo volta se a busca o encontrar de novo', async () => {
    const repo = new EditalRepository();
    const a = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/edital-b', dataLimite: '2099-12-31' }));
    await new EditalService().deletarVarios([a.id]);

    expect(await store.getEditalPorId(a.id)).toBeNull();
    expect(await store.isEditalExcluido(a.id, 'https://x.gov.br/edital-b')).toBe(false);

    const salvo = await store.saveEdital({ id: 'id-novo', titulo: 'Coletado de novo', orgao: 'CNPq', link: 'https://x.gov.br/edital-b', dataLimite: '2099-12-31' } as any);
    expect(salvo.deletedAt).toBeFalsy();
    expect((await store.getEditalPorId('id-novo'))?.titulo).toBe('Coletado de novo');
  });

  it('excluído com prazo vencido fica bloqueado', async () => {
    const repo = new EditalRepository();
    const a = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/edital-c', dataLimite: '2020-01-31' }));
    await new EditalService().deletarVarios([a.id]);

    expect(await store.isEditalExcluido(a.id)).toBe(true);
  });

  it('excluído com prazo a confirmar ou sem data não é bloqueado', async () => {
    const repo = new EditalRepository();
    const a = await repo.create(makeEditalDTO({ link: 'https://x.gov.br/edital-d', dataLimite: 'a confirmar' }));
    await new EditalService().deletarVarios([a.id]);

    expect(await store.isEditalExcluido(a.id)).toBe(false);
  });

  it('prazoVencido: ISO e BR; prazo ausente ou a confirmar não vence', () => {
    const hoje = new Date(2026, 9, 19);
    expect(prazoVencido('2026-10-18', hoje)).toBe(true);
    expect(prazoVencido('2026-10-19', hoje)).toBe(false);
    expect(prazoVencido('18/10/2026', hoje)).toBe(true);
    expect(prazoVencido('a confirmar', hoje)).toBe(false);
    expect(prazoVencido(null, hoje)).toBe(false);
  });
});
