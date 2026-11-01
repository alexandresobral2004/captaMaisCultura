import { describe, it, expect } from 'vitest';
import { custoUsd } from '../lib/ai/precos';

describe('custoUsd', () => {
  it('calcula o custo de gpt-4o-mini a partir dos tokens de entrada e saída', () => {
    // 1000 entrada a US$0,15/1M + 500 saída a US$0,60/1M
    expect(custoUsd('gpt-4o-mini', 1000, 500)).toBeCloseTo(0.00045, 10);
  });

  it('usa a tabela do GPT-5.6 Luna (redação)', () => {
    // 1M entrada a US$0,20 + 1M saída a US$1,20
    expect(custoUsd('gpt-5.6-luna', 1_000_000, 1_000_000)).toBeCloseTo(1.4, 10);
  });

  it('o Jev cobra entrada e não cobra saída', () => {
    expect(custoUsd('jev', 1_000_000, 1_000_000)).toBeCloseTo(0.042, 10);
  });

  it('modelo sem preço cadastrado devolve null, e não zero', () => {
    expect(custoUsd('modelo-desconhecido', 100, 100)).toBeNull();
  });
});

describe('custoUsd com snapshot de modelo', () => {
  it('aceita o nome com data que a OpenAI devolve na resposta', () => {
    expect(custoUsd('gpt-4o-mini-2024-07-18', 1000, 500)).toBeCloseTo(0.00045, 10);
  });
});

describe('Jev com o nome de modelo padrão', () => {
  it('jev-latest, o modelo padrão do Jev, tem o mesmo preço que jev', () => {
    expect(custoUsd('jev-latest', 1_000_000, 0)).toBeCloseTo(0.042, 10);
    expect(custoUsd('jev-latest', 1_000_000, 0)).toBe(custoUsd('jev', 1_000_000, 0));
  });

  it('versões do Jev devolvidas pela API (ex.: jev-1.0.0) usam o mesmo preço', () => {
    expect(custoUsd('jev-1.0.0', 1_000_000, 0)).toBeCloseTo(0.042, 10);
  });
});
