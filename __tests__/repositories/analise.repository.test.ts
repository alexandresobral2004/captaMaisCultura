import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { makeEditalDTO, makeAnaliseDTO, resetCounter } from '../helpers';
import type Database from 'better-sqlite3';

describe('AnaliseRepository', () => {
  let rawDb: Database.Database;
  let EditalRepository: typeof import('../../lib/database/repositories/edital.repository').EditalRepository;
  let AnaliseRepository: typeof import('../../lib/database/repositories/analise.repository').AnaliseRepository;

  beforeEach(async () => {
    resetCounter();
    const mock = setupTestDbMock();
    rawDb = mock.rawDb;
    clearAllTables(rawDb);

    vi.resetModules();
    const editalMod = await import('../../lib/database/repositories/edital.repository');
    const analiseMod = await import('../../lib/database/repositories/analise.repository');
    EditalRepository = editalMod.EditalRepository;
    AnaliseRepository = analiseMod.AnaliseRepository;
  });

  async function createEdital() {
    const editalRepo = new EditalRepository();
    const dto = makeEditalDTO();
    return editalRepo.create(dto);
  }

  describe('createOrUpdate (criar)', () => {
    it('deve criar analise nova com todos os campos', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();
      const dto = makeAnaliseDTO({ editalId: edital.id });

      const result = await repo.createOrUpdate(dto);

      expect(result).not.toBeNull();
      expect(result!.editalId).toBe(edital.id);
      expect(result!.resumo).toBe(dto.resumo);
      expect(result!.objetivo).toBe(dto.objetivo);
      expect(result!.elegibilidade).toBe(dto.elegibilidade);
      expect(result!.contatoEdital).toBe(dto.contatoEdital);
      expect(result!.scoreAdequacao).toBe(dto.scoreAdequacao);
    });

    it('deve criar analise com todas as 5 listas', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();
      const dto = makeAnaliseDTO({ editalId: edital.id });

      const result = await repo.createOrUpdate(dto);

      expect(result!.requisitos).toEqual(['Requisito 1', 'Requisito 2']);
      expect(result!.itensFinanciaveis).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(result!.documentosNecessarios).toEqual(['Documento A', 'Documento B']);
      expect(result!.criteriosAvaliacao).toEqual(['Criterio X']);
      expect(result!.pontosFracos).toEqual(['Ponto fraco 1']);
    });

    it('deve criar analise sem listas', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();
      const dto = makeAnaliseDTO({
        editalId: edital.id,
        requisitos: undefined,
        itensFinanciaveis: undefined,
        documentos: undefined,
        criterios: undefined,
        pontosFracos: undefined,
      });

      const result = await repo.createOrUpdate(dto);

      expect(result).not.toBeNull();
      expect(result!.requisitos).toEqual([]);
      expect(result!.itensFinanciaveis).toEqual([]);
      expect(result!.documentosNecessarios).toEqual([]);
      expect(result!.criteriosAvaliacao).toEqual([]);
      expect(result!.pontosFracos).toEqual([]);
    });

    it('deve manter ordem dos itens nas listas', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();
      const dto = makeAnaliseDTO({
        editalId: edital.id,
        requisitos: ['Terceiro', 'Primeiro', 'Segundo'],
      });

      const result = await repo.createOrUpdate(dto);

      expect(result!.requisitos).toEqual(['Terceiro', 'Primeiro', 'Segundo']);
    });
  });

  describe('createOrUpdate (atualizar)', () => {
    it('deve atualizar analise existente', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        resumo: 'Resumo Original',
        scoreAdequacao: 50,
      }));

      const result = await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        resumo: 'Resumo Atualizado',
        scoreAdequacao: 90,
      }));

      expect(result!.resumo).toBe('Resumo Atualizado');
      expect(result!.scoreAdequacao).toBe(90);
    });

    it('deve substituir listas anteriores completamente', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        requisitos: ['Antigo 1', 'Antigo 2'],
      }));

      const result = await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        requisitos: ['Novo 1'],
      }));

      expect(result!.requisitos).toEqual(['Novo 1']);
    });

    it('deve manter o mesmo ID da analise', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      const primeira = await repo.createOrUpdate(makeAnaliseDTO({ editalId: edital.id }));
      const segunda = await repo.createOrUpdate(makeAnaliseDTO({ editalId: edital.id }));

      expect(primeira!.id).toBe(segunda!.id);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        resumo: 'Original',
        objetivo: 'Obj Original',
      }));

      const result = await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital.id,
        resumo: 'Novo',
        objetivo: undefined,
      }));

      expect(result!.resumo).toBe('Novo');
      expect(result!.objetivo).toBe('Obj Original');
    });
  });

  describe('findByEditalId', () => {
    it('deve retornar null para edital sem analise', async () => {
      const repo = new AnaliseRepository();

      const result = await repo.findByEditalId('edital-inexistente');

      expect(result).toBeNull();
    });

    it('deve retornar analise completa com todas as listas', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({ editalId: edital.id }));

      const result = await repo.findByEditalId(edital.id);

      expect(result).not.toBeNull();
      expect(result!.editalId).toBe(edital.id);
      expect(Array.isArray(result!.requisitos)).toBe(true);
      expect(Array.isArray(result!.itensFinanciaveis)).toBe(true);
      expect(Array.isArray(result!.documentosNecessarios)).toBe(true);
      expect(Array.isArray(result!.criteriosAvaliacao)).toBe(true);
      expect(Array.isArray(result!.pontosFracos)).toBe(true);
    });
  });

  describe('delete', () => {
    it('deve remover analise e todas as listas', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({ editalId: edital.id }));
      await repo.delete(edital.id);

      const result = await repo.findByEditalId(edital.id);
      expect(result).toBeNull();
    });

    it('nao deve gerar erro para edital sem analise', async () => {
      const edital = await createEdital();
      const repo = new AnaliseRepository();

      await expect(repo.delete(edital.id)).resolves.not.toThrow();
    });

    it('deve remover apenas a analise do edital especifico', async () => {
      const edital1 = await createEdital();
      const edital2 = await createEdital();
      const repo = new AnaliseRepository();

      await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital1.id,
        resumo: 'Analise 1',
      }));
      await repo.createOrUpdate(makeAnaliseDTO({
        editalId: edital2.id,
        resumo: 'Analise 2',
      }));

      await repo.delete(edital1.id);

      const result1 = await repo.findByEditalId(edital1.id);
      const result2 = await repo.findByEditalId(edital2.id);

      expect(result1).toBeNull();
      expect(result2).not.toBeNull();
      expect(result2!.resumo).toBe('Analise 2');
    });
  });
});
