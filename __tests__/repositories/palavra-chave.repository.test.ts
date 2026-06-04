import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { makeEditalDTO, resetCounter } from '../helpers';
import type Database from 'better-sqlite3';

describe('PalavraChaveRepository', () => {
  let rawDb: Database.Database;
  let EditalRepository: typeof import('../../lib/database/repositories/edital.repository').EditalRepository;
  let PalavraChaveRepository: typeof import('../../lib/database/repositories/palavra-chave.repository').PalavraChaveRepository;

  beforeEach(async () => {
    resetCounter();
    const mock = setupTestDbMock();
    rawDb = mock.rawDb;
    clearAllTables(rawDb);

    vi.resetModules();
    const editalMod = await import('../../lib/database/repositories/edital.repository');
    const pkMod = await import('../../lib/database/repositories/palavra-chave.repository');
    EditalRepository = editalMod.EditalRepository;
    PalavraChaveRepository = pkMod.PalavraChaveRepository;
  });

  async function createEdital() {
    const repo = new EditalRepository();
    return repo.create(makeEditalDTO());
  }

  describe('createOrUpdate', () => {
    it('deve inserir novas palavras-chave', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['React', 'TypeScript', 'Node.js']);

      const result = await repo.findByEditalId(edital.id);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.palavra).sort()).toEqual(['Node.js', 'React', 'TypeScript']);
    });

    it('deve substituir palavras existentes (delete + insert)', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['Angular', 'Vue']);
      await repo.createOrUpdate(edital.id, ['React', 'Svelte']);

      const result = await repo.findByEditalId(edital.id);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.palavra).sort()).toEqual(['React', 'Svelte']);
    });

    it('deve deletar todas as palavras ao passar array vazio', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['React', 'Vue']);
      await repo.createOrUpdate(edital.id, []);

      const result = await repo.findByEditalId(edital.id);

      expect(result).toHaveLength(0);
    });

    it('deve setar frequencia como 1 para cada palavra', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['React', 'Vue']);

      const result = await repo.findByEditalId(edital.id);

      expect(result.every((p) => p.frequencia === 1)).toBe(true);
    });

    it('deve associar palavras ao edital correto', async () => {
      const edital1 = await createEdital();
      const edital2 = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital1.id, ['React']);
      await repo.createOrUpdate(edital2.id, ['Vue', 'Angular']);

      const result1 = await repo.findByEditalId(edital1.id);
      const result2 = await repo.findByEditalId(edital2.id);

      expect(result1).toHaveLength(1);
      expect(result1[0].palavra).toBe('React');
      expect(result2).toHaveLength(2);
    });
  });

  describe('findByEditalId', () => {
    it('deve retornar array vazio para edital sem palavras', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      const result = await repo.findByEditalId(edital.id);

      expect(result).toEqual([]);
    });

    it('deve retornar todas as palavras do edital', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['React', 'TypeScript']);

      const result = await repo.findByEditalId(edital.id);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('editalId', edital.id);
      expect(result[0]).toHaveProperty('palavra');
      expect(result[0]).toHaveProperty('frequencia');
    });

    it('deve retornar array vazio para edital inexistente', async () => {
      const repo = new PalavraChaveRepository();

      const result = await repo.findByEditalId('id-inexistente');

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('deve remover todas as palavras do edital', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital.id, ['React', 'Vue', 'Angular']);
      await repo.delete(edital.id);

      const result = await repo.findByEditalId(edital.id);

      expect(result).toHaveLength(0);
    });

    it('nao deve gerar erro para edital sem palavras', async () => {
      const edital = await createEdital();
      const repo = new PalavraChaveRepository();

      await expect(repo.delete(edital.id)).resolves.not.toThrow();
    });

    it('deve remover apenas as palavras do edital especifico', async () => {
      const edital1 = await createEdital();
      const edital2 = await createEdital();
      const repo = new PalavraChaveRepository();

      await repo.createOrUpdate(edital1.id, ['React']);
      await repo.createOrUpdate(edital2.id, ['Vue']);

      await repo.delete(edital1.id);

      const result1 = await repo.findByEditalId(edital1.id);
      const result2 = await repo.findByEditalId(edital2.id);

      expect(result1).toHaveLength(0);
      expect(result2).toHaveLength(1);
      expect(result2[0].palavra).toBe('Vue');
    });
  });
});
