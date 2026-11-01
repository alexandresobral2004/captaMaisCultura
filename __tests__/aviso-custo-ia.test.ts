import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/database/db';
import { usoIa, avisosCusto } from '../lib/database/schema';
import { registrarUsoIA } from '../lib/ai/uso-ia';
import { avisosCustoComoNotificacao, marcarAvisoCustoLido } from '../lib/ai/avisos-custo';

// gpt-5.6-luna: US$ 0,20 por milhão de tokens de entrada. 10M tokens = US$ 2,00.
const usoAcimaDoLimite = { origem: 'analise_edital', modelo: 'gpt-5.6-luna', tokensEntrada: 10_000_000, tokensSaida: 0 };
const usoAbaixoDoLimite = { origem: 'analise_edital', modelo: 'gpt-5.6-luna', tokensEntrada: 1_000, tokensSaida: 0 };

describe('aviso de custo mensal, guardado no banco', () => {
  beforeEach(async () => {
    process.env.CUSTO_IA_ALERTA_USD = '1';
    await db.delete(usoIa);
    await db.delete(avisosCusto);
  });

  it('grava uma única linha de aviso mesmo com duas chamadas acima do limite no mês', async () => {
    await registrarUsoIA(usoAcimaDoLimite);
    await registrarUsoIA(usoAcimaDoLimite);

    const linhas = await db.select().from(avisosCusto);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].totalUsd).toBeCloseTo(2, 5);
    expect(linhas[0].limiteUsd).toBe(1);
  });

  it('não grava aviso enquanto o total do mês está no limite ou abaixo', async () => {
    await registrarUsoIA(usoAbaixoDoLimite);

    expect(await db.select().from(avisosCusto)).toHaveLength(0);
  });

  it('o aviso aparece na central como notificação não lida, e some da contagem depois de lido', async () => {
    await registrarUsoIA(usoAcimaDoLimite);

    const [aviso] = await avisosCustoComoNotificacao();
    expect(aviso).toMatchObject({ tipo: 'alerta_custo_ia', lida: false, link: '/configuracoes/custos-ia' });
    expect(aviso.descricao).toContain('US$ 2.00');

    await marcarAvisoCustoLido(aviso.id);
    const [depois] = await avisosCustoComoNotificacao();
    expect(depois.lida).toBe(true);
  });
});
