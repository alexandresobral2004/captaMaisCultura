import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/database/db';
import { usoIa } from '../lib/database/schema';
import { montarRelatorioCustos, PeriodoCustosSchema } from '../lib/ai/relatorio-custos';

const AGORA = new Date('2026-11-17T12:00:00Z');

describe('PeriodoCustosSchema', () => {
  it('aceita datas ISO e completa o período que não veio', () => {
    const r = PeriodoCustosSchema.parse({ desde: '2026-11-01T00:00:00.000Z' });
    expect(r.desde).toBe('2026-11-01T00:00:00.000Z');
    expect(r.ate).toBeUndefined();
  });

  it('rejeita data que não é ISO', () => {
    expect(PeriodoCustosSchema.safeParse({ desde: '01/11/2026' }).success).toBe(false);
  });

  it('rejeita período em que o início é depois do fim', () => {
    expect(
      PeriodoCustosSchema.safeParse({ desde: '2026-11-10T00:00:00.000Z', ate: '2026-11-01T00:00:00.000Z' }).success
    ).toBe(false);
  });
});

describe('montarRelatorioCustos', () => {
  beforeEach(async () => {
    await db.delete(usoIa);
    await db.insert(usoIa).values([
      // gpt-4o: 1M de entrada = US$ 2,50
      { criadoEm: '2026-11-02T10:00:00.000Z', origem: 'analise_edital', modelo: 'gpt-4o', tokensEntrada: 1_000_000, tokensSaida: 0, editalId: 'e1', projetoId: null },
      // modelo sem preço cadastrado
      { criadoEm: '2026-11-03T10:00:00.000Z', origem: 'triagem_jev', modelo: 'modelo-sem-preco', tokensEntrada: 500, tokensSaida: 0, editalId: null, projetoId: null },
      // projeto, com gpt-5.6-luna: 1M de saída = US$ 1,20
      { criadoEm: '2026-11-04T10:00:00.000Z', origem: 'redacao_projeto', modelo: 'gpt-5.6-luna', tokensEntrada: 0, tokensSaida: 1_000_000, editalId: null, projetoId: 'p1' },
      // fora do período pedido (outubro)
      { criadoEm: '2026-10-20T10:00:00.000Z', origem: 'analise_edital', modelo: 'gpt-4o', tokensEntrada: 1_000_000, tokensSaida: 0, editalId: 'e9', projetoId: null },
    ]);
  });

  it('considera só as chamadas do período pedido', async () => {
    const r = await montarRelatorioCustos({ desde: '2026-11-01T00:00:00.000Z', ate: '2026-11-30T23:59:59.999Z', agora: AGORA, limiteUsd: 15 });

    expect(r.total.chamadas).toBe(3);
    expect(r.total.custoUsd).toBeCloseTo(2.5 + 1.2, 10);
    expect(r.porEdital.map((e) => e.editalId)).toEqual(['e1']);
  });

  it('informa itens sem preço por fase', async () => {
    const r = await montarRelatorioCustos({ desde: '2026-11-01T00:00:00.000Z', ate: '2026-11-30T23:59:59.999Z', agora: AGORA, limiteUsd: 15 });

    expect(r.porFase.find((f) => f.origem === 'triagem_jev')?.semPreco).toBe(1);
    expect(r.porFase.find((f) => f.origem === 'analise_edital')?.custoUsd).toBeCloseTo(2.5, 10);
  });

  it('calcula o alerta sobre o mês corrente, independentemente do período filtrado', async () => {
    const r = await montarRelatorioCustos({ desde: '2026-10-01T00:00:00.000Z', ate: '2026-10-31T23:59:59.999Z', agora: AGORA, limiteUsd: 3 });

    // Período filtrado é outubro (US$ 2,50), mas o alerta olha novembro (US$ 3,70 > 3)
    expect(r.alerta).toEqual({ ultrapassou: true, totalUsd: expect.any(Number), limiteUsd: 3 });
    expect(r.alerta.totalUsd).toBeCloseTo(2.5 + 1.2, 10);
  });
});
