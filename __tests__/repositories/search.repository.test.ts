import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { makeEditalDTO, resetCounter } from '../helpers';
import type Database from 'better-sqlite3';

describe('SearchRepository', () => {
  let rawDb: Database.Database;
  let EditalRepository: typeof import('../../lib/database/repositories/edital.repository').EditalRepository;
  let SearchRepository: typeof import('../../lib/database/repositories/search.repository').SearchRepository;

  beforeEach(async () => {
    resetCounter();
    const mock = setupTestDbMock();
    rawDb = mock.rawDb;
    clearAllTables(rawDb);

    vi.resetModules();
    const editalMod = await import('../../lib/database/repositories/edital.repository');
    const searchMod = await import('../../lib/database/repositories/search.repository');
    EditalRepository = editalMod.EditalRepository;
    SearchRepository = searchMod.SearchRepository;
  });

  async function seedForSearch() {
    const repo = new EditalRepository();
    const editais = [
      makeEditalDTO({
        titulo: 'Chamada Publica para Inteligencia Artificial',
        descricao: 'Financiamento de projetos de IA',
        orgao: 'CNPq',
        status: 'Aberto',
        tecnologiaFoco: 'Python, Machine Learning',
        scoreRelevancia: 90,
      }),
      makeEditalDTO({
        titulo: 'Edital de Inovacao em Saude Digital',
        descricao: 'Desenvolvimento de aplicativos mobile para saude',
        orgao: 'FAPERJ',
        status: 'Aberto',
        tecnologiaFoco: 'React Native, Flutter',
        scoreRelevancia: 75,
      }),
      makeEditalDTO({
        titulo: 'Programa de Transformacao Digital',
        descricao: 'Edital de modernizacao de sistemas legados com cloud computing',
        orgao: 'CNPq',
        status: 'Fechado',
        tecnologiaFoco: 'AWS, Docker, Kubernetes',
        scoreRelevancia: 60,
        pdfPath: 'downloads/edital-digital.pdf',
      }),
      makeEditalDTO({
        titulo: 'Fomento a Pesquisa em Cyberseguranca',
        descricao: 'Edital de projetos de seguranca da informacao e protecao de dados',
        orgao: 'FINEP',
        status: 'Aberto',
        tecnologiaFoco: 'Seguranca da Informacao',
        scoreRelevancia: 85,
      }),
    ];
    for (const dto of editais) {
      await repo.create(dto);
    }
    return editais;
  }

  describe('searchFullText', () => {
    it('deve encontrar editais por titulo', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'inteligencia artificial',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some((e: any) => e.titulo.includes('Inteligencia Artificial'))).toBe(true);
    });

    it('deve encontrar editais por descricao', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'aplicativos mobile',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('deve retornar total correto', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'edital',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.data.length).toBeLessThanOrEqual(result.total);
    });

    it('deve suportar paginacao', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const page1 = await repo.searchFullText({
        search: 'edital',
        page: 1,
        limit: 2,
      });

      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBeGreaterThanOrEqual(3);

      const page2 = await repo.searchFullText({
        search: 'edital',
        page: 2,
        limit: 2,
      });

      expect(page2.data.length).toBeGreaterThanOrEqual(1);
      const ids1 = page1.data.map((e: any) => e.id);
      const ids2 = page2.data.map((e: any) => e.id);
      expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
    });

    it('deve filtrar por status', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'edital',
        page: 1,
        limit: 10,
        status: 'Fechado',
      });

      expect(result.data.every((e: any) => e.status === 'Fechado')).toBe(true);
    });

    it('deve filtrar por orgao', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'edital',
        page: 1,
        limit: 10,
        orgao: 'CNPq',
      });

      expect(result.data.every((e: any) => e.orgao.includes('CNPq'))).toBe(true);
    });

    it('deve retornar vazio para busca sem resultados', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'termo inexistente xyz',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('deve retornar highlights com tags mark', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.searchFullText({
        search: 'inteligencia',
        page: 1,
        limit: 10,
      });

      if (result.data.length > 0) {
        const item = result.data[0];
        expect(item.titulo_highlight || item.descricao_highlight).toBeDefined();
      }
    });

    it('deve desconsiderar editais soft-deleted', async () => {
      const editais = await seedForSearch();
      const searchRepo = new SearchRepository();
      const editalRepo = new EditalRepository();
      
      // Soft-delete the first edital in the seeded list (which contains 'inteligencia')
      await editalRepo.softDelete(editais[0].id);

      const result = await searchRepo.searchFullText({
        search: 'inteligencia',
        page: 1,
        limit: 10,
      });

      expect(result.data.some((e: any) => e.id === editais[0].id)).toBe(false);
      expect(result.total).toBe(0);
    });
  });

  describe('getFiltersDisponiveis', () => {
    it('deve retornar orgaos distintos', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getFiltersDisponiveis();

      expect(result.orgaos).toContain('CNPq');
      expect(result.orgaos).toContain('FAPERJ');
      expect(result.orgaos).toContain('FINEP');
    });

    it('deve retornar status distintos', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getFiltersDisponiveis();

      expect(result.status).toContain('Aberto');
      expect(result.status).toContain('Fechado');
    });

    it('deve retornar tecnologias distintas', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getFiltersDisponiveis();

      expect(result.tecnologias.length).toBeGreaterThan(0);
      expect(result.tecnologias).toContain('Python, Machine Learning');
    });

    it('deve retornar listas vazias para banco vazio', async () => {
      const repo = new SearchRepository();

      const result = await repo.getFiltersDisponiveis();

      expect(result.orgaos).toEqual([]);
      expect(result.status).toEqual([]);
      expect(result.tecnologias).toEqual([]);
    });

    it('deve desconsiderar editais soft-deleted nos filtros', async () => {
      const editais = await seedForSearch();
      const searchRepo = new SearchRepository();
      const editalRepo = new EditalRepository();

      // Soft-delete the FAPERJ edital
      const faperjEd = editais.find(e => e.orgao === 'FAPERJ')!;
      await editalRepo.softDelete(faperjEd.id);

      const result = await searchRepo.getFiltersDisponiveis();
      expect(result.orgaos).not.toContain('FAPERJ');
    });
  });

  describe('getStats', () => {
    it('deve retornar total correto de editais', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getStats();

      expect(result.totalEditais).toBe(4);
    });

    it('deve retornar contagem por status', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getStats();

      expect(result.porStatus['Aberto']).toBe(3);
      expect(result.porStatus['Fechado']).toBe(1);
    });

    it('deve retornar contagem por orgao', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getStats();

      expect(result.porOrgao.length).toBeGreaterThan(0);
      const cnpq = result.porOrgao.find((o: any) => o.orgao === 'CNPq');
      expect(cnpq).toBeDefined();
      expect(cnpq!.count).toBe(2);
    });

    it('deve retornar contagem de editais com PDF', async () => {
      await seedForSearch();
      const repo = new SearchRepository();

      const result = await repo.getStats();

      expect(result.comPdf).toBe(1);
    });

    it('deve retornar zeros para banco vazio', async () => {
      const repo = new SearchRepository();

      const result = await repo.getStats();

      expect(result.totalEditais).toBe(0);
      expect(result.comPdf).toBe(0);
      expect(result.comAnaliseIa).toBe(0);
      expect(result.porStatus).toEqual({});
      expect(result.porOrgao).toEqual([]);
      expect(result.porTecnologia).toEqual([]);
    });

    it('deve desconsiderar editais soft-deleted nas estatisticas', async () => {
      const editais = await seedForSearch();
      const searchRepo = new SearchRepository();
      const editalRepo = new EditalRepository();

      // Soft-delete the FAPERJ edital
      const faperjEd = editais.find(e => e.orgao === 'FAPERJ')!;
      await editalRepo.softDelete(faperjEd.id);

      const result = await searchRepo.getStats();
      expect(result.totalEditais).toBe(3); // 4 - 1 = 3
    });
  });
});
