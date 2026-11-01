import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/database/db';
import { usoIa } from '../lib/database/schema';
import { registrarUsoIA, extrairTokens, usoDeRespostaOpenAI, usoDeRespostaJev } from '../lib/ai/uso-ia';

const falhaGravacao = vi.hoisted(() => ({ ativa: false }));

vi.mock('../lib/database/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/database/db')>();
  return {
    ...real,
    db: new Proxy(real.db, {
      get(alvo, prop, receptor) {
        if (prop === 'insert' && falhaGravacao.ativa) {
          return () => {
            throw new Error('gravação indisponível');
          };
        }
        return Reflect.get(alvo, prop, receptor);
      },
    }),
  };
});

describe('registrarUsoIA', () => {
  beforeEach(async () => {
    await db.delete(usoIa);
  });

  it('grava tokens de entrada e saída com a origem e o edital', async () => {
    await registrarUsoIA({ origem: 'analise_edital', modelo: 'gpt-4o-mini', tokensEntrada: 1000, tokensSaida: 500, editalId: 'e1' });

    const linhas = await db.select().from(usoIa);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      origem: 'analise_edital',
      modelo: 'gpt-4o-mini',
      tokensEntrada: 1000,
      tokensSaida: 500,
      editalId: 'e1',
    });
  });

  it('nunca lança erro para quem chama, mesmo se a gravação falhar', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    falhaGravacao.ativa = true;
    try {
      await expect(
        registrarUsoIA({ origem: 'x', modelo: 'gpt-4o-mini', tokensEntrada: 1, tokensSaida: 1 })
      ).resolves.toBeUndefined();
      expect(aviso).toHaveBeenCalled();
    } finally {
      falhaGravacao.ativa = false;
      aviso.mockRestore();
    }
  });
});

describe('extrairTokens', () => {
  it('lê promptTokens e completionTokens da saída do LangChain', () => {
    expect(extrairTokens({ llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 5 } } })).toEqual({
      tokensEntrada: 10,
      tokensSaida: 5,
    });
  });

  it('devolve null quando a saída não traz uso de tokens', () => {
    expect(extrairTokens({ llmOutput: {} })).toBeNull();
    expect(extrairTokens(undefined)).toBeNull();
  });
});

describe('projeto_id', () => {
  beforeEach(async () => {
    await db.delete(usoIa);
  });

  it('grava o projetoId quando a chamada é de um projeto', async () => {
    await registrarUsoIA({ origem: 'redacao_projeto', modelo: 'gpt-5.6-luna', tokensEntrada: 10, tokensSaida: 5, projetoId: 'p1' });

    const linhas = await db.select().from(usoIa);
    expect(linhas[0]).toMatchObject({ origem: 'redacao_projeto', projetoId: 'p1', editalId: null });
  });
});

describe('usoDeRespostaOpenAI', () => {
  it('lê o modelo realmente usado e os tokens do SDK da OpenAI', () => {
    const resposta = { model: 'gpt-4o-mini-2024-07-18', usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } };
    expect(usoDeRespostaOpenAI(resposta, 'gpt-4o-mini')).toEqual({
      modelo: 'gpt-4o-mini-2024-07-18',
      tokensEntrada: 10,
      tokensSaida: 4,
    });
  });

  it('usa o modelo pedido quando a resposta não informa o modelo', () => {
    const resposta = { usage: { prompt_tokens: 1, completion_tokens: 2 } };
    expect(usoDeRespostaOpenAI(resposta, 'gpt-4o')?.modelo).toBe('gpt-4o');
  });

  it('devolve null quando a resposta não traz usage', () => {
    expect(usoDeRespostaOpenAI({ model: 'gpt-4o' }, 'gpt-4o')).toBeNull();
    expect(usoDeRespostaOpenAI(undefined, 'gpt-4o')).toBeNull();
  });
});

describe('usoDeRespostaJev', () => {
  it('lê input_tokens e output_tokens do Jev', () => {
    expect(usoDeRespostaJev({ input_tokens: 120, output_tokens: 7 })).toEqual({ tokensEntrada: 120, tokensSaida: 7 });
  });

  it('devolve null quando o Jev não traz uso', () => {
    expect(usoDeRespostaJev(undefined)).toBeNull();
    expect(usoDeRespostaJev({ input_tokens: 'x' })).toBeNull();
  });
});
