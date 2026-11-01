import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { inspect } from 'util';

// Erro com o formato do drizzle (DrizzleQueryError): a mensagem e as propriedades trazem a query e os parâmetros.
function erroDoDrizzle(parametros: unknown[]) {
  const causa = Object.assign(new Error('violação de integridade'), { code: '23505' });
  const erro = new Error(`Failed query: insert into "limites_taxa" params: ${parametros.join(',')}`, { cause: causa });
  erro.name = 'DrizzleQueryError';
  return Object.assign(erro, { query: 'insert into "limites_taxa" ...', params: parametros });
}

afterEach(() => {
  vi.doUnmock('../lib/database/db');
  vi.restoreAllMocks();
});

describe('limites de taxa: log de falha não expõe a chave', () => {
  it('o console.error não contém o e-mail nem a mensagem/parâmetros do erro, só nome e código', async () => {
    const marca = `marca-${crypto.randomUUID()}`;
    const chave = `login-email:${marca}@teste.com`;
    const erroBanco = erroDoDrizzle([chave, 1, Date.now()]);
    vi.doMock('../lib/database/db', () => ({
      db: {
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({ returning: () => Promise.reject(erroBanco) }),
          }),
        }),
      },
    }));
    vi.resetModules();
    const { contarTentativa } = await import('../lib/database/repositories/limites-taxa.repository');
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resultado = await contarTentativa(chave, 60_000, 1);

    const saida = inspect(erro.mock.calls, { depth: null });
    expect(resultado.permitido).toBe(true);
    expect(erro).toHaveBeenCalled();
    expect(saida).not.toContain(marca);
    expect(saida).toContain('DrizzleQueryError');
    expect(saida).toContain('23505');
  });
});
