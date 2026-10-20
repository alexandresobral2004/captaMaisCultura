import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';

describe('ProjetoCientificoRepository', () => {
  let repo: import('../../lib/database/repositories/projeto-cientifico.repository').ProjetoCientificoRepository;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
    const mod = await import('../../lib/database/repositories/projeto-cientifico.repository');
    repo = new mod.ProjetoCientificoRepository();
  });

  it('salva e recupera o projeto completo, inclusive campos aninhados', async () => {
    await repo.save({ id: 'p1', titulo: 'Projeto IoT', status: 'rascunho', objetivos: { geral: 'x', especificos: [{ cod: 'OE1' }] } });
    expect(await repo.get('p1')).toMatchObject({ id: 'p1', titulo: 'Projeto IoT', objetivos: { especificos: [{ cod: 'OE1' }] } });
  });

  it('save com o mesmo id atualiza em vez de duplicar', async () => {
    await repo.save({ id: 'p1', titulo: 'v1' });
    await repo.save({ id: 'p1', titulo: 'v2', versao: 2 });
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.get('p1')).toMatchObject({ titulo: 'v2', versao: 2 });
  });

  it('retorna undefined para id inexistente e remove corretamente', async () => {
    expect(await repo.get('nao-existe')).toBeUndefined();
    await repo.save({ id: 'p1', titulo: 'x' });
    expect(await repo.delete('p1')).toBe(true);
    expect(await repo.delete('p1')).toBe(false);
    expect(await repo.get('p1')).toBeUndefined();
  });
});
