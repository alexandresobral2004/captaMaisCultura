import { describe, it, expect } from 'vitest';
import { agregarCustos, type LinhaUso } from '../lib/ai/custos';

const linha = (extra: Partial<LinhaUso>): LinhaUso => ({
  origem: 'analise_edital',
  modelo: 'gpt-4o-mini',
  tokensEntrada: 1000,
  tokensSaida: 500,
  editalId: null,
  projetoId: null,
  ...extra,
});

describe('agregarCustos', () => {
  it('soma chamadas, tokens e custo por fase', () => {
    const r = agregarCustos([
      linha({ origem: 'analise_edital' }),
      linha({ origem: 'analise_edital', tokensEntrada: 2000, tokensSaida: 0 }),
      linha({ origem: 'redacao_projeto', modelo: 'gpt-5.6-luna', tokensEntrada: 1_000_000, tokensSaida: 0 }),
    ]);

    const analise = r.porFase.find((f) => f.origem === 'analise_edital');
    expect(analise).toEqual({
      origem: 'analise_edital',
      chamadas: 2,
      tokensEntrada: 3000,
      tokensSaida: 500,
      custoUsd: expect.any(Number),
      semPreco: 0,
    });
    expect(analise?.custoUsd).toBeCloseTo(0.00045 + 0.0003, 10);
    expect(r.porFase.find((f) => f.origem === 'redacao_projeto')?.custoUsd).toBeCloseTo(0.2, 10);
  });

  it('modelo sem preço não soma no custo, mas conta como sem preço', () => {
    const r = agregarCustos([
      linha({ origem: 'triagem_jev', modelo: 'modelo-sem-preco', tokensEntrada: 1_000_000, tokensSaida: 0 }),
      linha({ origem: 'triagem_jev', modelo: 'jev', tokensEntrada: 1_000_000, tokensSaida: 0 }),
    ]);

    const jev = r.porFase[0];
    expect(jev.chamadas).toBe(2);
    expect(jev.semPreco).toBe(1);
    expect(jev.custoUsd).toBeCloseTo(0.042, 10);
    expect(r.total.custoUsd).toBeCloseTo(0.042, 10);
  });

  it('agrupa por edital e ignora chamadas sem edital no agrupamento', () => {
    const r = agregarCustos([
      linha({ editalId: 'e1' }),
      linha({ editalId: 'e1', origem: 'extracao_pdf' }),
      linha({ editalId: 'e2' }),
      linha({ projetoId: 'p1' }),
    ]);

    expect(r.porEdital.map((e) => e.editalId).sort()).toEqual(['e1', 'e2']);
    const e1 = r.porEdital.find((e) => e.editalId === 'e1');
    expect(e1?.chamadas).toBe(2);
    expect(e1?.porFase.map((f) => f.origem).sort()).toEqual(['analise_edital', 'extracao_pdf']);
    expect(r.total.chamadas).toBe(4);
  });

  it('sem linhas, devolve zeros', () => {
    expect(agregarCustos([])).toEqual({
      porFase: [],
      porEdital: [],
      total: { chamadas: 0, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0, semPreco: 0 },
    });
  });
});

describe('agregarCustos: chamadas sem preço', () => {
  it('conta semPreco por edital e no total, sem somar custo para elas', () => {
    const r = agregarCustos([
      { origem: 'analise_edital', modelo: 'gpt-4o-mini', tokensEntrada: 1_000_000, tokensSaida: 0, editalId: 'e1', projetoId: null },
      { origem: 'validacao_documento', modelo: 'modelo-novo', tokensEntrada: 10, tokensSaida: 10, editalId: 'e1', projetoId: null },
    ]);
    expect(r.porEdital[0].semPreco).toBe(1);
    expect(r.total.semPreco).toBe(1);
    expect(r.total.custoUsd).toBeCloseTo(0.15, 10);
  });
});
