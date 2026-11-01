import { eq } from 'drizzle-orm';
import { db } from '../database/db';
import { avisosCusto } from '../database/schema';
import { montarRelatorioCustos } from './relatorio-custos';
import { deveNotificarCustoMensal, inicioDoMesIso } from './alerta-custo';

/**
 * Grava o aviso de custo do mês quando o total passa do limite. Uma linha por mês, na
 * tabela avisos_custo (chave = mês), compartilhada entre web e worker. Nunca lança erro.
 */
export async function avisarCustoMensalSeNecessario(agora: Date = new Date()): Promise<void> {
  try {
    const mes = inicioDoMesIso(agora).slice(0, 7);

    // Checa antes de agregar: depois do aviso, cada chamada de IA não relê o mês inteiro
    const existente = await db.select({ mes: avisosCusto.mes }).from(avisosCusto).where(eq(avisosCusto.mes, mes));
    if (existente.length > 0) return;

    const { alerta } = await montarRelatorioCustos({
      desde: inicioDoMesIso(agora),
      ate: agora.toISOString(),
      agora,
    });
    if (!deveNotificarCustoMensal(alerta.totalUsd, alerta.limiteUsd, false)) return;

    await db
      .insert(avisosCusto)
      .values({
        mes,
        criadoEm: agora.toISOString(),
        totalUsd: alerta.totalUsd,
        limiteUsd: alerta.limiteUsd,
        lida: 0,
      })
      .onConflictDoNothing();
  } catch (erro) {
    console.warn('[aviso-custo-ia] Falha ao avisar custo mensal:', erro instanceof Error ? erro.message : erro);
  }
}
