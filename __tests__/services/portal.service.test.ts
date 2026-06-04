import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';

describe('PortalService', () => {
  let PortalService: any;
  let service: any;
  let mock: any;

  beforeEach(async () => {
    vi.resetModules();
    mock = setupTestDbMock();
    if (mock?.rawDb) clearAllTables(mock.rawDb);
    const mod = await import('../../lib/database/services/portal.service');
    PortalService = mod.PortalService;
    service = new PortalService();
  });

  afterEach(() => {
    if (mock?.rawDb) {
      clearAllTables(mock.rawDb);
    }
  });

  describe('criar', () => {
    it('deve criar um portal com dados mínimos', async () => {
      const portal = await service.criar({
        nome: 'FINEP - Chamadas Públicas',
        urlBusca: 'https://www.finep.gov.br/chamadas-publicas',
        tipo: 'html',
        categoria: 'Inovação e Tecnologia'
      });

      expect(portal).toBeDefined();
      expect(portal.id).toBeDefined();
      expect(portal.nome).toBe('FINEP - Chamadas Públicas');
      expect(portal.urlBusca).toBe('https://www.finep.gov.br/chamadas-publicas');
      expect(portal.tipo).toBe('html');
      expect(portal.categoria).toBe('Inovação e Tecnologia');
      expect(portal.ativo).toBe(true);
      expect(portal.intervaloMinutos).toBe(60);
      expect(portal.urlsFallback).toEqual([]);
      expect(portal.criadoEm).toBeDefined();
      expect(portal.atualizadoEm).toBeDefined();
    });

    it('deve criar um portal com id customizado', async () => {
      const portal = await service.criar({
        id: 'finep',
        nome: 'FINEP',
        urlBusca: 'https://finep.gov.br',
        tipo: 'html',
        categoria: 'Teste'
      });

      expect(portal.id).toBe('finep');
    });

    it('deve criar um portal com urls fallback', async () => {
      const portal = await service.criar({
        nome: 'CNPq',
        urlBusca: 'https://www.gov.br/cnpq/pt-br/financiamento/chamadas-abertas',
        urlsFallback: [
          'https://cnpq.br/chamadas-publicas',
          'https://www.cnpq.br/chamadas-publicas'
        ],
        tipo: 'html',
        categoria: 'Pesquisa'
      });

      expect(portal.urlsFallback).toHaveLength(2);
      expect(portal.urlsFallback).toContain('https://cnpq.br/chamadas-publicas');
    });

    it('deve criar portal inativo quando ativo=false', async () => {
      const portal = await service.criar({
        nome: 'Teste Inativo',
        urlBusca: 'https://teste.com',
        tipo: 'html',
        categoria: 'Teste',
        ativo: false
      });

      expect(portal.ativo).toBe(false);
    });
  });

  describe('listar', () => {
    it('deve listar todos os portais', async () => {
      await service.criar({
        nome: 'Portal 1',
        urlBusca: 'https://portal1.com',
        tipo: 'html',
        categoria: 'Cat1'
      });
      await service.criar({
        nome: 'Portal 2',
        urlBusca: 'https://portal2.com',
        tipo: 'rss',
        categoria: 'Cat2'
      });

      const portais = await service.listar();

      expect(portais).toHaveLength(2);
    });

    it('deve retornar array vazio quando não há portais', async () => {
      const portais = await service.listar();
      expect(portais).toEqual([]);
    });
  });

  describe('listarAtivos', () => {
    it('deve listar apenas portais ativos', async () => {
      await service.criar({
        nome: 'Ativo',
        urlBusca: 'https://ativo.com',
        tipo: 'html',
        categoria: 'Teste',
        ativo: true
      });
      await service.criar({
        nome: 'Inativo',
        urlBusca: 'https://inativo.com',
        tipo: 'html',
        categoria: 'Teste',
        ativo: false
      });

      const ativos = await service.listarAtivos();

      expect(ativos).toHaveLength(1);
      expect(ativos[0].nome).toBe('Ativo');
    });
  });

  describe('buscarPorId', () => {
    it('deve encontrar portal por id', async () => {
      const created = await service.criar({
        id: 'finep',
        nome: 'FINEP',
        urlBusca: 'https://finep.gov.br',
        tipo: 'html',
        categoria: 'Teste'
      });

      const found = await service.buscarPorId('finep');

      expect(found).toBeDefined();
      expect(found.id).toBe('finep');
      expect(found.nome).toBe('FINEP');
    });

    it('deve retornar null para id inexistente', async () => {
      const found = await service.buscarPorId('inexistente');
      expect(found).toBeNull();
    });
  });

  describe('atualizar', () => {
    it('deve atualizar dados do portal', async () => {
      await service.criar({
        id: 'teste',
        nome: 'Nome Antigo',
        urlBusca: 'https://antigo.com',
        tipo: 'html',
        categoria: 'Teste'
      });

      const updated = await service.atualizar('teste', {
        nome: 'Nome Novo',
        urlBusca: 'https://novo.com'
      });

      expect(updated.nome).toBe('Nome Novo');
      expect(updated.urlBusca).toBe('https://novo.com');
    });

    it('deve lançar erro para portal inexistente', async () => {
      await expect(
        service.atualizar('inexistente', { nome: 'Novo Nome' })
      ).rejects.toThrow('não encontrado');
    });
  });

  describe('toggleAtivo', () => {
    it('deve togglar ativo para inativo', async () => {
      await service.criar({
        id: 'toggle',
        nome: 'Teste',
        urlBusca: 'https://teste.com',
        tipo: 'html',
        categoria: 'Teste',
        ativo: true
      });

      const toggled = await service.toggleAtivo('toggle');

      expect(toggled.ativo).toBe(false);
    });

    it('deve togglar inativo para ativo', async () => {
      await service.criar({
        id: 'toggle2',
        nome: 'Teste',
        urlBusca: 'https://teste.com',
        tipo: 'html',
        categoria: 'Teste',
        ativo: false
      });

      const toggled = await service.toggleAtivo('toggle2');

      expect(toggled.ativo).toBe(true);
    });

    it('deve lançar erro para portal inexistente', async () => {
      await expect(service.toggleAtivo('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('deletar', () => {
    it('deve deletar portal existente', async () => {
      await service.criar({
        id: 'delete',
        nome: 'Para Deletar',
        urlBusca: 'https://delete.com',
        tipo: 'html',
        categoria: 'Teste'
      });

      await service.deletar('delete');

      const found = await service.buscarPorId('delete');
      expect(found).toBeNull();
    });

    it('deve lançar erro para portal inexistente', async () => {
      await expect(service.deletar('inexistente')).rejects.toThrow('não encontrado');
    });
  });

  describe('atualizarUltimoScan', () => {
    it('deve atualizar timestamp do último scan', async () => {
      await service.criar({
        id: 'scan',
        nome: 'Teste Scan',
        urlBusca: 'https://scan.com',
        tipo: 'html',
        categoria: 'Teste'
      });

      await service.atualizarUltimoScan('scan');

      const portal = await service.buscarPorId('scan');
      expect(portal.ultimoScan).toBeDefined();
    });
  });
});