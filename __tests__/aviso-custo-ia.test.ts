import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/database/db';
import { usoIa, notificacoes } from '../lib/database/schema';
import { registrarUsoIA } from '../lib/ai/uso-ia';
import { listarNotificacoes, marcarNotificacaoLida } from '../lib/database/repositories/notificacao.repository';

// gpt-5.6-luna: US$ 0,20 por milhão de tokens de entrada. 10M tokens = US$ 2,00.
const usoAcimaDoLimite = { origem: 'analise_edital', modelo: 'gpt-5.6-luna', tokensEntrada: 10_000_000, tokensSaida: 0 };
const usoAbaixoDoLimite = { origem: 'analise_edital', modelo: 'gpt-5.6-luna', tokensEntrada: 1_000, tokensSaida: 0 };

const avisosDeCusto = () => listarNotificacoes({ tipo: 'alerta_custo_ia' });

describe('aviso de custo mensal, na central de notificações do banco', () => {
  beforeEach(async () => {
    process.env.CUSTO_IA_ALERTA_USD = '1';
    await db.delete(usoIa);
    await db.delete(notificacoes);
  });

  it('grava uma única notificação mesmo com duas chamadas acima do limite no mês', async () => {
    await registrarUsoIA(usoAcimaDoLimite);
    await registrarUsoIA(usoAcimaDoLimite);

    const avisos = await avisosDeCusto();
    expect(avisos).toHaveLength(1);
    expect(avisos[0].id).toMatch(/^alerta-custo-ia-\d{4}-\d{2}$/);
  });

  it('não grava aviso enquanto o total do mês está no limite ou abaixo', async () => {
    await registrarUsoIA(usoAbaixoDoLimite);

    expect(await avisosDeCusto()).toHaveLength(0);
  });

  it('o aviso aparece na central como notificação não lida, e sai da lista de não lidas depois de lido', async () => {
    await registrarUsoIA(usoAcimaDoLimite);

    const [aviso] = await avisosDeCusto();
    expect(aviso).toMatchObject({ tipo: 'alerta_custo_ia', lida: false, link: '/configuracoes/custos-ia', urgencia: 'alta' });
    expect(aviso.descricao).toContain('US$ 2.00');

    await marcarNotificacaoLida(aviso.id);
    const [depois] = await avisosDeCusto();
    expect(depois.lida).toBe(true);
  });
});
