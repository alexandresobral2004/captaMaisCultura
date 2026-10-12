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

  it('salva e recupera o projeto completo, inclusive campos aninhados', () => {
    repo.save({ id: 'p1', titulo: 'Projeto IoT', status: 'rascunho', objetivos: { geral: 'x', especificos: [{ cod: 'OE1' }] } });
    expect(repo.get('p1')).toMatchObject({ id: 'p1', titulo: 'Projeto IoT', objetivos: { especificos: [{ cod: 'OE1' }] } });
  });

  it('save com o mesmo id atualiza em vez de duplicar', () => {
    repo.save({ id: 'p1', titulo: 'v1' });
    repo.save({ id: 'p1', titulo: 'v2', versao: 2 });
    expect(repo.list()).toHaveLength(1);
    expect(repo.get('p1')).toMatchObject({ titulo: 'v2', versao: 2 });
  });

  it('retorna undefined para id inexistente e remove corretamente', () => {
    expect(repo.get('nao-existe')).toBeUndefined();
    repo.save({ id: 'p1', titulo: 'x' });
    expect(repo.delete('p1')).toBe(true);
    expect(repo.delete('p1')).toBe(false);
    expect(repo.get('p1')).toBeUndefined();
  });
});
