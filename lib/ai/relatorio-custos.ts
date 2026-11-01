import { and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/db';
import { usoIa } from '../database/schema';
import { agregarCustos, type AgregacaoCustos, type LinhaUso } from './custos';
import { avaliarAlerta, inicioDoMesIso, limiteAlertaUsd, type StatusAlerta } from './alerta-custo';

/** Período do painel. Sem datas, a rota usa o mês corrente. Validado na entrada. */
export const PeriodoCustosSchema = z
  .object({
    desde: z.iso.datetime({ offset: true }).optional(),
    ate: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((p) => !p.desde || !p.ate || Date.parse(p.desde) <= Date.parse(p.ate), {
    message: 'desde deve ser anterior ou igual a ate',
  });

export interface RelatorioCustos extends AgregacaoCustos {
  periodo: { desde: string; ate: string };
  alerta: StatusAlerta;
}

async function linhasEntre(desde: string, ate: string): Promise<LinhaUso[]> {
  return db
    .select({
      origem: usoIa.origem,
      modelo: usoIa.modelo,
      tokensEntrada: usoIa.tokensEntrada,
      tokensSaida: usoIa.tokensSaida,
      editalId: usoIa.editalId,
      projetoId: usoIa.projetoId,
    })
    .from(usoIa)
    .where(and(gte(usoIa.criadoEm, desde), lte(usoIa.criadoEm, ate)));
}

/**
 * Monta o painel de custos: o período pedido por fase, edital e total, e o alerta
 * sobre o mês corrente (desde o dia 1 UTC até `agora`), independente do filtro.
 */
export async function montarRelatorioCustos(opcoes: {
  desde: string;
  ate: string;
  agora?: Date;
  limiteUsd?: number;
}): Promise<RelatorioCustos> {
  const agora = opcoes.agora ?? new Date();
  const agregado = agregarCustos(await linhasEntre(opcoes.desde, opcoes.ate));
  const doMes = agregarCustos(await linhasEntre(inicioDoMesIso(agora), agora.toISOString()));
  const limite = opcoes.limiteUsd ?? limiteAlertaUsd();

  return {
    periodo: { desde: opcoes.desde, ate: opcoes.ate },
    ...agregado,
    alerta: avaliarAlerta(doMes.total.custoUsd, limite),
  };
}
