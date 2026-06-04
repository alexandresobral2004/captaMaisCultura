import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { makeEditalDTO, EDITAL_MINIMAL, EDITAL_FULL, resetCounter } from '../helpers';
import type Database from 'better-sqlite3';

describe('EditalRepository', () => {
  let rawDb: Database.Database;
  let EditalRepository: typeof import('../../lib/database/repositories/edital.repository').EditalRepository;

  beforeEach(async () => {
    resetCounter();
    const mock = setupTestDbMock();
    rawDb = mock.rawDb;
    clearAllTables(rawDb);

    vi.resetModules();
    const mod = await import('../../lib/database/repositories/edital.repository');
    EditalRepository = mod.EditalRepository;
  });

  describe('create', () => {
    it('deve criar edital com dados minimos', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO(EDITAL_MINIMAL);

      const result = await repo.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(dto.id);
      expect(result.titulo).toBe(dto.titulo);
      expect(result.orgao).toBe(dto.orgao);
      expect(result.dataLimite).toBe(dto.dataLimite);
      expect(result.link).toBe(dto.link);
      expect(result.status).toBe('Aberto');
      expect(result.statusAnalise).toBe('pendente');
    });

    it('deve criar edital com todos os campos', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO(EDITAL_FULL);

      const result = await repo.create(dto);

      expect(result.id).toBe(dto.id);
      expect(result.titulo).toBe(dto.titulo);
      expect(result.orgao).toBe(dto.orgao);
      expect(result.valor).toBe(dto.valor);
      expect(result.valorMin).toBe(dto.valorMin);
      expect(result.valorMax).toBe(dto.valorMax);
      expect(result.dataPublicacao).toBe(dto.dataPublicacao);
      expect(result.dataLimite).toBe(dto.dataLimite);
      expect(result.dataResultado).toBe(dto.dataResultado);
      expect(result.status).toBe(dto.status);
      expect(result.statusAnalise).toBe(dto.statusAnalise);
      expect(result.modalidade).toBe(dto.modalidade);
      expect(result.abrangencia).toBe(dto.abrangencia);
      expect(result.descricao).toBe(dto.descricao);
      expect(result.pdfUrl).toBe(dto.pdfUrl);
      expect(result.pdfPath).toBe(dto.pdfPath);
      expect(result.tecnologiaFoco).toBe(dto.tecnologiaFoco);
      expect(result.scoreRelevancia).toBe(dto.scoreRelevancia);
      expect(result.scoreConfiancaIa).toBe(dto.scoreConfiancaIa);
      expect(result.scorePontuacao).toBe(dto.scorePontuacao);
      expect(result.nivelPontuacao).toBe(dto.nivelPontuacao);
      expect(result.hashPontuacao).toBe(dto.hashPontuacao);
    });

    it('deve serializar arrays como JSON', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO({
        tipoProponente: ['Universidade', 'Empresa'],
        areasTematicas: ['TI', 'Saude'],
        motivosPontuacao: ['Motivo 1', 'Motivo 2'],
        arquivosAnexos: [{ url: 'https://example.com/anexo.pdf' }],
      });

      const result = await repo.create(dto);

      expect(JSON.parse(result.tipoProponente as string)).toEqual(['Universidade', 'Empresa']);
      expect(JSON.parse(result.areasTematicas as string)).toEqual(['TI', 'Saude']);
      expect(JSON.parse(result.motivosPontuacao as string)).toEqual(['Motivo 1', 'Motivo 2']);
      expect(JSON.parse(result.arquivosAnexos as string)).toEqual([{ url: 'https://example.com/anexo.pdf' }]);
    });

    it('deve setar booleanos corretamente', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO({
        validadoPorIa: true,
        foraDoEscopo: false,
        cacheClassificacaoUsado: true,
      });

      const result = await repo.create(dto);

      expect(result.validadoPorIa).toBe(true);
      expect(result.foraDoEscopo).toBe(false);
      expect(result.cacheClassificacaoUsado).toBe(true);
    });

    it('deve retornar o registro criado', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();

      const result = await repo.create(dto);
      const found = await repo.findById(dto.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(dto.id);
    });
  });

  describe('findById', () => {
    it('deve retornar edital existente', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();
      await repo.create(dto);

      const result = await repo.findById(dto.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(dto.id);
      expect(result!.titulo).toBe(dto.titulo);
    });

    it('deve retornar null para ID inexistente', async () => {
      const repo = new EditalRepository();

      const result = await repo.findById('id-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithRelations', () => {
    it('deve retornar edital com analiseIa e listas vazias', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();
      await repo.create(dto);

      const result = await repo.findByIdWithRelations(dto.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(dto.id);
      expect(result!.analiseIa).toBeNull();
      expect(result!.palavrasChave).toEqual([]);
      expect(result!.arquivosAnexosDb).toEqual([]);
      expect(result!.motivosPontuacaoDb).toEqual([]);
    });

    it('deve retornar null para ID inexistente', async () => {
      const repo = new EditalRepository();

      const result = await repo.findByIdWithRelations('id-inexistente');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    async function seedEditais(repo: any) {
      const editais = [
        makeEditalDTO({ titulo: 'Edital Aberto 1', orgao: 'CNPq', status: 'Aberto', tecnologiaFoco: 'React' }),
        makeEditalDTO({ titulo: 'Edital Aberto 2', orgao: 'FAPERJ', status: 'Aberto', tecnologiaFoco: 'Vue' }),
        makeEditalDTO({ titulo: 'Edital Fechado', orgao: 'CNPq', status: 'Fechado', tecnologiaFoco: 'React' }),
        makeEditalDTO({ titulo: 'Edital Prorrogado', orgao: 'FINEP', status: 'Prorrogado', tecnologiaFoco: 'Angular' }),
      ];
      for (const dto of editais) {
        await repo.create(dto);
      }
      return editais;
    }

    it('deve retornar paginacao basica', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(4);
    });

    it('deve retornar segunda pagina', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 2, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(4);
    });

    it('deve filtrar por status', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 1, limit: 10, status: 'Aberto' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((e: any) => e.status === 'Aberto')).toBe(true);
    });

    it('deve filtrar por orgao (LIKE)', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 1, limit: 10, orgao: 'CNPq' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((e: any) => e.orgao.includes('CNPq'))).toBe(true);
    });

    it('deve filtrar por tecnologia', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 1, limit: 10, tecnologia: 'React' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((e: any) => e.tecnologiaFoco?.includes('React'))).toBe(true);
    });

    it('deve filtrar por scoreMin e scoreMax', async () => {
      const repo = new EditalRepository();
      await repo.create(makeEditalDTO({ titulo: 'Score 50', scoreRelevancia: 50 }));
      await repo.create(makeEditalDTO({ titulo: 'Score 75', scoreRelevancia: 75 }));
      await repo.create(makeEditalDTO({ titulo: 'Score 90', scoreRelevancia: 90 }));

      const result = await repo.findAll({ page: 1, limit: 10, scoreMin: 60, scoreMax: 85 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].scoreRelevancia).toBe(75);
    });

    it('deve retornar vazio quando nenhum registro corresponde', async () => {
      const repo = new EditalRepository();
      await seedEditais(repo);

      const result = await repo.findAll({ page: 1, limit: 10, status: 'Em Analise' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('update', () => {
    it('deve atualizar campos especificos', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO({ titulo: 'Titulo Original', orgao: 'CNPq' });
      await repo.create(dto);

      const updated = await repo.update(dto.id, { titulo: 'Titulo Atualizado' });

      expect(updated.titulo).toBe('Titulo Atualizado');
      expect(updated.orgao).toBe('CNPq'); // nao alterado
    });

    it('deve atualizar multiplos campos', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();
      await repo.create(dto);

      const updated = await repo.update(dto.id, {
        titulo: 'Novo Titulo',
        status: 'Fechado',
        scoreRelevancia: 95,
      });

      expect(updated.titulo).toBe('Novo Titulo');
      expect(updated.status).toBe('Fechado');
      expect(updated.scoreRelevancia).toBe(95);
    });

    it('deve atualizar atualizadoEm', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();
      await repo.create(dto);

      const antes = await repo.findById(dto.id);
      await repo.update(dto.id, { titulo: 'X' });
      const depois = await repo.findById(dto.id);

      expect(depois!.atualizadoEm).toBeDefined();
    });

    it('deve atualizar arrays JSON', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO({ tipoProponente: ['Antigo'] });
      await repo.create(dto);

      const updated = await repo.update(dto.id, { tipoProponente: ['Novo 1', 'Novo 2'] });

      expect(JSON.parse(updated.tipoProponente as string)).toEqual(['Novo 1', 'Novo 2']);
    });

    it('deve atualizar booleanos', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO({ validadoPorIa: false, foraDoEscopo: false });
      await repo.create(dto);

      const updated = await repo.update(dto.id, { validadoPorIa: true, foraDoEscopo: true });

      expect(updated.validadoPorIa).toBe(true);
      expect(updated.foraDoEscopo).toBe(true);
    });

    it('deve retornar undefined para ID inexistente', async () => {
      const repo = new EditalRepository();

      const result = await repo.update('id-inexistente', { titulo: 'X' });

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deve remover edital do banco', async () => {
      const repo = new EditalRepository();
      const dto = makeEditalDTO();
      await repo.create(dto);

      await repo.delete(dto.id);

      const result = await repo.findById(dto.id);
      expect(result).toBeNull();
    });

    it('nao deve gerar erro para ID inexistente', async () => {
      const repo = new EditalRepository();

      await expect(repo.delete('id-inexistente')).resolves.not.toThrow();
    });
  });

  describe('count', () => {
    it('deve retornar 0 para tabela vazia', async () => {
      const repo = new EditalRepository();

      const total = await repo.count();

      expect(total).toBe(0);
    });

    it('deve retornar total correto', async () => {
      const repo = new EditalRepository();
      await repo.create(makeEditalDTO());
      await repo.create(makeEditalDTO());
      await repo.create(makeEditalDTO());

      const total = await repo.count();

      expect(total).toBe(3);
    });

    it('deve desconsiderar editais soft-deleted', async () => {
      const repo = new EditalRepository();
      const ed1 = makeEditalDTO();
      const ed2 = makeEditalDTO();
      await repo.create(ed1);
      await repo.create(ed2);
      await repo.softDelete(ed1.id);

      const total = await repo.count();
      expect(total).toBe(1);
    });
  });

  describe('countByStatus', () => {
    it('deve agrupar corretamente por status', async () => {
      const repo = new EditalRepository();
      await repo.create(makeEditalDTO({ status: 'Aberto' }));
      await repo.create(makeEditalDTO({ status: 'Aberto' }));
      await repo.create(makeEditalDTO({ status: 'Fechado' }));
      await repo.create(makeEditalDTO({ status: 'Prorrogado' }));

      const counts = await repo.countByStatus();

      expect(counts['Aberto']).toBe(2);
      expect(counts['Fechado']).toBe(1);
      expect(counts['Prorrogado']).toBe(1);
    });

    it('deve desconsiderar editais soft-deleted', async () => {
      const repo = new EditalRepository();
      const ed1 = makeEditalDTO({ status: 'Aberto' });
      const ed2 = makeEditalDTO({ status: 'Aberto' });
      await repo.create(ed1);
      await repo.create(ed2);
      await repo.softDelete(ed1.id);

      const counts = await repo.countByStatus();
      expect(counts['Aberto']).toBe(1);
    });

    it('deve retornar objeto vazio para tabela vazia', async () => {
      const repo = new EditalRepository();

      const counts = await repo.countByStatus();

      expect(counts).toEqual({});
    });
  });

  describe('findWithPdf', () => {
    it('deve retornar apenas editais com pdfPath', async () => {
      const repo = new EditalRepository();
      await repo.create(makeEditalDTO({ pdfPath: 'downloads/edital-1.pdf' }));
      await repo.create(makeEditalDTO({ pdfPath: undefined }));
      await repo.create(makeEditalDTO({ pdfPath: 'downloads/edital-3.pdf' }));

      const result = await repo.findWithPdf();

      expect(result).toHaveLength(2);
      expect(result.every((e: any) => e.pdfPath !== null)).toBe(true);
    });

    it('deve desconsiderar editais soft-deleted', async () => {
      const repo = new EditalRepository();
      const ed1 = makeEditalDTO({ pdfPath: 'downloads/edital-1.pdf' });
      const ed2 = makeEditalDTO({ pdfPath: 'downloads/edital-2.pdf' });
      await repo.create(ed1);
      await repo.create(ed2);
      await repo.softDelete(ed1.id);

      const result = await repo.findWithPdf();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ed2.id);
    });

    it('deve retornar array vazio quando nenhum tem pdfPath', async () => {
      const repo = new EditalRepository();
      await repo.create(makeEditalDTO({ pdfPath: undefined }));

      const result = await repo.findWithPdf();

      expect(result).toHaveLength(0);
    });
  });
});
