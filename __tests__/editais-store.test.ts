import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables, rawQuery } from './setup';
import type Database from 'better-sqlite3';

describe('EditaisStore - Soft Delete Rules', () => {
  let rawDb: Database.Database;
  let saveEdital: typeof import('../lib/db/editais-store').saveEdital;
  let isEditalExcluido: typeof import('../lib/db/editais-store').isEditalExcluido;
  let deleteEdital: typeof import('../lib/db/editais-store').deleteEdital;
  let getAllEditais: typeof import('../lib/db/editais-store').getAllEditais;

  beforeEach(async () => {
    const mock = setupTestDbMock();
    rawDb = mock.rawDb;
    clearAllTables(rawDb);

    vi.resetModules();
    const store = await import('../lib/db/editais-store');
    saveEdital = store.saveEdital;
    isEditalExcluido = store.isEditalExcluido;
    deleteEdital = store.deleteEdital;
    getAllEditais = store.getAllEditais;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve salvar um novo edital e verificar que não está excluído', async () => {
    const id = 'edital-novo-1';
    const link = 'https://example.com/edital-novo-1';
    const edital = {
      id,
      titulo: 'Edital Novo Teste',
      orgao: 'CNPq',
      dataLimite: '2026-12-31',
      link,
      status: 'Aberto' as const,
    };

    const salvo = await saveEdital(edital);
    expect(salvo.id).toBe(id);
    expect(salvo.deletedAt).toBeUndefined();

    const excluido = await isEditalExcluido(id, link);
    expect(excluido).toBe(false);
  });

  it('deve permitir atualizar um edital ativo', async () => {
    const id = 'edital-ativo-1';
    const link = 'https://example.com/edital-ativo-1';
    const edital = {
      id,
      titulo: 'Edital Ativo',
      orgao: 'CNPq',
      dataLimite: '2026-12-31',
      link,
      status: 'Aberto' as const,
    };

    await saveEdital(edital);

    // Atualizar
    const atualizado = await saveEdital({
      id,
      titulo: 'Edital Ativo Atualizado',
    });

    expect(atualizado.titulo).toBe('Edital Ativo Atualizado');
    expect(atualizado.deletedAt).toBeUndefined();

    // Buscar no banco bruto
    const row = (await rawQuery(rawDb, 'SELECT * FROM editais WHERE id = ?', [id]))[0] as any;
    expect(row.titulo).toBe('Edital Ativo Atualizado');
    expect(row.deleted_at).toBeNull();
  });

  it('deve deletar edital marcando como excluído (soft delete)', async () => {
    const id = 'edital-deletar-1';
    const link = 'https://example.com/edital-deletar-1';
    const edital = {
      id,
      titulo: 'Edital a ser Deletado',
      orgao: 'CAPES',
      dataLimite: '2020-12-31', // vencido: só excluído vencido fica bloqueado
      link,
      status: 'Aberto' as const,
    };

    await saveEdital(edital);

    const check1 = await isEditalExcluido(id, link);
    expect(check1).toBe(false);

    // Deletar
    const deletadoSucesso = await deleteEdital(id);
    expect(deletadoSucesso).toBe(true);

    // Verificar que consta como excluído
    const check2 = await isEditalExcluido(id, link);
    expect(check2).toBe(true);

    const checkPorLink = await isEditalExcluido('outro-id', link);
    expect(checkPorLink).toBe(true);

    // Verificar direto no banco de dados
    const row = (await rawQuery(rawDb, 'SELECT * FROM editais WHERE id = ?', [id]))[0] as any;
    expect(row).toBeDefined();
    expect(row.deleted_at).not.toBeNull();
  });

  it('deve ignorar nova tentativa de inserção/atualização de um edital que foi soft-deleted', async () => {
    const id = 'edital-protegido-1';
    const link = 'https://example.com/edital-protegido-1';
    const edital = {
      id,
      titulo: 'Edital Protegido',
      orgao: 'FINEP',
      dataLimite: '2020-12-31', // vencido: só excluído vencido fica bloqueado
      link,
      status: 'Aberto' as const,
    };

    await saveEdital(edital);
    await deleteEdital(id);

    // Verificar que está soft-deleted
    const rowAntes = (await rawQuery(rawDb, 'SELECT * FROM editais WHERE id = ?', [id]))[0] as any;
    const deletedTime = rowAntes.deleted_at;
    expect(deletedTime).not.toBeNull();

    // Tentar salvar o mesmo edital novamente (como se o scraper o encontrasse de novo)
    const novoScrape = {
      id,
      titulo: 'Edital Protegido - Scrape Novo',
      orgao: 'FINEP - Atualizado',
      dataLimite: '2026-12-31',
      link,
      status: 'Aberto' as const,
    };

    // saveEdital não deve dar erro e deve retornar o edital com deletedAt intacto
    const resultado = await saveEdital(novoScrape);
    expect(resultado.deletedAt).toBe(deletedTime);

    // Verificar no banco que os dados não foram sobregravados e o deleted_at permanece
    const rowDepois = (await rawQuery(rawDb, 'SELECT * FROM editais WHERE id = ?', [id]))[0] as any;
    expect(rowDepois.titulo).toBe('Edital Protegido'); // Não atualizou
    expect(rowDepois.orgao).toBe('FINEP'); // Não atualizou
    expect(rowDepois.deleted_at).toBe(deletedTime);
  });

  it('deve garantir que getAllEditais() não retorne editais marcados como excluídos', async () => {
    const idAtivo = 'edital-ativo-lista';
    const idExcluido = 'edital-excluido-lista';

    await saveEdital({
      id: idAtivo,
      titulo: 'Edital Ativo para Lista',
      orgao: 'CNPq',
      dataLimite: '2026-12-31',
      link: 'https://example.com/ativo',
      status: 'Aberto',
    });

    await saveEdital({
      id: idExcluido,
      titulo: 'Edital Excluído para Lista',
      orgao: 'FINEP',
      dataLimite: '2026-12-31',
      link: 'https://example.com/excluido',
      status: 'Aberto',
    });

    await deleteEdital(idExcluido);

    const list = await getAllEditais(true);
    expect(list.some(e => e.id === idAtivo)).toBe(true);
    expect(list.some(e => e.id === idExcluido)).toBe(false);
  });

  it('getAllEditais() trata categoriaArea como valor, nunca como SQL (SQL injection)', async () => {
    await saveEdital({
      id: 'edital-sqli-1',
      titulo: 'Edital Cultura',
      orgao: 'MinC',
      dataLimite: '2099-12-31',
      link: 'https://example.com/sqli-1',
      status: 'Aberto' as const,
    });

    const injetado = await getAllEditais(true, "x' OR '1'='1");
    expect(injetado).toHaveLength(0);

    const uniao = await getAllEditais(true, "x' UNION SELECT * FROM usuarios --");
    expect(uniao).toHaveLength(0);
  });
});
