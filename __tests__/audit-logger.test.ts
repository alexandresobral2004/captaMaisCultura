/**
 * audit-logger.test.ts
 *
 * Testes para o módulo de auditoria de decisões do filtro de TI.
 *
 * ESTRATÉGIA:
 * Usamos a base de dados em memória do setupTestDbMock() para testar
 * a persistência real dos motivos, validando o esquema do Drizzle e
 * as constraints de chave estrangeira do SQLite.
 *
 * Todos os testes são determinísticos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTestDbMock, clearAllTables } from './setup';
import type { BlacklistResult } from '../lib/scraper/filtros/blacklist-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Aguarda microtasks pendentes (das Promises fire-and-forget) */
async function drainMicrotasks(ms = 25) {
  await new Promise((r) => setTimeout(r, ms));
}

describe('AuditLogger Integration Tests with SQLite', () => {
  let mock: any;
  let registrarMotivoWhitelist: any;
  let registrarMotivoBlacklist: any;
  let registrarMotivoIA: any;
  let registrarMotivoFallbackDuvida: any;
  let registrarDecisaoFinal: any;
  let registrarConflito: any;
  let consultarMotivos: any;

  beforeEach(async () => {
    vi.resetModules();
    mock = setupTestDbMock();
    if (mock?.rawDb) clearAllTables(mock.rawDb);

    // Inserir os editais pai para não quebrar a constraint de chave estrangeira
    const ids = [
      'edital-001', 'edital-002', 'edital-003', 'edital-004',
      'edital-010', 'edital-011', 'edital-012', 'edital-013',
      'edital-020', 'edital-021', 'edital-022', 'edital-023',
      'edital-030', 'edital-040', 'edital-041', 'edital-042',
      'edital-043', 'edital-050', 'edital-060', 'edital-061'
    ];
    for (const id of ids) {
      mock.rawDb.prepare(`
        INSERT INTO editais (id, titulo, orgao, data_limite, link)
        VALUES (?, 'Título de Teste', 'Órgão de Teste', '2026-12-31', 'https://example.com')
      `).run(id);
    }

    // Importar dinamicamente para carregar com a db mockada pelo setup
    const mod = await import('../lib/scraper/filtros/audit-logger');
    registrarMotivoWhitelist = mod.registrarMotivoWhitelist;
    registrarMotivoBlacklist = mod.registrarMotivoBlacklist;
    registrarMotivoIA = mod.registrarMotivoIA;
    registrarMotivoFallbackDuvida = mod.registrarMotivoFallbackDuvida;
    registrarDecisaoFinal = mod.registrarDecisaoFinal;
    registrarConflito = mod.registrarConflito;
    consultarMotivos = mod.consultarMotivos;
  });

  afterEach(() => {
    if (mock?.rawDb) {
      clearAllTables(mock.rawDb);
    }
  });

  // Retorna os motivos inseridos mapeados com nomes de propriedades camelCase compatíveis com os assertions antigos
  function getInsertedRows() {
    const rows = mock.rawDb.prepare('SELECT * FROM motivos_pontuacao').all();
    return rows.map((r: any) => ({
      id: r.id,
      editalId: r.edital_id,
      motivo: r.motivo,
      fonte: r.fonte,
      scoreParcial: r.score_parcial,
      scoreFinal: r.score_final,
      detalhes: r.detalhes,
      criadoEm: r.criado_em,
    }));
  }

  describe('registrarMotivoWhitelist', () => {
    it('persiste um motivo com fonte=whitelist', async () => {
      registrarMotivoWhitelist('edital-001', {
        categoria: 'Tecnologia TI',
        confianca: 'alta',
        termosEncontrados: ['machine learning', 'inteligência artificial'],
        scoreParcial: 30,
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      expect(insertedRows).toHaveLength(1);
      const row = insertedRows[0];
      expect(row.editalId).toBe('edital-001');
      expect(row.fonte).toBe('whitelist');
      expect(row.scoreParcial).toBe(30);
    });

    it('motivo contém nome da categoria e termos encontrados', async () => {
      registrarMotivoWhitelist('edital-002', {
        categoria: 'Pesquisa & Academia',
        confianca: 'média',
        termosEncontrados: ['universidade federal'],
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.motivo).toContain('Whitelist:');
      expect(row.motivo).toContain("'Pesquisa & Academia'");
      expect(row.motivo).toContain('universidade federal');
      expect(row.motivo).toContain('confiança média');
    });

    it('trunca a lista de termos para os 5 primeiros e adiciona +N outros', async () => {
      registrarMotivoWhitelist('edital-003', {
        confianca: 'alta',
        termosEncontrados: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.motivo).toContain('+2 outros');
    });

    it('persiste detalhes como JSON com os termos', async () => {
      registrarMotivoWhitelist('edital-004', {
        categoria: 'Tecnologia TI',
        confianca: 'alta',
        termosEncontrados: ['software', 'algoritmo'],
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      const detalhes = JSON.parse(row.detalhes);
      expect(detalhes.termosEncontrados).toContain('software');
      expect(detalhes.confianca).toBe('alta');
    });
  });

  describe('registrarMotivoBlacklist', () => {
    const blacklistResultadoZero: BlacklistResult = {
      scoreNegativo: 0,
      termosEncontrados: [],
      severidade: 'baixa',
      recomendacao: 'penalizar',
      motivos: [],
    };

    const blacklistResultadoAlto: BlacklistResult = {
      scoreNegativo: 50,
      termosEncontrados: [
        { termo: 'saúde bucal', ocorrencias: 2, peso: 25 },
        { termo: 'odontologia', ocorrencias: 1, peso: 15, contexto: 'Termo fora de contexto TI' },
      ],
      severidade: 'alta',
      recomendacao: 'bloquear',
      motivos: ["Termo 'saúde bucal' encontrado (2x)", "Termo 'odontologia' encontrado (1x)"],
    };

    it('persiste motivo "nenhum termo indesejado" quando score é zero', async () => {
      registrarMotivoBlacklist('edital-010', { resultado: blacklistResultadoZero });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      expect(insertedRows).toHaveLength(1);
      const row = insertedRows[0];
      expect(row.fonte).toBe('blacklist');
      expect(row.scoreParcial).toBe(0);
      expect(row.motivo).toContain('nenhum termo indesejado detectado');
    });

    it('persiste um motivo por termo encontrado + motivo consolidado de recomendação', async () => {
      registrarMotivoBlacklist('edital-011', {
        resultado: blacklistResultadoAlto,
        scoreFinal: 20,
      });
      await drainMicrotasks(80);

      const insertedRows = getInsertedRows();
      // 2 termos + 1 motivo consolidado (recomendacao !== 'penalizar')
      expect(insertedRows.length).toBe(3);

      const termoRows = insertedRows.filter((r: any) => r.motivo.includes("Blacklist: termo '"));
      expect(termoRows).toHaveLength(2);

      const consolidadoRow = insertedRows.find((r: any) => r.motivo.includes('severidade alta'));
      expect(consolidadoRow).toBeDefined();
      expect(consolidadoRow.motivo).toContain('bloquear');
      expect(consolidadoRow.scoreFinal).toBe(20);
    });

    it('motivo de termo contém o nome do termo, ocorrências e peso', async () => {
      registrarMotivoBlacklist('edital-012', { resultado: blacklistResultadoAlto });
      await drainMicrotasks(80);

      const insertedRows = getInsertedRows();
      const termoRow = insertedRows.find((r: any) => r.motivo.includes("saúde bucal"));
      expect(termoRow).toBeDefined();
      expect(termoRow.motivo).toContain('-25 pontos');
      expect(termoRow.motivo).toContain('2x');
      expect(termoRow.scoreParcial).toBe(-25);
    });

    it('NÃO persiste motivo consolidado quando recomendação é penalizar (score baixo)', async () => {
      const resultadoBaixo: BlacklistResult = {
        scoreNegativo: 15,
        termosEncontrados: [{ termo: 'dança', ocorrencias: 1, peso: 15 }],
        severidade: 'baixa',
        recomendacao: 'penalizar',
        motivos: ["Termo 'dança' encontrado"],
      };

      registrarMotivoBlacklist('edital-013', { resultado: resultadoBaixo });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      // Apenas 1 motivo de termo, nenhum consolidado
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].motivo).toContain("termo 'dança'");
    });
  });

  describe('registrarMotivoIA', () => {
    it('persiste motivo de IA válida com categoria e score', async () => {
      registrarMotivoIA('edital-020', true, {
        modelo: 'gpt-4o-mini',
        tecnologia: 'IA & Machine Learning',
        score: 87,
        confianca: 92,
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.fonte).toBe('ia');
      expect(row.motivo).toContain('OpenAI (gpt-4o-mini): válido');
      expect(row.motivo).toContain("'IA & Machine Learning'");
      expect(row.motivo).toContain('score 87');
      expect(row.motivo).toContain('confiança 92%');
      expect(row.scoreParcial).toBe(87);
    });

    it('persiste motivo de IA inválida com razão', async () => {
      registrarMotivoIA('edital-021', false, {
        modelo: 'gpt-4o-mini',
        razao: 'Edital completamente fora do escopo de TI',
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.fonte).toBe('ia');
      expect(row.motivo).toContain('inválido');
      expect(row.motivo).toContain('fora do escopo de TI');
    });

    it('usa razão padrão quando razão não é fornecida', async () => {
      registrarMotivoIA('edital-022', false, { modelo: 'gpt-4o-mini' });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.motivo).toContain('fora do escopo de TI');
    });

    it('persiste scoreFinal quando fornecido', async () => {
      registrarMotivoIA('edital-023', true, {
        modelo: 'gpt-4o-mini',
        score: 80,
        scoreFinal: 75,
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      expect(insertedRows[0].scoreFinal).toBe(75);
    });
  });

  describe('registrarMotivoFallbackDuvida', () => {
    const casos: Array<{
      erroTipo: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'unknown';
      palavraChave: string;
    }> = [
      { erroTipo: 'timeout', palavraChave: 'timeout na chamada' },
      { erroTipo: 'rate_limit', palavraChave: 'rate limit atingido' },
      { erroTipo: 'auth', palavraChave: 'falha de autenticação' },
      { erroTipo: 'parse', palavraChave: 'resposta inválida' },
      { erroTipo: 'unknown', palavraChave: 'erro desconhecido' },
    ];

    for (const { erroTipo, palavraChave } of casos) {
      it(`registra motivo legível para erroTipo='${erroTipo}'`, async () => {
        registrarMotivoFallbackDuvida('edital-030', {
          erroTipo,
          mensagem: `Mensagem original do erro ${erroTipo}`,
          modelo: 'gpt-4o-mini',
        });
        await drainMicrotasks();

        const insertedRows = getInsertedRows();
        const row = insertedRows[0];
        expect(row.fonte).toBe('fallback');
        expect(row.motivo).toContain(palavraChave);
        expect(row.motivo).toContain('revisão humana');
        expect(row.motivo).toContain('gpt-4o-mini');

        const detalhes = JSON.parse(row.detalhes);
        expect(detalhes.erroTipo).toBe(erroTipo);
        expect(detalhes.mensagem).toContain(erroTipo);

        // Limpar tabela entre as iterações do loop
        mock.rawDb.prepare('DELETE FROM motivos_pontuacao').run();
      });
    }
  });

  describe('registrarDecisaoFinal', () => {
    it('persiste decisão aprovado com score e fontes', async () => {
      registrarDecisaoFinal('edital-040', {
        decisao: 'aprovado',
        scoreFinal: 82,
        fontes: ['whitelist', 'ia'],
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.fonte).toBe('decisao');
      expect(row.scoreFinal).toBe(82);
      expect(row.motivo).toContain('DecisionEngine: aprovado');
      expect(row.motivo).toContain('score 82');
      expect(row.motivo).toContain('whitelist, ia');
    });

    it('persiste decisão rejeitado com detalhe', async () => {
      registrarDecisaoFinal('edital-041', {
        decisao: 'rejeitado',
        scoreFinal: 15,
        fontes: ['blacklist'],
        detalhe: 'blacklist recomendou bloqueio',
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.motivo).toContain('rejeitado');
      expect(row.motivo).toContain('blacklist recomendou bloqueio');
    });

    it('persiste decisão duvida sem score', async () => {
      registrarDecisaoFinal('edital-042', {
        decisao: 'duvida',
        fontes: ['fallback'],
        detalhe: 'IA indisponível por rate limit',
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.motivo).toContain('duvida');
      expect(row.motivo).not.toContain('score undefined');
      expect(row.scoreFinal).toBeNull();
    });

    it('JSON de detalhes contém decisao e fontes', async () => {
      registrarDecisaoFinal('edital-043', {
        decisao: 'aprovado',
        scoreFinal: 70,
        fontes: ['whitelist', 'blacklist', 'ia'],
      });
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const detalhes = JSON.parse(insertedRows[0].detalhes);
      expect(detalhes.decisao).toBe('aprovado');
      expect(detalhes.fontes).toContain('whitelist');
      expect(detalhes.fontes).toContain('ia');
    });
  });

  describe('registrarConflito', () => {
    it('persiste motivo de conflito com whitelist e blacklist', async () => {
      registrarConflito('edital-050', 'alta', 'media', 45);
      await drainMicrotasks();

      const insertedRows = getInsertedRows();
      const row = insertedRows[0];
      expect(row.fonte).toBe('decisao');
      expect(row.scoreFinal).toBe(45);
      expect(row.motivo).toContain('conflito');
      expect(row.motivo).toContain('whitelist alta');
      expect(row.motivo).toContain('blacklist media');
      expect(row.motivo).toContain('revisão humana');

      const detalhes = JSON.parse(row.detalhes);
      expect(detalhes.conflito).toBe(true);
    });
  });

  describe('Robustez (não quebra o pipeline)', () => {
    it('silencia erros de DB sem lançar exceção', async () => {
      // Faz o insert explodir mockando o db.insert
      vi.spyOn(mock.db, 'insert').mockImplementationOnce(() => {
        throw new Error('Disk full');
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        registrarMotivoWhitelist('edital-060', {
          confianca: 'alta',
          termosEncontrados: ['software'],
        });
      }).not.toThrow();

      await drainMicrotasks();
      warnSpy.mockRestore();
    });

    it('funções são fire-and-forget: retornam void (não são Promise)', () => {
      const r1 = registrarMotivoWhitelist('edital-061', { confianca: 'alta', termosEncontrados: ['ia'] });
      const r2 = registrarDecisaoFinal('edital-061', { decisao: 'aprovado', fontes: ['ia'] });
      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
    });
  });
});
